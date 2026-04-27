'use strict';
const express  = require('express');
const multer   = require('multer');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const { exec } = require('child_process');
const crypto   = require('crypto');
const AdmZip   = require('adm-zip');

const app  = express();
const port = 5000;
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload  = multer({ storage, limits: { fileSize: 250 * 1024 * 1024 } });

// ── RPF & CRYPTO Constants ──────────────────────────────────────────────────
const RPF_MAGIC = Buffer.from([0x37, 0x46, 0x50, 0x52]);
const ENC_OPEN  = 0x4E45504F;
const ENC_NONE  = 0;
const ENC_AES   = 0x0FFFFFF9;
const ENC_NG    = 0x0FEFFFFF;
const KEYS_DIR  = '/opt/lhc-keys';
const RESIDENT_RPF_PATH = '/opt/lhc-sound/RESIDENT.rpf';

let GTA5_AES_KEY  = null;
let GTA5_NG_KEYS  = null;
let GTA5_NG_TABLES = null;
let GTA5_HASH_LUT  = null;

function loadKeys() {
    try {
        const aesPath    = path.join(KEYS_DIR, 'gtav_aes_key.dat');
        const ngKeyPath  = path.join(KEYS_DIR, 'gtav_ng_key.dat');
        const ngTabPath  = path.join(KEYS_DIR, 'gtav_ng_decrypt_tables.dat');
        const lutPath    = path.join(KEYS_DIR, 'gtav_hash_lut.dat');

        if (!fs.existsSync(aesPath)) return console.warn('[v23] Keys not found, crypto disabled');

        GTA5_AES_KEY = fs.readFileSync(aesPath);
        const ngKeyRaw = fs.readFileSync(ngKeyPath);
        GTA5_NG_KEYS = [];
        for (let i = 0; i < 101; i++) GTA5_NG_KEYS.push(ngKeyRaw.slice(i * 272, (i + 1) * 272));

        const ngTabRaw = fs.readFileSync(ngTabPath);
        GTA5_NG_TABLES = [];
        let off = 0;
        for (let r = 0; r < 17; r++) {
            GTA5_NG_TABLES[r] = [];
            for (let t = 0; t < 16; t++) {
                const table = new Uint32Array(256);
                for (let e = 0; e < 256; e++) { table[e] = ngTabRaw.readUInt32LE(off); off += 4; }
                GTA5_NG_TABLES[r].push(table);
            }
        }
        GTA5_HASH_LUT = fs.readFileSync(lutPath);
        console.log('[v23] Crypto keys loaded successfully');
    } catch (e) { console.warn('[v23] Failed to load keys:', e.message); }
}
loadKeys();

// ── CRYPTO HELPERS ──────────────────────────────────────────────────────────
function gta5Hash(text) {
    let result = 0;
    for (let i = 0; i < text.length; i++) {
        const c = GTA5_HASH_LUT ? GTA5_HASH_LUT[text.charCodeAt(i) & 0xFF] : (text.charCodeAt(i) | 0x20) & 0xFF;
        const sum = (c + result) >>> 0;
        const temp = Math.imul(1025, sum) >>> 0;
        result = ((temp >>> 6) ^ temp) >>> 0;
    }
    const r9 = Math.imul(9, result) >>> 0;
    return Math.imul(32769, ((r9 >>> 11) ^ r9) >>> 0) >>> 0;
}

function ngDecryptRoundA(data, subKey, table) {
    const x1 = (table[0][data[0]] ^ table[1][data[1]] ^ table[2][data[2]] ^ table[3][data[3]] ^ subKey[0]) >>> 0;
    const x2 = (table[4][data[4]] ^ table[5][data[5]] ^ table[6][data[6]] ^ table[7][data[7]] ^ subKey[1]) >>> 0;
    const x3 = (table[8][data[8]] ^ table[9][data[9]] ^ table[10][data[10]] ^ table[11][data[11]] ^ subKey[2]) >>> 0;
    const x4 = (table[12][data[12]] ^ table[13][data[13]] ^ table[14][data[14]] ^ table[15][data[15]] ^ subKey[3]) >>> 0;
    const r = Buffer.allocUnsafe(16);
    r.writeUInt32LE(x1, 0); r.writeUInt32LE(x2, 4); r.writeUInt32LE(x3, 8); r.writeUInt32LE(x4, 12);
    return r;
}

function ngDecryptRoundB(data, subKey, table) {
    const x1 = (table[0][data[0]] ^ table[7][data[7]] ^ table[10][data[10]] ^ table[13][data[13]] ^ subKey[0]) >>> 0;
    const x2 = (table[1][data[1]] ^ table[4][data[4]] ^ table[11][data[11]] ^ table[14][data[14]] ^ subKey[1]) >>> 0;
    const x3 = (table[2][data[2]] ^ table[5][data[5]] ^ table[8][data[8]] ^ table[15][data[15]] ^ subKey[2]) >>> 0;
    const x4 = (table[3][data[3]] ^ table[6][data[6]] ^ table[9][data[9]] ^ table[12][data[12]] ^ subKey[3]) >>> 0;
    const r = Buffer.allocUnsafe(16);
    r.writeUInt32LE(x1, 0); r.writeUInt32LE(x2, 4); r.writeUInt32LE(x3, 8); r.writeUInt32LE(x4, 12);
    return r;
}

function ngDecryptBlock(block, keyBuf) {
    const subKeys = [];
    for (let i = 0; i < 17; i++) subKeys.push([keyBuf.readUInt32LE(i * 16), keyBuf.readUInt32LE(i * 16 + 4), keyBuf.readUInt32LE(i * 16 + 8), keyBuf.readUInt32LE(i * 16 + 12)]);
    let buf = block;
    buf = ngDecryptRoundA(buf, subKeys[0], GTA5_NG_TABLES[0]);
    buf = ngDecryptRoundA(buf, subKeys[1], GTA5_NG_TABLES[1]);
    for (let k = 2; k <= 15; k++) buf = ngDecryptRoundB(buf, subKeys[k], GTA5_NG_TABLES[k]);
    buf = ngDecryptRoundA(buf, subKeys[16], GTA5_NG_TABLES[16]);
    return buf;
}

function ngDecrypt(data, keyBuf) {
    const out = Buffer.from(data);
    for (let b = 0; b < Math.floor(data.length / 16); b++) {
        ngDecryptBlock(data.slice(b * 16, b * 16 + 16), keyBuf).copy(out, b * 16);
    }
    return out;
}

function findNgKey(encBlock, filename, fileSize) {
    if (filename) {
        const idx = ((gta5Hash(filename) + fileSize + 61) >>> 0) % 101;
        const key = GTA5_NG_KEYS[idx];
        const test = ngDecryptBlock(encBlock.slice(0, 16), key);
        if (test.readUInt16LE(0) === 0 && test.readUInt32LE(4) === 0x7FFFFF00) return key;
    }
    for (let i = 0; i < 101; i++) {
        const test = ngDecryptBlock(encBlock.slice(0, 16), GTA5_NG_KEYS[i]);
        if (test.readUInt16LE(0) === 0 && test.readUInt32LE(4) === 0x7FFFFF00) return GTA5_NG_KEYS[i];
    }
    throw new Error('No se pudo desencriptar el RPF (clave NG no encontrada)');
}

function openRpfBuffer(rpfBuffer, encType, filename) {
    const entryCount = rpfBuffer.readUInt32LE(4);
    const namesLength = rpfBuffer.readUInt32LE(8);
    const headerLen = entryCount * 16 + namesLength;
    const encBlock = rpfBuffer.slice(16, 16 + headerLen);
    let decBlock;
    if (encType === ENC_AES) {
        const d = crypto.createDecipheriv('aes-256-ecb', GTA5_AES_KEY, null); d.setAutoPadding(false);
        decBlock = Buffer.concat([d.update(encBlock.slice(0, Math.floor(encBlock.length / 16) * 16)), d.final()]);
        if (encBlock.length % 16) decBlock = Buffer.concat([decBlock, encBlock.slice(decBlock.length)]);
    } else {
        const key = findNgKey(encBlock, filename, rpfBuffer.length);
        decBlock = ngDecrypt(encBlock, key);
    }
    const result = Buffer.from(rpfBuffer);
    result.writeUInt32LE(ENC_OPEN, 12);
    decBlock.copy(result, 16);
    if (encType === ENC_NG) {
        const nameTableStart = 16 + entryCount * 16;
        for (let i = 0; i < entryCount; i++) {
            const eOff = 16 + i * 16;
            if (result.readUInt32LE(eOff + 4) === 0x7FFFFF00) continue;
            const nameOff = result.readUInt16LE(eOff);
            let name = ''; let p = nameTableStart + nameOff;
            while (p < nameTableStart + namesLength && result[p] !== 0) name += String.fromCharCode(result[p++]);
            const page = result[eOff+5] | (result[eOff+6]<<8) | (result[eOff+7]<<16);
            const size = result.readUInt32LE(eOff + 8);
            if (page > 0 && size > 0 && page * 512 + size <= result.length) {
                const keyIdx = ((gta5Hash(name.toLowerCase()) + size + 61) >>> 0) % 101;
                ngDecrypt(result.slice(page * 512, page * 512 + size), GTA5_NG_KEYS[keyIdx]).copy(result, page * 512);
            }
        }
    }
    return result;
}

// ── AWC GENERATOR ───────────────────────────────────────────────────────────
function wavToAwc(wavBuffer, streamId) {
    let fmtOffset = 12; while (wavBuffer.toString('utf8', fmtOffset, fmtOffset + 4) !== 'fmt ') fmtOffset += 8 + wavBuffer.readUInt32LE(fmtOffset + 4);
    const channels = wavBuffer.readUInt16LE(fmtOffset + 10);
    const sampleRate = wavBuffer.readUInt32LE(fmtOffset + 12);
    let dataOffset = 12; while (wavBuffer.toString('utf8', dataOffset, dataOffset + 4) !== 'data') dataOffset += 8 + wavBuffer.readUInt32LE(dataOffset + 4);
    const dataSize = wavBuffer.readUInt32LE(dataOffset + 4);
    const audioData = wavBuffer.slice(dataOffset + 8, dataOffset + 8 + dataSize);
    const numSamples = dataSize / (channels * 2);
    const awc = Buffer.alloc(1024 + audioData.length);
    awc.write('ADAT', 0); awc.writeUInt32LE(0xFF000001, 4); awc.writeUInt32LE(1, 8);
    awc.writeUInt32LE((2 << 29) | (streamId & 0x1FFFFFFF), 16);
    const sfxOff = 32; awc.writeUInt32LE(numSamples, sfxOff); awc.writeInt32LE(-1, sfxOff + 4); awc.writeUInt16LE(sampleRate, sfxOff + 8); awc.writeUInt8(0x00, sfxOff + 24);
    const dataAlign = 2048; audioData.copy(awc, dataAlign);
    const writeTag = (type, size, offset, writeOff) => {
        awc.writeUInt32LE(((offset & 0x0FFFFFFF) | ((size & 0xF) << 28)) >>> 0, writeOff);
        awc.writeUInt32LE(((size >>> 4) | (type << 24)) >>> 0, writeOff + 4);
    };
    writeTag(0xFA, 0x18, sfxOff, 20); writeTag(0x55, audioData.length, dataAlign, 28);
    awc.writeUInt32LE(sfxOff + 0x18, 12);
    return awc.slice(0, dataAlign + audioData.length);
}

// ── ENDPOINTS ───────────────────────────────────────────────────────────────
app.post('/api/Sound/inject', upload.fields([{ name: 'audio' }, { name: 'rpf' }]), async (req, res) => {
    const audioFile = req.files?.['audio']?.[0];
    let rpfFile = req.files?.['rpf']?.[0];
    const useTemplate = req.body.useTemplate === 'true';

    if (!audioFile) return res.status(400).send('Falta el audio.');
    if (!rpfFile && !useTemplate) return res.status(400).send('Sube el RPF o usa una plantilla.');

    try {
        const wavBuf = await convertToWav(audioFile.buffer);
        let rpfBuffer;
        let rpfName = 'LHC_Sound.rpf';

        if (useTemplate) {
            if (!fs.existsSync(RESIDENT_RPF_PATH)) throw new Error('Plantilla no disponible en el servidor.');
            rpfBuffer = fs.readFileSync(RESIDENT_RPF_PATH);
            rpfName = 'RESIDENT.rpf';
        } else {
            rpfBuffer = rpfFile.buffer;
            rpfName = rpfFile.originalname;
        }

        const encType = rpfBuffer.readUInt32LE(12);
        if (encType === ENC_AES || encType === ENC_NG) {
            rpfBuffer = openRpfBuffer(rpfBuffer, encType, rpfName);
        }

        const modifiedRpf = replaceAwcInRpf(rpfBuffer, wavBuf);
        const zip = new AdmZip();
        zip.addFile(`LHC Sound boost/${rpfName}`, modifiedRpf);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="LHC_Sound_Boost.zip"`);
        res.send(zip.toBuffer());
    } catch (e) { res.status(500).send(e.message); }
});

function convertToWav(buf) {
    const tmpIn = path.join(os.tmpdir(), `in_${Date.now()}`); const tmpOut = path.join(os.tmpdir(), `out_${Date.now()}.wav`);
    return new Promise((resolve, reject) => {
        fs.writeFileSync(tmpIn, buf);
        exec(`ffmpeg -y -i "${tmpIn}" -ac 1 -ar 44100 -c:a pcm_s16le "${tmpOut}"`, (err) => {
            if (err) return reject(new Error('ffmpeg error'));
            const b = fs.readFileSync(tmpOut); fs.unlinkSync(tmpIn); fs.unlinkSync(tmpOut); resolve(b);
        });
    });
}

function replaceAwcInRpf(rpfBuffer, wavBuf) {
    const entryCount = rpfBuffer.readUInt32LE(4);
    const namesLength = rpfBuffer.readUInt32LE(8);
    const nameTableStart = 16 + entryCount * 16;
    const entries = []; let targetEntry = null;
    for (let i = 0; i < entryCount; i++) {
        const eOff = 16 + i * 16; const nameOff = rpfBuffer.readUInt16LE(eOff); const w4 = rpfBuffer.readUInt32LE(eOff + 4); const isDir = (w4 === 0x7FFFFF00);
        let name = ''; let p = nameTableStart + nameOff; while (p < nameTableStart + namesLength && rpfBuffer[p] !== 0) name += String.fromCharCode(rpfBuffer[p++]);
        let data = null; const page = rpfBuffer[eOff+5] | (rpfBuffer[eOff+6]<<8) | (rpfBuffer[eOff+7]<<16); const size = rpfBuffer.readUInt32LE(eOff + 8);
        if (!isDir && page > 0) data = Buffer.from(rpfBuffer.slice(page * 512, page * 512 + size));
        entries.push({ name, data, isDir, eOff });
        if (!targetEntry && !isDir && name.toLowerCase().endsWith('.awc')) targetEntry = entries[i];
    }
    if (!targetEntry) throw new Error('No se encontró archivo .awc');
    const streamId = targetEntry.data.readUInt32LE(0x10) & 0x1FFFFFFF;
    targetEntry.data = wavToAwc(wavBuf, streamId);
    const newDataStart = Math.ceil((nameTableStart + namesLength) / 512) * 512;
    let cur = newDataStart;
    const output = Buffer.alloc(cur + entries.reduce((a,e) => a + (e.isDir?0:Math.ceil(e.data.length/512)*512), 0));
    rpfBuffer.copy(output, 0, 0, nameTableStart + namesLength);
    output.writeUInt32LE(ENC_OPEN, 12);
    entries.forEach((e, i) => {
        if (e.isDir || !e.data) return;
        const p = cur / 512; e.data.copy(output, cur);
        const ep = 16 + i * 16; output[ep+5]=p&0xFF; output[ep+6]=(p>>8)&0xFF; output[ep+7]=(p>>16)&0xFF; output.writeUInt32LE(e.data.length, ep+8);
        const cs = e.data.length; output[ep+2]=cs&0xFF; output[ep+3]=(cs>>8)&0xFF; output[ep+4]=(cs>>16)&0xFF;
        cur += Math.ceil(e.data.length / 512) * 512;
    });
    return output;
}

app.listen(port, '0.0.0.0', () => console.log(`[v23] AWC PCM + Crypto API on port ${port}`));
