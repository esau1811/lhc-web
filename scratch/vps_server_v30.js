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
        const aesPath = path.join(KEYS_DIR, 'gtav_aes_key.dat');
        const ngKeyPath = path.join(KEYS_DIR, 'gtav_ng_key.dat');
        const ngTabPath = path.join(KEYS_DIR, 'gtav_ng_decrypt_tables.dat');
        const lutPath = path.join(KEYS_DIR, 'gtav_hash_lut.dat');
        if (!fs.existsSync(aesPath)) return;
        GTA5_AES_KEY = fs.readFileSync(aesPath);
        const ngKeyRaw = fs.readFileSync(ngKeyPath);
        GTA5_NG_KEYS = []; for (let i = 0; i < 101; i++) GTA5_NG_KEYS.push(ngKeyRaw.slice(i * 272, (i + 1) * 272));
        const ngTabRaw = fs.readFileSync(ngTabPath);
        GTA5_NG_TABLES = []; let off = 0;
        for (let r = 0; r < 17; r++) {
            GTA5_NG_TABLES[r] = [];
            for (let t = 0; t < 16; t++) {
                const table = new Uint32Array(256);
                for (let e = 0; e < 256; e++) { table[e] = ngTabRaw.readUInt32LE(off); off += 4; }
                GTA5_NG_TABLES[r].push(table);
            }
        }
        GTA5_HASH_LUT = fs.readFileSync(lutPath);
        console.log('[v30] Keys loaded');
    } catch (e) { console.error('[v30] Key load error:', e.message); }
}
loadKeys();

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

function ngDecryptBlock(block, keyBuf) {
    const subKeys = []; for (let i = 0; i < 17; i++) subKeys.push([keyBuf.readUInt32LE(i * 16), keyBuf.readUInt32LE(i * 16 + 4), keyBuf.readUInt32LE(i * 16 + 8), keyBuf.readUInt32LE(i * 16 + 12)]);
    const rdA = (d, sk, t) => {
        const x1 = (t[0][d[0]] ^ t[1][d[1]] ^ t[2][d[2]] ^ t[3][d[3]] ^ sk[0]) >>> 0;
        const x2 = (t[4][d[4]] ^ t[5][d[5]] ^ t[6][d[6]] ^ t[7][d[7]] ^ sk[1]) >>> 0;
        const x3 = (t[8][d[8]] ^ t[9][d[9]] ^ t[10][d[10]] ^ t[11][d[11]] ^ sk[2]) >>> 0;
        const x4 = (t[12][d[12]] ^ t[13][d[13]] ^ t[14][d[14]] ^ t[15][d[15]] ^ sk[3]) >>> 0;
        const r = Buffer.allocUnsafe(16); r.writeUInt32LE(x1, 0); r.writeUInt32LE(x2, 4); r.writeUInt32LE(x3, 8); r.writeUInt32LE(x4, 12); return r;
    };
    const rdB = (d, sk, t) => {
        const x1 = (t[0][d[0]] ^ t[7][d[7]] ^ t[10][d[10]] ^ t[13][d[13]] ^ sk[0]) >>> 0;
        const x2 = (t[1][d[1]] ^ t[4][d[4]] ^ t[11][d[11]] ^ t[14][d[14]] ^ sk[1]) >>> 0;
        const x3 = (t[2][d[2]] ^ t[5][d[5]] ^ t[8][d[8]] ^ t[15][d[15]] ^ sk[2]) >>> 0;
        const x4 = (t[3][d[3]] ^ t[6][d[6]] ^ t[9][d[9]] ^ t[12][d[12]] ^ sk[3]) >>> 0;
        const r = Buffer.allocUnsafe(16); r.writeUInt32LE(x1, 0); r.writeUInt32LE(x2, 4); r.writeUInt32LE(x3, 8); r.writeUInt32LE(x4, 12); return r;
    };
    let buf = block;
    buf = rdA(buf, subKeys[0], GTA5_NG_TABLES[0]); buf = rdA(buf, subKeys[1], GTA5_NG_TABLES[1]);
    for (let k = 2; k <= 15; k++) buf = rdB(buf, subKeys[k], GTA5_NG_TABLES[k]);
    buf = rdA(buf, subKeys[16], GTA5_NG_TABLES[16]);
    return buf;
}

function ngDecrypt(data, keyBuf) {
    const out = Buffer.from(data);
    for (let b = 0; b < Math.floor(data.length / 16); b++) ngDecryptBlock(data.slice(b * 16, b * 16 + 16), keyBuf).copy(out, b * 16);
    return out;
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
        let key = null;
        const idx = ((gta5Hash(filename) + rpfBuffer.length + 61) >>> 0) % 101;
        const test = ngDecryptBlock(encBlock.slice(0, 16), GTA5_NG_KEYS[idx]);
        if (test.readUInt16LE(0) === 0 && test.readUInt32LE(4) === 0x7FFFFF00) key = GTA5_NG_KEYS[idx];
        if (!key) for (let i = 0; i < 101; i++) {
            const t = ngDecryptBlock(encBlock.slice(0, 16), GTA5_NG_KEYS[i]);
            if (t.readUInt16LE(0) === 0 && t.readUInt32LE(4) === 0x7FFFFF00) { key = GTA5_NG_KEYS[i]; break; }
        }
        if (!key) throw new Error('NG Key not found');
        decBlock = ngDecrypt(encBlock, key);
    }
    const result = Buffer.from(rpfBuffer); result.writeUInt32LE(ENC_OPEN, 12); decBlock.copy(result, 16);
    if (encType === ENC_NG) {
        const nameTableStart = 16 + entryCount * 16;
        for (let i = 0; i < entryCount; i++) {
            const eOff = 16 + i * 16; if (result.readUInt32LE(eOff + 4) === 0x7FFFFF00) continue;
            const nameOff = result.readUInt16LE(eOff); let name = ''; let p = nameTableStart + nameOff;
            while (p < nameTableStart + namesLength && result[p] !== 0) name += String.fromCharCode(result[p++]);
            const page = result[eOff+5] | (result[eOff+6]<<8) | (result[eOff+7]<<16);
            const size = result.readUInt32LE(eOff + 8);
            if (page > 0 && size > 0 && page * 512 + size <= result.length) {
                const kIdx = ((gta5Hash(name.toLowerCase()) + size + 61) >>> 0) % 101;
                ngDecrypt(result.slice(page * 512, page * 512 + size), GTA5_NG_KEYS[kIdx]).copy(result, page * 512);
            }
        }
    }
    return result;
}

/**
 * IMPROVED: High-compatibility AWC Generator (v30)
 * Uses standard PCM 16-bit 32000Hz (highly compatible with GTA V weapons).
 */
function wavToAwc(wavBuffer, streamId) {
    let fmtOffset = 12; while (wavBuffer.toString('utf8', fmtOffset, fmtOffset + 4) !== 'fmt ') fmtOffset += 8 + wavBuffer.readUInt32LE(fmtOffset + 4);
    const channels = wavBuffer.readUInt16LE(fmtOffset + 10);
    const sampleRate = wavBuffer.readUInt32LE(fmtOffset + 12);
    let dataOffset = 12; while (wavBuffer.toString('utf8', dataOffset, dataOffset + 4) !== 'data') dataOffset += 8 + wavBuffer.readUInt32LE(dataOffset + 4);
    const dataSize = wavBuffer.readUInt32LE(dataOffset + 4);
    const audioData = wavBuffer.slice(dataOffset + 8, dataOffset + 8 + dataSize);
    const numSamples = dataSize / (channels * 2);
    
    // We use 0x800 (2048) alignment for the data part
    const headerSize = 2048; 
    const awc = Buffer.alloc(headerSize + audioData.length);
    
    // Header
    awc.write('ADAT', 0);
    awc.writeUInt32LE(0xFF000001, 4); 
    awc.writeUInt32LE(1, 8); // Stream Count
    awc.writeUInt32LE(32, 12); // Offset to tags
    
    // Stream ID (Hash)
    awc.writeUInt32LE((2 << 29) | (streamId & 0x1FFFFFFF), 16);
    
    // Tags for SFX (0xFA) and Data (0x55)
    const sfxInfoOff = 64; 
    
    // Tag 0xFA (SFX Info)
    // Offset 28 bits, Size 28 bits.
    // Word 1: [Size 4 bits low] [Offset 28 bits]
    // Word 2: [Type 8 bits] [Size 24 bits high]
    const writeTag = (type, size, offset, writePos) => {
        awc.writeUInt32LE((offset & 0x0FFFFFFF) | ((size & 0xF) << 28), writePos);
        awc.writeUInt32LE(((size >>> 4) & 0x00FFFFFF) | (type << 24), writePos + 4);
    };
    
    writeTag(0xFA, 28, sfxInfoOff, 20); // 28 bytes of SFX info
    writeTag(0x55, audioData.length, headerSize, 28); // Audio data
    
    // SFX Info block
    awc.writeUInt32LE(numSamples, sfxInfoOff);
    awc.writeInt32LE(-1, sfxInfoOff + 4); // Loop
    awc.writeUInt16LE(sampleRate, sfxInfoOff + 8);
    awc.writeUInt8(0x00, sfxInfoOff + 24); // PCM Codec
    
    audioData.copy(awc, headerSize);
    
    return awc.slice(0, headerSize + audioData.length);
}

function convertToWav(buf) {
    const tmpIn = path.join(os.tmpdir(), `in_${Date.now()}`); const tmpOut = path.join(os.tmpdir(), `out_${Date.now()}.wav`);
    return new Promise((resolve, reject) => {
        fs.writeFileSync(tmpIn, buf);
        // Using 32000Hz Mono for best weapon compatibility
        exec(`ffmpeg -y -i "${tmpIn}" -ac 1 -ar 32000 -c:a pcm_s16le "${tmpOut}"`, (err) => {
            if (err) return reject(new Error('ffmpeg error'));
            const b = fs.readFileSync(tmpOut); fs.unlinkSync(tmpIn); fs.unlinkSync(tmpOut); resolve(b);
        });
    });
}

function replaceAllAwcInRpf(rpfBuffer, wavBuf) {
    const entryCount = rpfBuffer.readUInt32LE(4);
    const namesLength = rpfBuffer.readUInt32LE(8);
    const nameTableStart = 16 + entryCount * 16;
    
    let currentPos = Math.ceil(rpfBuffer.length / 512) * 512;
    const output = Buffer.from(rpfBuffer);
    output.writeUInt32LE(ENC_OPEN, 12);

    const newAwcs = [];
    for (let i = 0; i < entryCount; i++) {
        const eOff = 16 + i * 16;
        if (output.readUInt32LE(eOff + 4) === 0x7FFFFF00) continue;
        const nameOff = output.readUInt16LE(eOff);
        let name = ''; let p = nameTableStart + nameOff;
        while (p < nameTableStart + namesLength && output[p] !== 0) name += String.fromCharCode(output[p++]);

        if (name.toLowerCase().endsWith('.awc')) {
            const page = output[eOff+5] | (output[eOff+6]<<8) | (output[eOff+7]<<16);
            const size = output.readUInt32LE(eOff + 8);
            if (page > 0 && size >= 20) {
                const originalAwc = output.slice(page * 512, page * 512 + size);
                const streamId = originalAwc.readUInt32LE(0x10) & 0x1FFFFFFF;
                const newAwc = wavToAwc(wavBuf, streamId);
                newAwcs.push({ entryOffset: eOff, name, data: newAwc, pos: currentPos });
                currentPos += Math.ceil(newAwc.length / 512) * 512;
            }
        }
    }

    if (newAwcs.length === 0) return output;
    const finalBuffer = Buffer.alloc(currentPos);
    output.copy(finalBuffer, 0);
    for (const awc of newAwcs) {
        awc.data.copy(finalBuffer, awc.pos);
        const p = awc.pos / 512;
        finalBuffer[awc.entryOffset + 5] = p & 0xFF;
        finalBuffer[awc.entryOffset + 6] = (p >> 8) & 0xFF;
        finalBuffer[awc.entryOffset + 7] = (p >> 16) & 0xFF;
        finalBuffer.writeUInt32LE(awc.data.length, awc.entryOffset + 8);
        console.log(`[v30] Replaced ${awc.name} (${awc.data.length} bytes)`);
    }
    return finalBuffer;
}

app.post('/api/Sound/inject', upload.fields([{ name: 'audio' }, { name: 'rpf' }]), async (req, res) => {
    const audioFile = req.files?.['audio']?.[0];
    let rpfFile = req.files?.['rpf']?.[0];
    const useTemplate = req.body.useTemplate === 'true';
    if (!audioFile) return res.status(400).send('Falta el audio.');
    try {
        const wavBuf = await convertToWav(audioFile.buffer);
        let rpfBuffer = useTemplate ? fs.readFileSync(RESIDENT_RPF_PATH) : rpfFile.buffer;
        let rpfName = useTemplate ? 'RESIDENT.rpf' : rpfFile.originalname;
        const encType = rpfBuffer.readUInt32LE(12);
        if (encType === ENC_AES || encType === ENC_NG) rpfBuffer = openRpfBuffer(rpfBuffer, encType, rpfName);
        const modifiedRpf = replaceAllAwcInRpf(rpfBuffer, wavBuf);
        const zip = new AdmZip(); zip.addFile(`LHC Sound boost/${rpfName}`, modifiedRpf);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="LHC_Sound_Boost.zip"`);
        res.send(zip.toBuffer());
    } catch (e) { console.error('[v30] Error:', e); res.status(500).send(e.message); }
});

// Weapon Converter original v19 logic
app.post('/api/WeaponConverter/convert', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    const targetId = (req.body.targetWeapon || '').toLowerCase().trim();
    const sourceId = (req.body.sourceWeapon || '').toLowerCase().trim();
    const original = req.file.buffer;
    try {
        const rpfHeaders = []; let searchPos = 0;
        while ((searchPos = original.indexOf(RPF_MAGIC, searchPos)) !== -1) {
            const entryCount = original.readUInt32LE(searchPos + 4); const namesLength = original.readUInt32LE(searchPos + 8); const encFlag = original.readUInt32LE(searchPos + 12);
            rpfHeaders.push({ offset: searchPos, entryCount, namesLength, encryption: encFlag, nameTableOffset: searchPos + 16 + entryCount * 16 });
            searchPos += 4;
        }
        let totalReplacements = 0; const output = Buffer.from(original);
        for (const rpf of rpfHeaders) {
            const names = []; let pos = rpf.nameTableOffset; const nameTableEnd = rpf.nameTableOffset + rpf.namesLength;
            while (pos < nameTableEnd) {
                let name = ''; const startPos = pos; while (pos < nameTableEnd && output[pos] !== 0) { name += String.fromCharCode(output[pos]); pos++; }
                names.push({ name, offset: startPos - rpf.nameTableOffset }); pos++;
            }
            let hasChanges = false;
            const newNames = names.map(n => {
                let newName = n.name; if (newName.toLowerCase().includes(sourceId)) {
                    newName = newName.replace(new RegExp(sourceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), targetId);
                    hasChanges = true;
                }
                return { ...n, newName };
            });
            if (!hasChanges) continue;
            let writePos = rpf.nameTableOffset; const newOffsets = [];
            for (const n of newNames) {
                newOffsets.push(writePos - rpf.nameTableOffset);
                const nameBuf = Buffer.from(n.newName, 'ascii'); nameBuf.copy(output, writePos);
                writePos += nameBuf.length; output[writePos++] = 0;
                if (n.name !== n.newName) totalReplacements++;
            }
            for (let i = 0; i < rpf.entryCount; i++) {
                const entryOffset = rpf.offset + 16 + (i * 16); const currentNameOff = output.readUInt16LE(entryOffset);
                for (let j = 0; j < names.length; j++) { if (names[j].offset === currentNameOff) { output.writeUInt16LE(newOffsets[j], entryOffset); break; } }
            }
        }
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${targetId}.rpf"`);
        res.setHeader('X-Replacement-Count', String(totalReplacements));
        res.setHeader('Access-Control-Expose-Headers', 'X-Replacement-Count');
        res.send(output);
    } catch (e) { res.status(500).send(e.message); }
});

app.listen(port, '0.0.0.0', () => console.log(`[v30] API Ready on port ${port}`));
