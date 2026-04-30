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
const zlib     = require('zlib');

const app  = express();
const port = 5000;
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload  = multer({ storage, limits: { fileSize: 250 * 1024 * 1024 } });

const RPF_MAGIC = Buffer.from([0x37, 0x46, 0x50, 0x52]);
const ENC_OPEN  = 0x4E45504F;
const ENC_AES   = 0x0FFFFFF9;
const ENC_NG    = 0x0FEFFFFF;
const KEYS_DIR  = '/opt/lhc-keys';
const RESIDENT_RPF_PATH = '/opt/lhc-sound/RESIDENT.rpf';

let GTA5_AES_KEY = null, GTA5_NG_KEYS = null, GTA5_NG_TABLES = null, GTA5_HASH_LUT = null;

function loadKeys() {
    try {
        const aesPath = path.join(KEYS_DIR, 'gtav_aes_key.dat');
        if (fs.existsSync(aesPath)) GTA5_AES_KEY = fs.readFileSync(aesPath);
        const ngKeyRaw = fs.readFileSync(path.join(KEYS_DIR, 'gtav_ng_key.dat'));
        GTA5_NG_KEYS = []; for (let i = 0; i < 101; i++) GTA5_NG_KEYS.push(ngKeyRaw.slice(i * 272, (i + 1) * 272));
        const ngTabRaw = fs.readFileSync(path.join(KEYS_DIR, 'gtav_ng_decrypt_tables.dat'));
        GTA5_NG_TABLES = []; let off = 0;
        for (let r = 0; r < 17; r++) {
            GTA5_NG_TABLES[r] = [];
            for (let t = 0; t < 16; t++) {
                const table = new Uint32Array(256);
                for (let e = 0; e < 256; e++) { table[e] = ngTabRaw.readUInt32LE(off); off += 4; }
                GTA5_NG_TABLES[r].push(table);
            }
        }
        GTA5_HASH_LUT = fs.readFileSync(path.join(KEYS_DIR, 'gtav_hash_lut.dat'));
        console.log('[v49] Keys loaded');
    } catch (e) { console.error('[v49] Key load error:', e.message); }
}
loadKeys();

function gta5Hash(text) {
    let result = 0;
    for (let i = 0; i < text.length; i++) {
        const c = GTA5_HASH_LUT ? GTA5_HASH_LUT[text.charCodeAt(i) & 0xFF] : (text.charCodeAt(i) | 0x20) & 0xFF;
        result = ((Math.imul(1025, (c + result) >>> 0) >>> 0) >>> 6 ^ Math.imul(1025, (c + result) >>> 0) >>> 0) >>> 0;
    }
    const r9 = Math.imul(9, result) >>> 0;
    return Math.imul(32769, ((r9 >>> 11) ^ r9) >>> 0) >>> 0;
}

function ngDecryptBlock(block, keyBuf) {
    const sk = []; for (let i = 0; i < 17; i++) sk.push([keyBuf.readUInt32LE(i*16), keyBuf.readUInt32LE(i*16+4), keyBuf.readUInt32LE(i*16+8), keyBuf.readUInt32LE(i*16+12)]);
    const rdA = (d,s,t) => { const r=Buffer.allocUnsafe(16); r.writeUInt32LE((t[0][d[0]]^t[1][d[1]]^t[2][d[2]]^t[3][d[3]]^s[0])>>>0,0); r.writeUInt32LE((t[4][d[4]]^t[5][d[5]]^t[6][d[6]]^t[7][d[7]]^s[1])>>>0,4); r.writeUInt32LE((t[8][d[8]]^t[9][d[9]]^t[10][d[10]]^t[11][d[11]]^s[2])>>>0,8); r.writeUInt32LE((t[12][d[12]]^t[13][d[13]]^t[14][d[14]]^t[15][d[15]]^s[3])>>>0,12); return r; };
    const rdB = (d,s,t) => { const r=Buffer.allocUnsafe(16); r.writeUInt32LE((t[0][d[0]]^t[7][d[7]]^t[10][d[10]]^t[13][d[13]]^s[0])>>>0,0); r.writeUInt32LE((t[1][d[1]]^t[4][d[4]]^t[11][d[11]]^t[14][d[14]]^s[1])>>>0,4); r.writeUInt32LE((t[2][d[2]]^t[5][d[5]]^t[8][d[8]]^t[15][d[15]]^s[2])>>>0,8); r.writeUInt32LE((t[3][d[3]]^t[6][d[6]]^t[9][d[9]]^t[12][d[12]]^s[3])>>>0,12); return r; };
    let b = block;
    b = rdA(b, sk[0], GTA5_NG_TABLES[0]); b = rdA(b, sk[1], GTA5_NG_TABLES[1]);
    for (let k = 2; k <= 15; k++) b = rdB(b, sk[k], GTA5_NG_TABLES[k]);
    return rdA(b, sk[16], GTA5_NG_TABLES[16]);
}

function ngDecrypt(data, keyBuf) {
    const out = Buffer.from(data);
    for (let i = 0; i < Math.floor(data.length / 16); i++) ngDecryptBlock(data.slice(i*16, i*16+16), keyBuf).copy(out, i*16);
    return out;
}

function decryptRpfHeader(rpfBuf, encType, filename) {
    const entryCount = rpfBuf.readUInt32LE(4), namesLength = rpfBuf.readUInt32LE(8), headerLen = entryCount * 16 + namesLength;
    const enc = rpfBuf.slice(16, 16 + headerLen);
    if (encType === ENC_AES) {
        const d = crypto.createDecipheriv('aes-256-ecb', GTA5_AES_KEY, null); d.setAutoPadding(false);
        const dec = Buffer.concat([d.update(enc.slice(0, Math.floor(enc.length/16)*16)), d.final()]);
        return enc.length % 16 ? Buffer.concat([dec, enc.slice(dec.length)]) : dec;
    } else {
        let key = null;
        const testNames = [filename, 'WEAPONS_PLAYER.rpf', 'RESIDENT.rpf', 'WEAPONS.rpf'];
        for (const tn of testNames) {
            const idx = ((gta5Hash(tn.toLowerCase()) + rpfBuf.length + 61) >>> 0) % 101;
            const t = ngDecryptBlock(enc.slice(0,16), GTA5_NG_KEYS[idx]);
            if (t.readUInt16LE(0) === 0 && t.readUInt32LE(4) === 0x7FFFFF00) { key = GTA5_NG_KEYS[idx]; break; }
        }
        if (!key) for (let i = 0; i < 101; i++) {
            const t = ngDecryptBlock(enc.slice(0,16), GTA5_NG_KEYS[i]);
            if (t.readUInt16LE(0) === 0 && t.readUInt32LE(4) === 0x7FFFFF00) { key = GTA5_NG_KEYS[i]; break; }
        }
        if (!key) return enc.readUInt16LE(0) === 0 && enc.readUInt32LE(4) === 0x7FFFFF00 ? enc : null;
        return ngDecrypt(enc, key);
    }
}

function replaceAudioInAwc(awcBuf, pcmData) {
    const magic = Buffer.from('ADAT');
    let adatOff = awcBuf.indexOf(magic);
    if (adatOff === -1) {
        const pk = Buffer.alloc(4); for(let i=0; i<4; i++) pk[i] = awcBuf[i] ^ magic[i];
        const tb = Buffer.alloc(32); for(let i=0; i<32; i++) tb[i] = awcBuf[i] ^ pk[i % 4];
        if (tb.toString('utf8', 0, 4) === 'ADAT') {
            const x = Buffer.alloc(awcBuf.length); for(let i=0; i<awcBuf.length; i++) x[i] = awcBuf[i] ^ pk[i % 4];
            awcBuf = x; adatOff = 0;
        } else return null;
    }
    const sub = awcBuf.slice(adatOff);
    if (sub.length < 16) return null;
    const streamCount = sub.readUInt32LE(8);
    let pos = 16; const streams = [];
    for (let i = 0; i < streamCount; i++) { streams.push({ tc: (sub.readUInt32LE(pos) >>> 29) & 0x7, tags: [] }); pos += 4; }
    for (const s of streams) {
        for (let t = 0; t < s.tc; t++) {
            const w1 = sub.readUInt32LE(pos), w2 = sub.readUInt32LE(pos + 4);
            s.tags.push({ type: (w2 >>> 24) & 0xFF, off: w1 & 0x0FFFFFFF, size: ((w1 >>> 28) & 0xF) | ((w2 & 0x00FFFFFF) << 4) });
            pos += 8;
        }
    }
    let replaced = false;
    for (const s of streams) {
        let dataTag = null, fmtTag = null;
        for (const t of s.tags) { if (t.type === 0x55) dataTag = t; if (t.type === 0xFA) fmtTag = t; }
        if (!dataTag || dataTag.off + dataTag.size > sub.length) continue;
        const toW = pcmData.slice(0, dataTag.size); toW.copy(sub, dataTag.off);
        if (toW.length < dataTag.size) sub.fill(0, dataTag.off + toW.length, dataTag.off + dataTag.size);
        if (fmtTag && fmtTag.off + 4 <= sub.length) sub.writeUInt32LE(Math.floor(toW.length / 2), fmtTag.off);
        replaced = true;
    }
    return replaced ? awcBuf : null;
}

function extractPcmFromWav(wavBuf) {
    let off = 12;
    while (off + 8 < wavBuf.length && wavBuf.toString('utf8', off, off + 4) !== 'data') off += 8 + wavBuf.readUInt32LE(off + 4);
    return wavBuf.slice(off + 8, off + 8 + (wavBuf.readUInt32LE(off + 4) || 0));
}

function convertToWav(buf, sr) {
    const tmpIn = path.join(os.tmpdir(), `in_${Date.now()}`), tmpOut = path.join(os.tmpdir(), `out_${Date.now()}.wav`);
    return new Promise((res, rej) => {
        fs.writeFileSync(tmpIn, buf);
        exec(`ffmpeg -y -i "${tmpIn}" -ac 1 -ar ${sr || 32000} -c:a pcm_s16le "${tmpOut}"`, (e) => {
            if (e) return rej(new Error('ffmpeg error'));
            const b = fs.readFileSync(tmpOut); fs.unlinkSync(tmpIn); fs.unlinkSync(tmpOut); res(b);
        });
    });
}

function processRpf(rpfBuf, pcmData, filename) {
    const encType = rpfBuf.readUInt32LE(12), entryCount = rpfBuf.readUInt32LE(4), namesLength = rpfBuf.readUInt32LE(8);
    const decHeader = decryptRpfHeader(rpfBuf, encType, filename);
    if (!decHeader) throw new Error('Header decryption failed');
    const result = Buffer.from(rpfBuf); decHeader.copy(result, 16);
    const nameTableStart = entryCount * 16;
    let count = 0;
    for (let i = 0; i < entryCount; i++) {
        const eOff = i * 16; if (decHeader.readUInt32LE(eOff + 4) === 0x7FFFFF00) continue;
        let name = '', p = nameTableStart + decHeader.readUInt16LE(eOff);
        while (p < nameTableStart + namesLength && decHeader[p] !== 0) name += String.fromCharCode(decHeader[p++]);
        const page = decHeader[eOff+5] | (decHeader[eOff+6]<<8) | (decHeader[eOff+7]<<16);
        const us = decHeader.readUInt32LE(eOff + 8), cs = decHeader[eOff+2] | (decHeader[eOff+3]<<8) | (decHeader[eOff+4]<<16);
        const as = cs > 0 ? cs : us;
        if (page > 0 && as > 0 && page * 512 + as <= rpfBuf.length) {
            const sector = rpfBuf.slice(page * 512, page * 512 + as);
            let decFile = null;
            if (sector.indexOf(Buffer.from('ADAT')) !== -1) decFile = sector;
            else {
                const kIdx = ((gta5Hash(name.toLowerCase()) + (cs > 0 ? cs : us) + 61) >>> 0) % 101;
                let tNg = ngDecrypt(sector, GTA5_NG_KEYS[kIdx]);
                if (tNg.indexOf(Buffer.from('ADAT')) !== -1 || (cs > 0 && tNg[0] === 0x78)) decFile = tNg;
                if (!decFile && GTA5_AES_KEY) {
                    const d = crypto.createDecipheriv('aes-256-ecb', GTA5_AES_KEY, null); d.setAutoPadding(false);
                    const al = Math.floor(sector.length/16)*16;
                    if (al >= 16) {
                        let tAes = Buffer.concat([d.update(sector.slice(0, al)), d.final()]);
                        if (sector.length%16) tAes = Buffer.concat([tAes, sector.slice(al)]);
                        if (tAes.indexOf(Buffer.from('ADAT')) !== -1 || (cs > 0 && tAes[0] === 0x78)) decFile = tAes;
                    }
                }
            }
            if (decFile) {
                let working = decFile;
                if (cs > 0 && decFile[0] === 0x78) { try { working = zlib.inflateRawSync(decFile); } catch(e){} }
                if (name.toLowerCase().endsWith('.awc')) {
                    const mod = replaceAudioInAwc(working, pcmData);
                    if (mod) { 
                        mod.copy(result, page * 512); count++; 
                        console.log(`[v49] ✓ ${name}`);
                        // Important: if we modified it, we MUST make it uncompressed in result
                        decHeader[eOff+2]=0; decHeader[eOff+3]=0; decHeader[eOff+4]=0; // cs = 0
                        decHeader.writeUInt32LE(mod.length, eOff + 8); // us = new length
                    }
                } else if (decFile !== sector) decFile.copy(result, page * 512);
            }
        }
    }
    decHeader.copy(result, 16);
    const cipher = crypto.createCipheriv('aes-256-ecb', GTA5_AES_KEY, null); cipher.setAutoPadding(false);
    const hLen = entryCount * 16 + namesLength, alLen = Math.floor(hLen/16)*16;
    const encH = Buffer.concat([cipher.update(result.slice(16, 16 + alLen)), cipher.final()]);
    encH.copy(result, 16); result.writeUInt32LE(ENC_AES, 12);
    console.log(`[v49] Final: Replaced in ${count} files`);
    return result;
}

async function handleInject(req, res) {
    let rpf = null, audio = null;
    for (const f of (req.files || [])) {
        if (f.buffer && f.buffer.length > 16 && f.buffer.slice(0, 4).equals(RPF_MAGIC)) rpf = f;
        else if (f.buffer) audio = f;
    }
    if (!audio || (!rpf && req.body.useTemplate !== 'true')) return res.status(400).send('Missing files');
    try {
        const pcm = extractPcmFromWav(await convertToWav(audio.buffer, 32000));
        const buf = req.body.useTemplate === 'true' ? fs.readFileSync(RESIDENT_RPF_PATH) : rpf.buffer;
        const name = rpf ? rpf.originalname : 'RESIDENT.rpf';
        const mod = processRpf(buf, pcm, name);
        const zip = new AdmZip(); zip.addFile(`LHC Sound boost/${name}`, mod);
        res.setHeader('Content-Type', 'application/zip'); res.setHeader('Content-Disposition', `attachment; filename="LHC_Sound_Boost.zip"`);
        res.send(zip.toBuffer());
    } catch (e) { console.error(`[v49] Error:`, e); res.status(500).send(e.message); }
}

app.post('/api/Sound/inject', upload.any(), handleInject);
app.post('/api/SoundInjector/inject', upload.any(), handleInject);
app.listen(port, '0.0.0.0', () => console.log(`[v49] API Ready on port ${port}`));
