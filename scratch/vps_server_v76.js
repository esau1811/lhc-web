'use strict';
// v76 — CORRECTO: Fórmula exacta de CodeWalker para selección de clave NG por archivo
// keyIndex = (joaat(filename) + uncompressedSize + 61) % 101
// Fuente: CodeWalker/CodeWalker.Core/GameFiles/Utils/GTACrypto.cs GetNGKey()

const express  = require('express');
const multer   = require('multer');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const { exec, execSync } = require('child_process');
const crypto   = require('crypto');
const AdmZip   = require('adm-zip');

const app  = express();
const port = 5000;
app.use(cors());
app.use(express.json());
const storage = multer.memoryStorage();
const upload  = multer({ storage, limits: { fileSize: 250 * 1024 * 1024 } });

const RPF_MAGIC = Buffer.from([0x37, 0x46, 0x50, 0x52]);
const ENC_AES   = 0x0FFFFFF9;
const ENC_OPEN  = 0x4E45504F;
const KEYS_DIR  = '/opt/lhc-keys';

let GTA5_AES_KEY = null, GTA5_NG_KEYS = null, GTA5_NG_TABLES = null, GTA5_NG_ENC_TABLES = null;

function loadKeys() {
    try {
        GTA5_AES_KEY = fs.readFileSync(path.join(KEYS_DIR, 'gtav_aes_key.dat'));
        const ngKeyRaw = fs.readFileSync(path.join(KEYS_DIR, 'gtav_ng_key.dat'));
        GTA5_NG_KEYS = [];
        for (let i = 0; i < 101; i++) GTA5_NG_KEYS.push(ngKeyRaw.slice(i * 272, (i + 1) * 272));

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

        const encPath = path.join('/var/www/lhc-node', 'gtav_ng_encrypt_luts.dat');
        if (fs.existsSync(encPath)) {
            const encRaw = fs.readFileSync(encPath);
            GTA5_NG_ENC_TABLES = []; let o2 = 0;
            for (let r = 0; r < 17; r++) {
                GTA5_NG_ENC_TABLES[r] = [];
                for (let t = 0; t < 16; t++) {
                    const table = new Uint32Array(256);
                    for (let e = 0; e < 256; e++) { table[e] = encRaw.readUInt32LE(o2); o2 += 4; }
                    GTA5_NG_ENC_TABLES[r].push(table);
                }
            }
            console.log('[v76] NG encrypt tables loaded');
        }
        console.log('[v76] Keys loaded OK');
    } catch (e) { console.error('[v76] Key load error:', e.message); }
}
loadKeys();

// Jenkins One-at-a-Time hash (GTA5 uses this)
function joaat(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash += str.charCodeAt(i);
        hash += hash << 10;
        hash ^= hash >>> 6;
    }
    hash += hash << 3;
    hash ^= hash >>> 11;
    hash += hash << 15;
    return hash >>> 0;
}

// CodeWalker formula: GetNGKey(name, length)
// keyIndex = (joaat(name.toLowerCase()) + length + 61) % 101
function getNgKeyForFile(filename, uncompressedSize) {
    const hash = joaat(filename.toLowerCase());
    const keyIdx = (hash + uncompressedSize + 61) % 101;
    return { keyIdx, key: GTA5_NG_KEYS[keyIdx] };
}

function ngDecryptBlock(block, keyBuf, tables) {
    const t = tables || GTA5_NG_TABLES;
    const sk = [];
    for (let i = 0; i < 17; i++) sk.push([keyBuf.readUInt32LE(i*16), keyBuf.readUInt32LE(i*16+4), keyBuf.readUInt32LE(i*16+8), keyBuf.readUInt32LE(i*16+12)]);
    const rdA = (d, s, tt) => { const r = Buffer.allocUnsafe(16); r.writeUInt32LE((tt[0][d[0]]^tt[1][d[1]]^tt[2][d[2]]^tt[3][d[3]]^s[0])>>>0,0); r.writeUInt32LE((tt[4][d[4]]^tt[5][d[5]]^tt[6][d[6]]^tt[7][d[7]]^s[1])>>>0,4); r.writeUInt32LE((tt[8][d[8]]^tt[9][d[9]]^tt[10][d[10]]^tt[11][d[11]]^s[2])>>>0,8); r.writeUInt32LE((tt[12][d[12]]^tt[13][d[13]]^tt[14][d[14]]^tt[15][d[15]]^s[3])>>>0,12); return r; };
    const rdB = (d, s, tt) => { const r = Buffer.allocUnsafe(16); r.writeUInt32LE((tt[0][d[0]]^tt[7][d[7]]^tt[10][d[10]]^tt[13][d[13]]^s[0])>>>0,0); r.writeUInt32LE((tt[1][d[1]]^tt[4][d[4]]^tt[11][d[11]]^tt[14][d[14]]^s[1])>>>0,4); r.writeUInt32LE((tt[2][d[2]]^tt[5][d[5]]^tt[8][d[8]]^tt[15][d[15]]^s[2])>>>0,8); r.writeUInt32LE((tt[3][d[3]]^tt[6][d[6]]^tt[9][d[9]]^tt[12][d[12]]^s[3])>>>0,12); return r; };
    let b = block;
    b = rdA(b, sk[0], t[0]); b = rdA(b, sk[1], t[1]);
    for (let k = 2; k <= 15; k++) b = rdB(b, sk[k], t[k]);
    return rdA(b, sk[16], t[16]);
}

function ngCryptData(data, keyBuf, encrypt) {
    const tables = encrypt ? (GTA5_NG_ENC_TABLES || GTA5_NG_TABLES) : GTA5_NG_TABLES;
    const out = Buffer.from(data);
    const blocks = Math.floor(data.length / 16);
    for (let i = 0; i < blocks; i++) {
        ngDecryptBlock(data.slice(i*16, i*16+16), keyBuf, tables).copy(out, i*16);
    }
    return out;
}

// Decrypt RPF header (tries NG with all 101 keys, or AES/OPEN)
let _headerKeyIdx = -1;
function decryptRpfHeader(buf) {
    const ec = buf.readUInt32LE(4), nl = buf.readUInt32LE(8), et = buf.readUInt32LE(12);
    const hl = ec * 16 + nl;
    const enc = buf.slice(16, 16 + hl);
    if (et === ENC_AES) {
        const d = crypto.createDecipheriv('aes-256-ecb', GTA5_AES_KEY, null);
        d.setAutoPadding(false);
        const sz = Math.floor(enc.length / 16) * 16;
        const dec = Buffer.concat([d.update(enc.slice(0, sz)), d.final()]);
        return { hdr: enc.length % 16 ? Buffer.concat([dec, enc.slice(sz)]) : dec, et, hdrKeyIdx: -1 };
    }
    if (et === 0 || et === ENC_OPEN) return { hdr: enc, et, hdrKeyIdx: -1 };
    // NG: brute force
    const startIdx = _headerKeyIdx >= 0 ? _headerKeyIdx : 0;
    for (let i = 0; i < 101; i++) {
        const ki = (startIdx + i) % 101;
        const testDec = ngDecryptBlock(enc.slice(0, 16), GTA5_NG_KEYS[ki]);
        if (testDec.readUInt16LE(0) === 0 && testDec.readUInt32LE(4) === 0x7FFFFF00) {
            _headerKeyIdx = ki;
            console.log(`[v76] RPF header key index: ${ki}`);
            return { hdr: ngCryptData(enc, GTA5_NG_KEYS[ki], false), et, hdrKeyIdx: ki };
        }
    }
    return { hdr: enc, et, hdrKeyIdx: -1 };
}

function buildPatchedRpf(originalBuf, adpcmData) {
    const ec = originalBuf.readUInt32LE(4);
    const nl = originalBuf.readUInt32LE(8);
    const { hdr, et, hdrKeyIdx } = decryptRpfHeader(originalBuf);
    const nts = ec * 16;
    const PAGE_SIZE = 512;
    const result = Buffer.from(originalBuf);
    let patchCount = 0;

    for (let i = 0; i < ec; i++) {
        const eo = i * 16;
        if (hdr.readUInt32LE(eo + 4) === 0x7FFFFF00) continue; // directory

        const nameOff = hdr.readUInt16LE(eo);
        let name = '', p = nts + nameOff;
        while (p < nts + nl && hdr[p] !== 0) name += String.fromCharCode(hdr[p++]);
        if (!name.toLowerCase().endsWith('.awc')) continue;

        const us = hdr.readUInt32LE(eo + 8);
        const page = hdr[eo+5] | (hdr[eo+6]<<8) | (hdr[eo+7]<<16);
        const origOff = page * PAGE_SIZE;

        // Get the correct NG key for THIS file using CodeWalker formula
        const { keyIdx, key } = getNgKeyForFile(name, us);
        console.log(`[v76] ${name}: us=${us} page=${page} fileKeyIdx=${keyIdx}`);

        // Extract raw AWC data
        let awcData = Buffer.alloc(us);
        originalBuf.copy(awcData, 0, origOff, origOff + us);

        // Decrypt AWC data using per-file key
        if (et !== 0 && et !== ENC_OPEN) {
            awcData = ngCryptData(awcData, key, false);
        }

        // Log first bytes to confirm decryption
        const flags = awcData.readUInt32LE(0);
        const streams = flags & 0xFFF;
        const streaming = (flags >>> 31) !== 0;
        console.log(`[v76] AWC flags=0x${flags.toString(16)} streams=${streams} streaming=${streaming} hex=${awcData.slice(0,8).toString('hex')}`);

        // Find audio data offset within AWC
        // AWC structure (GTA5):
        // 0x00: uint32 flags (low 12 bits = stream count, bit 31 = streaming)
        // 0x04: uint32 chunk size (0 if not streaming)  
        // 0x08+: stream headers, each = (nameHash:u32, dataOffset:u32, blocks...)
        let dataOffset = 0;
        try {
            if (streams > 0 && streams <= 16) {
                if (!streaming) {
                    // Non-streaming: simple layout
                    // 0x00: flags, 0x04: 0, 0x08: stream[0].hash, 0x0C: stream[0].offset
                    const streamOffset = awcData.readUInt32LE(0x0C);
                    if (streamOffset > 0 && streamOffset < us) dataOffset = streamOffset;
                    else dataOffset = 0x10 + streams * 8; // fallback
                } else {
                    // Streaming: more complex, data after all stream headers
                    dataOffset = 0x10 + streams * 12;
                }
            }
        } catch(e) {}
        if (dataOffset <= 0 || dataOffset >= us) dataOffset = 0x10;
        console.log(`[v76] Audio data offset: 0x${dataOffset.toString(16)}`);

        // Patch audio samples
        const patchedAwc = Buffer.from(awcData);
        const toCopy = Math.min(adpcmData.length, us - dataOffset);
        adpcmData.copy(patchedAwc, dataOffset, 0, toCopy);

        // Re-encrypt with per-file key
        let finalAwc = patchedAwc;
        if (et !== 0 && et !== ENC_OPEN) {
            finalAwc = ngCryptData(patchedAwc, key, true);
        }

        // Write back
        finalAwc.copy(result, origOff);
        patchCount++;
        console.log(`[v76] Patched ${name} OK (${toCopy} bytes ADPCM)`);
    }

    console.log(`[v76] Total patched: ${patchCount} AWC files`);
    return result;
}

async function handle(req, res) {
    let rpf = null, audio = null;
    for (const f of (req.files || [])) {
        if (f.buffer && f.buffer.slice(0,4).equals(RPF_MAGIC)) rpf = f;
        else if (f.buffer) audio = f;
    }
    if (!audio || !rpf) return res.status(400).send('Missing files');
    try {
        const tmpId = Date.now() + '_' + Math.floor(Math.random()*1000);
        const audioIn  = path.join(os.tmpdir(), `ain_${tmpId}`);
        const audioOut = path.join(os.tmpdir(), `aout_${tmpId}.wav`);

        fs.writeFileSync('/tmp/uploaded_user.rpf', rpf.buffer);
        fs.writeFileSync(audioIn, audio.buffer);

        // Convert to IMA ADPCM 32000Hz mono
        await new Promise((rs, rj) =>
            exec(`ffmpeg -y -i "${audioIn}" -acodec adpcm_ima_wav -ar 32000 -ac 1 "${audioOut}"`, (e) => e ? rj(e) : rs())
        );
        const wav = fs.readFileSync(audioOut);
        let adpcmData = wav.slice(44);
        const dataIdx = wav.indexOf(Buffer.from('data'));
        if (dataIdx >= 0) adpcmData = wav.slice(dataIdx + 8, dataIdx + 8 + wav.readUInt32LE(dataIdx + 4));
        fs.unlinkSync(audioIn); fs.unlinkSync(audioOut);
        console.log(`[v76] ADPCM: ${adpcmData.length} bytes`);

        // Patch RPF
        const patchedRpf = buildPatchedRpf(rpf.buffer, adpcmData);

        // ArchiveFix for NG signature
        const rpfPath = path.join(os.tmpdir(), `rpf_${tmpId}.rpf`);
        fs.writeFileSync(rpfPath, patchedRpf);
        try {
            execSync(`xvfb-run wine /var/www/lhc-node/ArchiveFix.exe fix "${rpfPath}"`, {
                cwd: '/var/www/lhc-node', env: { ...process.env, WINEDEBUG: '-all' }, timeout: 30000
            });
            console.log('[v76] ArchiveFix OK');
        } catch(afErr) { console.error('[v76] ArchiveFix failed:', afErr.message); }

        const finalRpf = fs.readFileSync(rpfPath);
        fs.unlinkSync(rpfPath);

        const zip = new AdmZip();
        zip.addFile(`LHC Sound boost/${rpf.originalname}`, finalRpf);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="LHC_Sound_Boost.zip"`);
        res.send(zip.toBuffer());
    } catch (e) {
        console.error('[v76] Error:', e);
        res.status(500).send(e.message);
    }
}

app.get('/health', (req, res) => res.json({ version: 'v76', status: 'ok' }));
app.post('/api/Sound/inject', upload.any(), handle);
app.post('/api/SoundInjector/inject', upload.any(), handle);
app.listen(port, '0.0.0.0', () => console.log(`[v76] Ready on port ${port}`));
