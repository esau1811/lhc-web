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
        console.log('[v26] Keys loaded');
    } catch (e) { console.error('[v26] Key load error:', e.message); }
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

function wavToAwc(wavBuffer, streamId) {
    let fmtOffset = 12; while (wavBuffer.toString('utf8', fmtOffset, fmtOffset + 4) !== 'fmt ') fmtOffset += 8 + wavBuffer.readUInt32LE(fmtOffset + 4);
    const channels = wavBuffer.readUInt16LE(fmtOffset + 10);
    const sampleRate = wavBuffer.readUInt32LE(fmtOffset + 12);
    let dataOffset = 12; while (wavBuffer.toString('utf8', dataOffset, dataOffset + 4) !== 'data') dataOffset += 8 + wavBuffer.readUInt32LE(dataOffset + 4);
    const dataSize = wavBuffer.readUInt32LE(dataOffset + 4);
    const audioData = wavBuffer.slice(dataOffset + 8, dataOffset + 8 + dataSize);
    const numSamples = dataSize / (channels * 2);
    const dataAlign = 2048;
    const awc = Buffer.alloc(dataAlign + audioData.length);
    awc.write('ADAT', 0); awc.writeUInt32LE(0xFF000001, 4); awc.writeUInt32LE(1, 8);
    awc.writeUInt32LE((2 << 29) | (streamId & 0x1FFFFFFF), 16);
    const sfxOff = 32; awc.writeUInt32LE(numSamples, sfxOff); awc.writeInt32LE(-1, sfxOff + 4); awc.writeUInt16LE(sampleRate, sfxOff + 8); awc.writeUInt8(0x00, sfxOff + 24);
    audioData.copy(awc, dataAlign);
    const writeTag = (type, size, offset, writeOff) => {
        awc.writeUInt32LE(((offset & 0x0FFFFFFF) | ((size & 0xF) << 28)) >>> 0, writeOff);
        awc.writeUInt32LE(((size >>> 4) | (type << 24)) >>> 0, writeOff + 4);
    };
    writeTag(0xFA, 0x18, sfxOff, 20); writeTag(0x55, audioData.length, dataAlign, 28);
    awc.writeUInt32LE(sfxOff + 0x18, 12);
    return awc.slice(0, dataAlign + audioData.length);
}

// ── SOUND INJECT ENDPOINT ───────────────────────────────────────────────────
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
        res.setHeader('Content-Type', 'application/zip'); res.setHeader('Content-Disposition', `attachment; filename="LHC_Sound_Boost.zip"`);
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

function replaceAllAwcInRpf(rpfBuffer, wavBuf) {
    const entryCount = rpfBuffer.readUInt32LE(4);
    const namesLength = rpfBuffer.readUInt32LE(8);
    const nameTableStart = 16 + entryCount * 16;
    const entries = [];
    for (let i = 0; i < entryCount; i++) {
        const eOff = 16 + i * 16; const nameOff = rpfBuffer.readUInt16LE(eOff); const w4 = rpfBuffer.readUInt32LE(eOff + 4);
        let name = ''; let p = nameTableStart + nameOff; while (p < nameTableStart + namesLength && rpfBuffer[p] !== 0) name += String.fromCharCode(rpfBuffer[p++]);
        const page = rpfBuffer[eOff+5] | (rpfBuffer[eOff+6]<<8) | (rpfBuffer[eOff+7]<<16); const size = rpfBuffer.readUInt32LE(eOff + 8);
        let data = (w4 !== 0x7FFFFF00 && page > 0) ? Buffer.from(rpfBuffer.slice(page * 512, page * 512 + size)) : null;
        entries.push({ name, data, isDir: (w4 === 0x7FFFFF00), eOff });
    }
    entries.forEach(e => { if (!e.isDir && e.name.toLowerCase().endsWith('.awc') && e.data && e.data.length >= 20) e.data = wavToAwc(wavBuf, e.data.readUInt32LE(0x10) & 0x1FFFFFFF); });
    const newDataStart = Math.ceil((nameTableStart + namesLength) / 512) * 512;
    let cur = newDataStart;
    const totalSize = newDataStart + entries.reduce((a,e) => a + (e.isDir || !e.data ? 0 : Math.ceil(e.data.length/512)*512), 0);
    const output = Buffer.alloc(totalSize);
    rpfBuffer.copy(output, 0, 0, nameTableStart + namesLength);
    output.writeUInt32LE(ENC_OPEN, 12);
    entries.forEach((e, i) => {
        if (e.isDir || !e.data) return;
        const p = cur / 512; e.data.copy(output, cur);
        const ep = 16 + i * 16; output[ep+5]=p&0xFF; output[ep+6]=(p>>8)&0xFF; output[ep+7]=(p>>16)&0xFF;
        output.writeUInt32LE(e.data.length, ep+8);
        output[ep+2]=e.data.length&0xFF; output[ep+3]=(e.data.length>>8)&0xFF; output[ep+4]=(e.data.length>>16)&0xFF;
        cur += Math.ceil(e.data.length / 512) * 512;
    });
    return output;
}

// ── WEAPON CONVERTER ENDPOINT ────────────────────────────────────────────────
app.post('/api/WeaponConverter/convert', upload.single('file'), (req, res) => {
    console.log(`[v26] Converter request: ${req.file?.originalname}`);
    if (!req.file) return res.status(400).send('No file uploaded.');
    
    const targetWeaponId = (req.body.targetWeapon || '').toLowerCase().trim();
    const sourceWeaponId = (req.body.sourceWeapon || '').toLowerCase().trim();
    if (!targetWeaponId) return res.status(400).send('Missing target weapon ID.');

    // Helper for short IDs
    const getShort = (id) => id.replace(/^w_[a-z]{2}_/, '').replace(/_/g, '');
    const sourceShort = getShort(sourceWeaponId);
    const targetShort = getShort(targetWeaponId);
    const sourceMid = sourceWeaponId.replace(/^w_/, '');
    const targetMid = targetWeaponId.replace(/^w_/, '');

    const original = req.file.buffer;
    try {
        const rpfHeaders = []; let searchPos = 0;
        while ((searchPos = original.indexOf(RPF_MAGIC, searchPos)) !== -1) {
            const ec = original.readUInt32LE(searchPos + 4); const nl = original.readUInt32LE(searchPos + 8); const ef = original.readUInt32LE(searchPos + 12);
            let enc = (ef === ENC_OPEN) ? 'OPEN' : (ef === ENC_AES ? 'AES' : (ef === ENC_NG ? 'NG' : (ef === 0 ? 'NONE' : 'UNK')));
            rpfHeaders.push({ offset: searchPos, entryCount: ec, namesLength: nl, encryption: enc, nameTableOffset: searchPos + 16 + ec * 16 });
            searchPos += 4;
        }

        let totalReplacements = 0;
        const output = Buffer.from(original);

        for (const rpf of rpfHeaders) {
            if (rpf.encryption !== 'OPEN' && rpf.encryption !== 'NONE') {
                console.log(`[v26] Skipping encrypted RPF at 0x${rpf.offset.toString(16)}`);
                continue;
            }

            const nameTableStart = rpf.nameTableOffset;
            const nameTableEnd = nameTableStart + rpf.namesLength;
            const names = []; let pos = nameTableStart;
            while (pos < nameTableEnd) {
                let name = ''; const start = pos; while (pos < nameTableEnd && output[pos] !== 0) { name += String.fromCharCode(output[pos]); pos++; }
                names.push({ name, offset: start - nameTableStart }); pos++;
            }
            
            console.log(`[v26] RPF at 0x${rpf.offset.toString(16)} names:`, names.map(n => n.name).slice(0, 5).join(', '));

            let hasChanges = false;
            const newNames = names.map(n => {
                let newName = n.name;
                const replaceCase = (src, tgt) => {
                    if (newName.toLowerCase().includes(src)) {
                        newName = newName.replace(new RegExp(src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), tgt);
                        hasChanges = true;
                    }
                };
                replaceCase(sourceWeaponId, targetWeaponId);
                replaceCase(sourceMid, targetMid);
                if (sourceShort.length >= 4) replaceCase(sourceShort, targetShort);
                return { ...n, newName };
            });

            if (!hasChanges) continue;

            const newTableSize = newNames.reduce((s, n) => s + n.newName.length + 1, 0);
            if (newTableSize > rpf.namesLength) {
                const padding = Math.ceil((rpf.nameTableOffset + rpf.namesLength) / 512) * 512 - (rpf.nameTableOffset + rpf.namesLength);
                if (newTableSize - rpf.namesLength <= padding) {
                    output.writeUInt32LE(newTableSize, rpf.offset + 8);
                } else {
                    console.log(`[v26] Table too large for RPF at 0x${rpf.offset.toString(16)} (+${newTableSize - rpf.namesLength})`);
                    continue; 
                }
            }

            let wp = rpf.nameTableOffset; const newOffsets = [];
            for (const n of newNames) {
                newOffsets.push(wp - rpf.nameTableOffset);
                const nb = Buffer.from(n.newName, 'ascii'); nb.copy(output, wp); wp += nb.length; output[wp++] = 0;
                if (n.name !== n.newName) totalReplacements++;
            }
            
            for (let i = 0; i < rpf.entryCount; i++) {
                const eo = rpf.offset + 16 + (i * 16); const cno = output.readUInt16LE(eo);
                for (let j = 0; j < names.length; j++) { if (names[j].offset === cno) { output.writeUInt16LE(newOffsets[j], eo); break; } }
            }
        }

        // Binary patching (all variations)
        const binaryPatch = (src, tgt) => {
            if (!src || !tgt) return;
            const srcB = Buffer.from(src, 'ascii'); const tgtB = Buffer.from(tgt, 'ascii');
            const limit = Math.min(srcB.length, tgtB.length);
            let o = 0;
            while ((o = output.indexOf(srcB, o)) !== -1) {
                let inNT = false; for (const rpf of rpfHeaders) { if (o >= rpf.nameTableOffset && o < rpf.nameTableOffset + rpf.namesLength) { inNT = true; break; } }
                if (!inNT) {
                    tgtB.copy(output, o, 0, limit);
                    if (tgtB.length < srcB.length) output.fill(0, o + tgtB.length, o + srcB.length);
                    totalReplacements++;
                }
                o += srcB.length;
            }
        };
        binaryPatch(sourceWeaponId, targetWeaponId);
        binaryPatch(sourceMid, targetMid);
        if (sourceShort.length >= 4) binaryPatch(sourceShort, targetShort);

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${targetShort}.rpf"`);
        res.setHeader('X-Replacement-Count', String(totalReplacements));
        res.send(output);
        console.log(`[v26] Converter success: ${totalReplacements} replacements`);
    } catch (e) { console.error('[v26] Converter error:', e); res.status(500).send(e.message); }
});

app.listen(port, '0.0.0.0', () => console.log(`[v26] API Ready`));
