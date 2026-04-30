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
        console.log('[v48] Keys loaded');
    } catch (e) { console.error('[v48] Key load error:', e.message); }
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
    const entryCount = rpfBuf.readUInt32LE(4);
    const namesLength = rpfBuf.readUInt32LE(8);
    const headerLen = entryCount * 16 + namesLength;
    const enc = rpfBuf.slice(16, 16 + headerLen);
    let dec;
    if (encType === ENC_AES) {
        const d = crypto.createDecipheriv('aes-256-ecb', GTA5_AES_KEY, null); d.setAutoPadding(false);
        dec = Buffer.concat([d.update(enc.slice(0, Math.floor(enc.length/16)*16)), d.final()]);
        if (enc.length % 16) dec = Buffer.concat([dec, enc.slice(dec.length)]);
    } else {
        let key = null;
        const testNames = [filename, 'WEAPONS_PLAYER.rpf', 'RESIDENT.rpf', 'WEAPONS.rpf'];
        for (const tn of testNames) {
            const idx = ((gta5Hash(tn.toLowerCase()) + rpfBuf.length + 61) >>> 0) % 101;
            const t = ngDecryptBlock(enc.slice(0,16), GTA5_NG_KEYS[idx]);
            if (t.readUInt16LE(0) === 0 && t.readUInt32LE(4) === 0x7FFFFF00) { key = GTA5_NG_KEYS[idx]; break; }
        }
        if (!key) {
            for (let i = 0; i < 101; i++) {
                const t = ngDecryptBlock(enc.slice(0,16), GTA5_NG_KEYS[i]);
                if (t.readUInt16LE(0) === 0 && t.readUInt32LE(4) === 0x7FFFFF00) { key = GTA5_NG_KEYS[i]; break; }
            }
        }
        if (!key) {
            // Check if it's already plaintext
            if (enc.readUInt16LE(0) === 0 && enc.readUInt32LE(4) === 0x7FFFFF00) return enc;
            throw new Error('Could not find NG key for RPF header');
        }
        dec = ngDecrypt(enc, key);
    }
    return dec;
}

function parseAwcTags(awcBuf) {
    if (awcBuf.length < 16) return null;
    if (awcBuf.toString('utf8', 0, 4) !== 'ADAT') return null;
    const streamCount = awcBuf.readUInt32LE(8);
    let pos = 16; const streams = [];
    for (let i = 0; i < streamCount; i++) {
        if (pos + 4 > awcBuf.length) return null;
        streams.push({ tagCount: (awcBuf.readUInt32LE(pos) >>> 29) & 0x7, tags: [] });
        pos += 4;
    }
    for (const s of streams) {
        for (let t = 0; t < s.tagCount; t++) {
            if (pos + 8 > awcBuf.length) return null;
            const w1 = awcBuf.readUInt32LE(pos), w2 = awcBuf.readUInt32LE(pos + 4);
            s.tags.push({ type: (w2 >>> 24) & 0xFF, offset: w1 & 0x0FFFFFFF, size: ((w1 >>> 28) & 0xF) | ((w2 & 0x00FFFFFF) << 4) });
            pos += 8;
        }
    }
    return streams;
}

function replaceAudioInAwc(awcBuf, pcmData, name) {
    let adatOff = awcBuf.indexOf(Buffer.from('ADAT'));
    if (adatOff === -1) {
        const magic = Buffer.from('ADAT'), possibleKey = Buffer.alloc(4);
        for(let i=0; i<4; i++) possibleKey[i] = awcBuf[i] ^ magic[i];
        const testBuf = Buffer.alloc(32); for(let i=0; i<32; i++) testBuf[i] = awcBuf[i] ^ possibleKey[i % 4];
        if (testBuf.toString('utf8', 0, 4) === 'ADAT') {
            const xored = Buffer.alloc(awcBuf.length); for(let i=0; i<awcBuf.length; i++) xored[i] = awcBuf[i] ^ possibleKey[i % 4];
            awcBuf = xored; adatOff = 0;
        } else return null;
    }
    const streams = parseAwcTags(awcBuf.slice(adatOff));
    if (!streams) return null;
    const modified = Buffer.from(awcBuf), subBuf = modified.slice(adatOff);
    let replaced = false;
    for (const stream of streams) {
        let dataTag = null, fmtTag = null;
        for (const tag of stream.tags) { if (tag.type === 0x55) dataTag = tag; if (tag.type === 0xFA) fmtTag = tag; }
        if (!dataTag || dataTag.offset + dataTag.size > subBuf.length) continue;
        const toWrite = pcmData.slice(0, dataTag.size);
        toWrite.copy(subBuf, dataTag.offset);
        if (toWrite.length < dataTag.size) subBuf.fill(0, dataTag.offset + toWrite.length, dataTag.offset + dataTag.size);
        if (fmtTag && fmtTag.offset + 4 <= subBuf.length) subBuf.writeUInt32LE(Math.floor(toWrite.length / 2), fmtTag.offset);
        replaced = true;
    }
    return replaced ? modified : null;
}

function extractPcmFromWav(wavBuf) {
    let off = 12;
    while (off + 8 < wavBuf.length && wavBuf.toString('utf8', off, off + 4) !== 'data') off += 8 + wavBuf.readUInt32LE(off + 4);
    return wavBuf.slice(off + 8, off + 8 + wavBuf.readUInt32LE(off + 4));
}

function convertToWav(buf, sampleRate) {
    const tmpIn = path.join(os.tmpdir(), `in_${Date.now()}`), tmpOut = path.join(os.tmpdir(), `out_${Date.now()}.wav`);
    return new Promise((resolve, reject) => {
        fs.writeFileSync(tmpIn, buf);
        exec(`ffmpeg -y -i "${tmpIn}" -ac 1 -ar ${sampleRate || 32000} -c:a pcm_s16le "${tmpOut}"`, (err) => {
            if (err) return reject(new Error('ffmpeg error'));
            const b = fs.readFileSync(tmpOut); fs.unlinkSync(tmpIn); fs.unlinkSync(tmpOut); resolve(b);
        });
    });
}

function fullyDecryptRpf(rpfBuf, encType, filename) {
    const entryCount = rpfBuf.readUInt32LE(4), namesLength = rpfBuf.readUInt32LE(8), result = Buffer.from(rpfBuf);
    const decHeader = decryptRpfHeader(rpfBuf, encType, filename); decHeader.copy(result, 16);
    const nameTableStart = entryCount * 16;
    if (encType === ENC_NG) {
        for (let i = 0; i < entryCount; i++) {
            const eOff = i * 16; if (decHeader.readUInt32LE(eOff + 4) === 0x7FFFFF00) continue;
            let name = '', p = nameTableStart + decHeader.readUInt16LE(eOff);
            while (p < nameTableStart + namesLength && decHeader[p] !== 0) name += String.fromCharCode(decHeader[p++]);
            const page = decHeader[eOff+5] | (decHeader[eOff+6]<<8) | (decHeader[eOff+7]<<16);
            const uncompressedSize = decHeader.readUInt32LE(eOff + 8), compressedSize = decHeader[eOff+2] | (decHeader[eOff+3]<<8) | (decHeader[eOff+4]<<16);
            const actualSize = compressedSize > 0 ? compressedSize : uncompressedSize;
            if (page > 0 && actualSize > 0 && page * 512 + actualSize <= rpfBuf.length) {
                const sector = rpfBuf.slice(page * 512, page * 512 + actualSize); let decryptedFile = null;
                if (sector.indexOf(Buffer.from('ADAT')) !== -1) decryptedFile = sector;
                else {
                    const sizesToTry = [actualSize, uncompressedSize];
                    for (const sToTry of sizesToTry) {
                        const kIdx = ((gta5Hash(name.toLowerCase()) + sToTry + 61) >>> 0) % 101;
                        let testNg = ngDecrypt(sector, GTA5_NG_KEYS[kIdx]);
                        if (testNg.indexOf(Buffer.from('ADAT')) !== -1 || (compressedSize > 0 && testNg[0] === 0x78)) { decryptedFile = testNg; break; }
                    }
                    if (!decryptedFile && GTA5_AES_KEY) {
                        const d = crypto.createDecipheriv('aes-256-ecb', GTA5_AES_KEY, null); d.setAutoPadding(false);
                        const alignedSize = Math.floor(sector.length / 16) * 16;
                        if (alignedSize >= 16) {
                            let testAes = Buffer.concat([d.update(sector.slice(0, alignedSize)), d.final()]);
                            if (sector.length % 16) testAes = Buffer.concat([testAes, sector.slice(alignedSize)]);
                            if (testAes.indexOf(Buffer.from('ADAT')) !== -1 || (compressedSize > 0 && testAes[0] === 0x78)) decryptedFile = testAes;
                        }
                    }
                }
                if (decryptedFile) {
                    if (compressedSize > 0 && decryptedFile[0] === 0x78) {
                        try { const decompressed = zlib.inflateRawSync(decryptedFile); decompressed.copy(result, page * 512); decHeader[eOff+2] = 0; decHeader[eOff+3] = 0; decHeader[eOff+4] = 0; } catch (e) { decryptedFile.copy(result, page * 512); }
                    } else decryptedFile.copy(result, page * 512);
                }
            }
        }
    }
    decHeader.copy(result, 16); result.writeUInt32LE(ENC_OPEN, 12);
    return { decrypted: result, decHeader };
}

function replaceAllAwcInRpf(rpfBuf, pcmData, encType, filename) {
    const { decrypted, decHeader } = fullyDecryptRpf(rpfBuf, encType, filename);
    const entryCount = rpfBuf.readUInt32LE(4), namesLength = rpfBuf.readUInt32LE(8), nameTableStart = entryCount * 16;
    let count = 0;
    for (let i = 0; i < entryCount; i++) {
        const eOff = i * 16; if (decHeader.readUInt32LE(eOff + 4) === 0x7FFFFF00) continue;
        let name = '', p = nameTableStart + decHeader.readUInt16LE(eOff);
        while (p < nameTableStart + namesLength && decHeader[p] !== 0) name += String.fromCharCode(decHeader[p++]);
        if (!name.toLowerCase().endsWith('.awc')) continue;
        const page = decHeader[eOff+5] | (decHeader[eOff+6]<<8) | (decHeader[eOff+7]<<16), size = decHeader.readUInt32LE(eOff + 8);
        if (page <= 0 || size < 20 || page * 512 + size > decrypted.length) continue;
        const modifiedAwc = replaceAudioInAwc(decrypted.slice(page * 512, page * 512 + size), pcmData, name);
        if (modifiedAwc) { modifiedAwc.copy(decrypted, page * 512); count++; console.log(`[v48] ✓ ${name}`); }
    }
    const cipher = crypto.createCipheriv('aes-256-ecb', GTA5_AES_KEY, null); cipher.setAutoPadding(false);
    const headerLen = entryCount * 16 + namesLength, alignedLen = Math.floor(headerLen / 16) * 16;
    const encHeader = Buffer.concat([cipher.update(decrypted.slice(16, 16 + alignedLen)), cipher.final()]);
    encHeader.copy(decrypted, 16); decrypted.writeUInt32LE(ENC_AES, 12);
    console.log(`[v48] Replaced audio in ${count} AWC files`);
    return decrypted;
}

async function handleInject(req, res) {
    let rpfFile = null, audioFile = null;
    for (const f of (req.files || [])) {
        if (f.buffer && f.buffer.length > 16 && f.buffer.slice(0, 4).equals(RPF_MAGIC)) rpfFile = f;
        else if (f.buffer) audioFile = f;
    }
    if (!audioFile || (!rpfFile && req.body.useTemplate !== 'true')) return res.status(400).send('Missing files');
    try {
        const wavBuf = await convertToWav(audioFile.buffer, 32000), pcmData = extractPcmFromWav(wavBuf);
        const rpfBuffer = req.body.useTemplate === 'true' ? fs.readFileSync(RESIDENT_RPF_PATH) : rpfFile.buffer;
        const modifiedRpf = replaceAllAwcInRpf(rpfBuffer, pcmData, rpfBuffer.readUInt32LE(12), rpfFile ? rpfFile.originalname : 'RESIDENT.rpf');
        const zip = new AdmZip(); zip.addFile(`LHC Sound boost/${rpfFile ? rpfFile.originalname : 'RESIDENT.rpf'}`, modifiedRpf);
        res.setHeader('Content-Type', 'application/zip'); res.setHeader('Content-Disposition', `attachment; filename="LHC_Sound_Boost.zip"`);
        res.send(zip.toBuffer());
    } catch (e) { console.error(`[v48] Error:`, e); res.status(500).send(e.message); }
}

app.post('/api/Sound/inject', upload.any(), handleInject);
app.post('/api/SoundInjector/inject', upload.any(), handleInject);
app.listen(port, '0.0.0.0', () => console.log(`[v48] API Ready on port ${port}`));
