'use strict';
// v75 — DEFINITIVO: NG decrypt/encrypt correcto para AWC files
// Diagnóstico confirmó: ET=0x0FEFFFFF (NG), key index=1, cs=0 (no comprimido)
// La causa de todos los fallos anteriores: decrypt/encrypt de datos AWC no se hacía con NG

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

const RPF_MAGIC = Buffer.from([0x37, 0x46, 0x50, 0x52]); // "7FPR"
const ENC_AES   = 0x0FFFFFF9;
const ENC_OPEN  = 0x4E45504F;
const KEYS_DIR  = '/opt/lhc-keys';

let GTA5_AES_KEY = null, GTA5_NG_KEYS = null, GTA5_NG_TABLES = null, GTA5_NG_ENC_LUTS = null;
let DETECTED_NG_KEY_IDX = -1; // Will be set on first request

function loadKeys() {
    try {
        const aesPath = path.join(KEYS_DIR, 'gtav_aes_key.dat');
        if (fs.existsSync(aesPath)) GTA5_AES_KEY = fs.readFileSync(aesPath);

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

        // Load encrypt LUTs
        const encLutPath = path.join('/var/www/lhc-node', 'gtav_ng_encrypt_luts.dat');
        if (fs.existsSync(encLutPath)) {
            const encRaw = fs.readFileSync(encLutPath);
            GTA5_NG_ENC_LUTS = [];
            let o2 = 0;
            for (let r = 0; r < 17; r++) {
                GTA5_NG_ENC_LUTS[r] = [];
                for (let t = 0; t < 16; t++) {
                    const table = new Uint32Array(256);
                    for (let e = 0; e < 256; e++) { table[e] = encRaw.readUInt32LE(o2); o2 += 4; }
                    GTA5_NG_ENC_LUTS[r].push(table);
                }
            }
            console.log('[v75] NG Encrypt LUTs loaded');
        }

        console.log('[v75] Keys loaded');
    } catch (e) { console.error('[v75] Key load error:', e.message); }
}
loadKeys();

function ngDecryptBlock(block, keyBuf) {
    const sk = [];
    for (let i = 0; i < 17; i++) sk.push([keyBuf.readUInt32LE(i*16), keyBuf.readUInt32LE(i*16+4), keyBuf.readUInt32LE(i*16+8), keyBuf.readUInt32LE(i*16+12)]);
    const rdA = (d, s, t) => {
        const r = Buffer.allocUnsafe(16);
        r.writeUInt32LE((t[0][d[0]]^t[1][d[1]]^t[2][d[2]]^t[3][d[3]]^s[0])>>>0, 0);
        r.writeUInt32LE((t[4][d[4]]^t[5][d[5]]^t[6][d[6]]^t[7][d[7]]^s[1])>>>0, 4);
        r.writeUInt32LE((t[8][d[8]]^t[9][d[9]]^t[10][d[10]]^t[11][d[11]]^s[2])>>>0, 8);
        r.writeUInt32LE((t[12][d[12]]^t[13][d[13]]^t[14][d[14]]^t[15][d[15]]^s[3])>>>0, 12);
        return r;
    };
    const rdB = (d, s, t) => {
        const r = Buffer.allocUnsafe(16);
        r.writeUInt32LE((t[0][d[0]]^t[7][d[7]]^t[10][d[10]]^t[13][d[13]]^s[0])>>>0, 0);
        r.writeUInt32LE((t[1][d[1]]^t[4][d[4]]^t[11][d[11]]^t[14][d[14]]^s[1])>>>0, 4);
        r.writeUInt32LE((t[2][d[2]]^t[5][d[5]]^t[8][d[8]]^t[15][d[15]]^s[2])>>>0, 8);
        r.writeUInt32LE((t[3][d[3]]^t[6][d[6]]^t[9][d[9]]^t[12][d[12]]^s[3])>>>0, 12);
        return r;
    };
    let b = block;
    b = rdA(b, sk[0], GTA5_NG_TABLES[0]);
    b = rdA(b, sk[1], GTA5_NG_TABLES[1]);
    for (let k = 2; k <= 15; k++) b = rdB(b, sk[k], GTA5_NG_TABLES[k]);
    return rdA(b, sk[16], GTA5_NG_TABLES[16]);
}

function ngEncryptBlock(block, keyBuf, tables) {
    if (!tables) tables = GTA5_NG_TABLES; // fallback
    const sk = [];
    for (let i = 0; i < 17; i++) sk.push([keyBuf.readUInt32LE(i*16), keyBuf.readUInt32LE(i*16+4), keyBuf.readUInt32LE(i*16+8), keyBuf.readUInt32LE(i*16+12)]);
    const rdA = (d, s, t) => {
        const r = Buffer.allocUnsafe(16);
        r.writeUInt32LE((t[0][d[0]]^t[1][d[1]]^t[2][d[2]]^t[3][d[3]]^s[0])>>>0, 0);
        r.writeUInt32LE((t[4][d[4]]^t[5][d[5]]^t[6][d[6]]^t[7][d[7]]^s[1])>>>0, 4);
        r.writeUInt32LE((t[8][d[8]]^t[9][d[9]]^t[10][d[10]]^t[11][d[11]]^s[2])>>>0, 8);
        r.writeUInt32LE((t[12][d[12]]^t[13][d[13]]^t[14][d[14]]^t[15][d[15]]^s[3])>>>0, 12);
        return r;
    };
    const rdB = (d, s, t) => {
        const r = Buffer.allocUnsafe(16);
        r.writeUInt32LE((t[0][d[0]]^t[7][d[7]]^t[10][d[10]]^t[13][d[13]]^s[0])>>>0, 0);
        r.writeUInt32LE((t[1][d[1]]^t[4][d[4]]^t[11][d[11]]^t[14][d[14]]^s[1])>>>0, 4);
        r.writeUInt32LE((t[2][d[2]]^t[5][d[5]]^t[8][d[8]]^t[15][d[15]]^s[2])>>>0, 8);
        r.writeUInt32LE((t[3][d[3]]^t[6][d[6]]^t[9][d[9]]^t[12][d[12]]^s[3])>>>0, 12);
        return r;
    };
    let b = block;
    b = rdA(b, sk[0], tables[0]);
    b = rdA(b, sk[1], tables[1]);
    for (let k = 2; k <= 15; k++) b = rdB(b, sk[k], tables[k]);
    return rdA(b, sk[16], tables[16]);
}

function ngDecryptData(data, keyBuf) {
    const out = Buffer.from(data);
    for (let i = 0; i < Math.floor(data.length / 16); i++)
        ngDecryptBlock(data.slice(i*16, i*16+16), keyBuf).copy(out, i*16);
    return out;
}

function ngEncryptData(data, keyBuf) {
    const out = Buffer.from(data);
    const tables = GTA5_NG_ENC_LUTS || GTA5_NG_TABLES;
    for (let i = 0; i < Math.floor(data.length / 16); i++)
        ngEncryptBlock(data.slice(i*16, i*16+16), keyBuf, tables).copy(out, i*16);
    return out;
}

function findNgKeyIndex(encHeaderSlice) {
    for (let i = 0; i < 101; i++) {
        const d = ngDecryptBlock(encHeaderSlice.slice(0, 16), GTA5_NG_KEYS[i]);
        if (d.readUInt16LE(0) === 0 && d.readUInt32LE(4) === 0x7FFFFF00) return i;
    }
    return -1;
}

function decryptHeader(buf) {
    const ec = buf.readUInt32LE(4), nl = buf.readUInt32LE(8), et = buf.readUInt32LE(12);
    const hl = ec * 16 + nl;
    const enc = buf.slice(16, hl + 16);

    if (et === ENC_AES) {
        const d = crypto.createDecipheriv('aes-256-ecb', GTA5_AES_KEY, null);
        d.setAutoPadding(false);
        const dec = Buffer.concat([d.update(enc.slice(0, Math.floor(enc.length/16)*16)), d.final()]);
        return { header: enc.length % 16 ? Buffer.concat([dec, enc.slice(dec.length)]) : dec, et, keyIdx: -1 };
    }
    if (et === 0 || et === ENC_OPEN) return { header: enc, et, keyIdx: -1 };

    // NG
    const keyIdx = DETECTED_NG_KEY_IDX >= 0 ? DETECTED_NG_KEY_IDX : findNgKeyIndex(enc);
    if (keyIdx >= 0) {
        DETECTED_NG_KEY_IDX = keyIdx;
        return { header: ngDecryptData(enc, GTA5_NG_KEYS[keyIdx]), et, keyIdx };
    }
    return { header: enc, et, keyIdx: -1 };
}

function buildPatchedRpf(originalBuf, adpcmData, targetAwcName) {
    const ec = originalBuf.readUInt32LE(4);
    const nl = originalBuf.readUInt32LE(8);
    const { header: dh, et, keyIdx } = decryptHeader(originalBuf);
    const nts = ec * 16;
    const PAGE_SIZE = 512;

    const result = Buffer.from(originalBuf);
    let patchCount = 0;

    for (let i = 0; i < ec; i++) {
        const eo = i * 16;
        const entryType = dh.readUInt32LE(eo + 4);
        if (entryType === 0x7FFFFF00) continue;

        const nameOff = dh.readUInt16LE(eo);
        let name = '', p = nts + nameOff;
        while (p < nts + nl && dh[p] !== 0) name += String.fromCharCode(dh[p++]);

        if (!name.toLowerCase().endsWith('.awc')) continue;
        // If targetAwcName specified, only patch that one
        if (targetAwcName && !name.toLowerCase().includes(targetAwcName.toLowerCase())) continue;

        const us = dh.readUInt32LE(eo + 8);
        const page = dh[eo+5] | (dh[eo+6]<<8) | (dh[eo+7]<<16);
        const origOff = page * PAGE_SIZE;

        console.log(`[v75] Processing ${name}: page=${page} us=${us} et=0x${et.toString(16)} keyIdx=${keyIdx}`);

        // 1. Extract raw AWC data
        let awcRaw = Buffer.alloc(us);
        originalBuf.copy(awcRaw, 0, origOff, origOff + us);

        // 2. NG decrypt AWC data (if NG encrypted)
        if (keyIdx >= 0) {
            awcRaw = ngDecryptData(awcRaw, GTA5_NG_KEYS[keyIdx]);
        } else if (et === ENC_AES) {
            const d = crypto.createDecipheriv('aes-256-ecb', GTA5_AES_KEY, null);
            d.setAutoPadding(false);
            const dec = Buffer.concat([d.update(awcRaw.slice(0, Math.floor(awcRaw.length/16)*16)), d.final()]);
            awcRaw = awcRaw.length % 16 ? Buffer.concat([dec, awcRaw.slice(dec.length)]) : dec;
        }

        // 3. Show AWC magic for debugging
        console.log(`[v75] AWC magic: ${awcRaw.slice(0,4).toString('hex')} (${awcRaw.slice(0,4).toString('ascii').replace(/[^\x20-\x7E]/g,'.')})`);

        // 4. Parse AWC header to find where audio data starts
        // GTA5 AWC format:
        //   0x00: flags/version (4 bytes) — bit 31 set = streaming, bits 0-11 = stream count
        //   0x04: chunk size (4 bytes)
        //   0x08...: stream headers (variable)
        // For weapon sounds: typically non-streaming, single stream
        // Stream header: hash(4), offset(4), info(8) per stream
        // The audio data usually starts after the header block

        let dataOffset = 0;
        try {
            const flags = awcRaw.readUInt32LE(0);
            const streamCount = flags & 0xFFF;
            const isStreaming = (flags >>> 31) !== 0;
            console.log(`[v75] AWC flags=0x${flags.toString(16)} streams=${streamCount} streaming=${isStreaming}`);

            if (!isStreaming && streamCount > 0) {
                // Non-streaming: headers at 0x08, each is 4+4+8=16 bytes
                // After all stream headers comes the data
                // Each stream has a "chunk offset" that we can read
                const firstStreamHeaderOff = 0x08;
                const chunkOff = awcRaw.readUInt32LE(firstStreamHeaderOff + 4);
                if (chunkOff > 0 && chunkOff < us) dataOffset = chunkOff;
            } else if (isStreaming && streamCount > 0) {
                // Streaming format different — just use fallback
                dataOffset = 0x50;
            }
        } catch(e) {
            console.error('[v75] AWC header parse error:', e.message);
        }

        if (dataOffset <= 0 || dataOffset >= us) dataOffset = 0x40;
        console.log(`[v75] Audio data offset in AWC: 0x${dataOffset.toString(16)}`);

        // 5. Patch: overwrite audio samples with our ADPCM data
        const patchedAwc = Buffer.from(awcRaw);
        const available = us - dataOffset;
        const toCopy = Math.min(adpcmData.length, available);
        adpcmData.copy(patchedAwc, dataOffset, 0, toCopy);
        console.log(`[v75] Copied ${toCopy} bytes of ADPCM at offset 0x${dataOffset.toString(16)}`);

        // 6. Re-encrypt AWC data
        let finalAwc = patchedAwc;
        if (keyIdx >= 0) {
            finalAwc = ngEncryptData(patchedAwc, GTA5_NG_KEYS[keyIdx]);
        } else if (et === ENC_AES) {
            const c = crypto.createCipheriv('aes-256-ecb', GTA5_AES_KEY, null);
            c.setAutoPadding(false);
            const enc = Buffer.concat([c.update(finalAwc.slice(0, Math.floor(finalAwc.length/16)*16)), c.final()]);
            finalAwc = finalAwc.length % 16 ? Buffer.concat([enc, finalAwc.slice(enc.length)]) : enc;
        }

        // 7. Write back into result buffer
        finalAwc.copy(result, origOff);
        patchCount++;
        console.log(`[v75] Patched ${name} successfully`);
    }

    console.log(`[v75] Total patched: ${patchCount}`);
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
        const audioIn = path.join(os.tmpdir(), `audio_${tmpId}`);
        const audioOut = path.join(os.tmpdir(), `audio_${tmpId}.wav`);

        // Save uploaded RPF for diagnostics
        fs.writeFileSync('/tmp/uploaded_user.rpf', rpf.buffer);

        // Convert audio to ADPCM IMA WAV (32000Hz mono) using ffmpeg
        fs.writeFileSync(audioIn, audio.buffer);
        await new Promise((rs, rj) =>
            exec(`ffmpeg -y -i "${audioIn}" -acodec adpcm_ima_wav -ar 32000 -ac 1 "${audioOut}"`, (e) => e ? rj(e) : rs())
        );
        const wav = fs.readFileSync(audioOut);
        // Extract raw ADPCM samples from WAV (skip WAV header, find 'data' chunk)
        let adpcmData = wav.slice(44);
        const dataIdx = wav.indexOf(Buffer.from('data'));
        if (dataIdx >= 0) {
            const dataSize = wav.readUInt32LE(dataIdx + 4);
            adpcmData = wav.slice(dataIdx + 8, dataIdx + 8 + dataSize);
        }
        fs.unlinkSync(audioIn);
        fs.unlinkSync(audioOut);
        console.log(`[v75] ADPCM data: ${adpcmData.length} bytes`);

        // Patch all AWC files in the RPF
        const patchedRpf = buildPatchedRpf(rpf.buffer, adpcmData, null);

        // Apply ArchiveFix for final NG signature
        const rpfPath = path.join(os.tmpdir(), `rpf_${tmpId}.rpf`);
        fs.writeFileSync(rpfPath, patchedRpf);

        try {
            execSync(`xvfb-run wine /var/www/lhc-node/ArchiveFix.exe fix "${rpfPath}"`, {
                cwd: '/var/www/lhc-node',
                env: { ...process.env, WINEDEBUG: '-all' },
                timeout: 30000
            });
            console.log('[v75] ArchiveFix applied successfully');
        } catch (afErr) {
            console.error('[v75] ArchiveFix failed:', afErr.message);
        }

        const finalRpf = fs.readFileSync(rpfPath);
        fs.unlinkSync(rpfPath);

        const zip = new AdmZip();
        zip.addFile(`LHC Sound boost/${rpf.originalname}`, finalRpf);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="LHC_Sound_Boost.zip"`);
        res.send(zip.toBuffer());
    } catch (e) {
        console.error(`[v75] Error:`, e);
        res.status(500).send(e.message);
    }
}

app.get('/health', (req, res) => res.json({ version: 'v75', status: 'ok' }));
app.post('/api/Sound/inject', upload.any(), handle);
app.post('/api/SoundInjector/inject', upload.any(), handle);
app.listen(port, '0.0.0.0', () => console.log(`[v75] API Ready on port ${port}`));
