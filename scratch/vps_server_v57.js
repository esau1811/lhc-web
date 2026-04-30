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
const ENC_AES   = 0x0FFFFFF9;
const ENC_NG    = 0x0FEFFFFF;
const ENC_NONE  = 0x00000000;
const KEYS_DIR  = '/opt/lhc-keys';
const RESIDENT_RPF_PATH = '/opt/lhc-sound/RESIDENT.rpf';

let GTA5_AES_KEY = null, GTA5_NG_KEYS = null, GTA5_NG_TABLES = null, GTA5_HASH_LUT = null;

function loadKeys() {
    try {
        const aesPath = path.join(KEYS_DIR, 'gtav_aes_key.dat');
        if (fs.existsSync(aesPath)) {
            GTA5_AES_KEY = fs.readFileSync(aesPath);
            console.log(`[v57] AES key loaded: ${GTA5_AES_KEY.length} bytes`);
        } else {
            console.log('[v57] WARN: gtav_aes_key.dat not found - will output unencrypted RPF');
        }
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
        console.log('[v57] NG keys loaded (101 keys)');
    } catch (e) { console.error('[v57] Key load error:', e.message); }
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
    let b = block; b = rdA(b, sk[0], GTA5_NG_TABLES[0]); b = rdA(b, sk[1], GTA5_NG_TABLES[1]); for (let k = 2; k <= 15; k++) b = rdB(b, sk[k], GTA5_NG_TABLES[k]); return rdA(b, sk[16], GTA5_NG_TABLES[16]);
}

function ngDecrypt(data, keyBuf) {
    const out = Buffer.from(data);
    for (let i = 0; i < Math.floor(data.length / 16); i++) ngDecryptBlock(data.slice(i*16, i*16+16), keyBuf).copy(out, i*16);
    return out;
}

function decryptHeader(buf, et, name) {
    const ec = buf.readUInt32LE(4), nl = buf.readUInt32LE(8), hl = ec * 16 + nl, enc = buf.slice(16, hl + 16);
    if (et === ENC_AES) {
        if (!GTA5_AES_KEY) throw new Error('AES RPF but AES key not loaded');
        const d = crypto.createDecipheriv('aes-256-ecb', GTA5_AES_KEY, null); d.setAutoPadding(false);
        const dec = Buffer.concat([d.update(enc.slice(0, Math.floor(enc.length/16)*16)), d.final()]);
        return enc.length % 16 ? Buffer.concat([dec, enc.slice(dec.length)]) : dec;
    }
    if (et === ENC_NONE) return enc; // plaintext header
    // NG: try known filenames first, then brute-force
    const tests = [name, 'WEAPONS_PLAYER.rpf', 'RESIDENT.rpf', 'WEAPONS.rpf'];
    for (const t of tests) {
        const idx = ((gta5Hash(t.toLowerCase()) + buf.length + 61) >>> 0) % 101;
        const d = ngDecryptBlock(enc.slice(0,16), GTA5_NG_KEYS[idx]);
        if (d.readUInt16LE(0) === 0 && d.readUInt32LE(4) === 0x7FFFFF00) return ngDecrypt(enc, GTA5_NG_KEYS[idx]);
    }
    for (let i = 0; i < 101; i++) {
        const d = ngDecryptBlock(enc.slice(0,16), GTA5_NG_KEYS[i]);
        if (d.readUInt16LE(0) === 0 && d.readUInt32LE(4) === 0x7FFFFF00) return ngDecrypt(enc, GTA5_NG_KEYS[i]);
    }
    return enc.readUInt16LE(0) === 0 ? enc : null;
}

// Brute-force all 101 NG keys across the first CHECK_BLOCKS blocks.
// GTA5 resource entries have a 16-byte wrapper before AWC content, so ADAT
// can be at block 0 OR block 1. Checking 8 blocks covers any small header.
const CHECK_BLOCKS = 8;
function ngDecryptSector(sec) {
    const ADAT = Buffer.from('ADAT');
    if (sec.indexOf(ADAT) !== -1) return { data: sec, keyIdx: -1, method: 'raw' };

    const nBlocks = Math.min(CHECK_BLOCKS, Math.floor(sec.length / 16));
    for (let ki = 0; ki < 101; ki++) {
        for (let b = 0; b < nBlocks; b++) {
            const blk = ngDecryptBlock(sec.slice(b*16, (b+1)*16), GTA5_NG_KEYS[ki]);
            if (blk.indexOf(ADAT) !== -1) {
                return { data: ngDecrypt(sec, GTA5_NG_KEYS[ki]), keyIdx: ki, method: 'ng', adatBlock: b };
            }
        }
    }

    if (GTA5_AES_KEY) {
        try {
            const d = crypto.createDecipheriv('aes-256-ecb', GTA5_AES_KEY, null); d.setAutoPadding(false);
            const al = Math.floor(sec.length/16)*16;
            if (al >= 16) {
                let ta = Buffer.concat([d.update(sec.slice(0, al)), d.final()]);
                if (sec.length % 16) ta = Buffer.concat([ta, sec.slice(al)]);
                if (ta.indexOf(ADAT) !== -1) return { data: ta, keyIdx: -2, method: 'aes', adatBlock: 0 };
            }
        } catch(e){}
    }

    return null;
}

function replaceAwc(buf, pcm) {
    const magic = Buffer.from('ADAT');
    let off = buf.indexOf(magic);
    if (off === -1) return null;
    const sub = buf.slice(off);
    if (sub.length < 16) return null;
    const sc = sub.readUInt32LE(8); let p = 16; const ss = [];
    for (let i = 0; i < sc; i++) { ss.push({ tc: (sub.readUInt32LE(p) >>> 29) & 0x7, tags: [] }); p += 4; }
    for (const s of ss) {
        for (let t = 0; t < s.tc; t++) {
            const w1 = sub.readUInt32LE(p), w2 = sub.readUInt32LE(p + 4);
            s.tags.push({ type: (w2 >>> 24) & 0xFF, off: w1 & 0x0FFFFFFF, size: ((w1 >>> 28) & 0xF) | ((w2 & 0x00FFFFFF) << 4) });
            p += 8;
        }
    }
    let ok = false;
    for (const s of ss) {
        let dt = null, ft = null; for (const t of s.tags) { if (t.type === 0x55) dt = t; if (t.type === 0xFA) ft = t; }
        if (!dt || dt.off + dt.size > sub.length) continue;
        const w = pcm.slice(0, dt.size); w.copy(sub, dt.off);
        if (w.length < dt.size) sub.fill(0, dt.off + w.length, dt.off + dt.size);
        if (ft && ft.off + 4 <= sub.length) sub.writeUInt32LE(Math.floor(w.length / 2), ft.off);
        ok = true;
    }
    return ok ? buf : null;
}

function processRpf(buf, pcm, fname) {
    const et = buf.readUInt32LE(12), ec = buf.readUInt32LE(4), nl = buf.readUInt32LE(8);
    console.log(`[v57] Processing ${fname}: enc=0x${et.toString(16)} entries=${ec} namesLen=${nl}`);

    const dh = decryptHeader(buf, et, fname);
    if (!dh) throw new Error('Header decrypt failed');
    const res = Buffer.from(buf); dh.copy(res, 16);
    const nts = ec * 16; let count = 0;

    function scan(start, end, currentPath) {
        for (let i = start; i < end; i++) {
            const eo = i * 16;
            const nameOff = dh.readUInt16LE(eo);
            let name = '', p = nts + nameOff; while (p < nts + nl && dh[p] !== 0) name += String.fromCharCode(dh[p++]);
            const type = dh.readUInt32LE(eo + 4);

            if (type === 0x7FFFFF00) {
                const ds = dh.readUInt32LE(eo + 8), dc = dh.readUInt32LE(eo + 12);
                scan(ds, ds + dc, currentPath + name + '/');
            } else if (name.toLowerCase().endsWith('.awc')) {
                const page = dh[eo+5] | (dh[eo+6]<<8) | (dh[eo+7]<<16);
                const us = dh.readUInt32LE(eo+8);
                const cs = dh[eo+2] | (dh[eo+3]<<8) | (dh[eo+4]<<16);
                const as = cs > 0 ? cs : us;

                // Auto-detect sector size: GTA5 RPFs use 512 or 4096 byte sectors.
                // Try 512 first, fall back to 4096 if ADAT not found.
                let secOff = page * 512, sectorMul = 512, sec = null, found = null;
                for (const mul of [512, 4096, 8192]) {
                    const off = page * mul;
                    if (page === 0 || as === 0 || off + as > buf.length) continue;
                    const candidate = Buffer.from(buf.slice(off, off + as));
                    const result = ngDecryptSector(candidate);
                    if (result) { found = result; sec = candidate; secOff = off; sectorMul = mul; break; }
                    if (!sec) { sec = candidate; secOff = off; } // keep first for hex dump
                }

                console.log(`[v57] AWC: ${currentPath}${name} page=${page} us=${us} cs=${cs} mul=${sectorMul} secOff=${secOff}`);
                if (page === 0 || as === 0) { console.log(`[v57]   SKIP: page=0 or size=0`); continue; }
                if (!found) {
                    console.log(`[v57]   SKIP: ADAT not found with any method/mul. type=0x${type.toString(16)} raw[0:32]=${sec ? sec.slice(0,32).toString('hex') : 'N/A'}`);
                    continue;
                }
                console.log(`[v57]   Decrypted via ${found.method}${found.keyIdx >= 0 ? ' key='+found.keyIdx : ''}${found.adatBlock > 0 ? ' adatBlock='+found.adatBlock : ''}`);

                let wk = found.data;
                if (cs > 0 && wk[0] === 0x78) { try { wk = zlib.inflateRawSync(wk); } catch(e){ console.log('[v57]   zlib fail'); } }

                const mod = replaceAwc(Buffer.from(wk), pcm);
                if (mod) {
                    mod.copy(res, secOff); count++;
                    console.log(`[v57]   INJECTED (slot=${as} audio=${pcm.length})`);
                    dh[eo+2]=0; dh[eo+3]=0; dh[eo+4]=0; dh.writeUInt32LE(mod.length, eo+8);
                } else {
                    console.log(`[v57]   replaceAwc returned null`);
                }
            } else if (type !== 0 && type !== 0x7FFFFF00) {
                // Non-AWC binary file: if NG input, try to decrypt data pages too
                if (et === ENC_NG) {
                    const page = dh[eo+5] | (dh[eo+6]<<8) | (dh[eo+7]<<16);
                    const us = dh.readUInt32LE(eo+8);
                    const cs = dh[eo+2] | (dh[eo+3]<<8) | (dh[eo+4]<<16);
                    const as = cs > 0 ? cs : us;
                    if (page > 0 && as > 0) {
                        const keyIdx = ((gta5Hash(name.toLowerCase()) + as + 61) >>> 0) % 101;
                        for (const mul of [512, 4096, 8192]) {
                            const secOff = page * mul;
                            if (secOff + as > buf.length) continue;
                            const sec = Buffer.from(buf.slice(secOff, secOff + as));
                            const firstBlk = ngDecryptBlock(sec.slice(0, Math.min(16, sec.length)), GTA5_NG_KEYS[keyIdx]);
                            const rawZeros = sec.slice(0, Math.min(16, sec.length)).filter(b => b === 0).length;
                            const decZeros = firstBlk.filter(b => b === 0).length;
                            if (decZeros > rawZeros || sec[0] !== 0) {
                                const dec = ngDecrypt(sec, GTA5_NG_KEYS[keyIdx]);
                                dec.copy(res, secOff);
                                console.log(`[v57]   Non-AWC "${name}" decrypted mul=${mul} key=${keyIdx}`);
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    const rootType = dh.readUInt32LE(4);
    if (rootType === 0x7FFFFF00) {
        const rootStart = dh.readUInt32LE(8), rootCount = dh.readUInt32LE(12);
        console.log(`[v57] Root dir: start=${rootStart} count=${rootCount}`);
        scan(rootStart, rootStart + rootCount, '');
    } else {
        scan(0, ec, '');
    }

    dh.copy(res, 16);

    if (GTA5_AES_KEY) {
        // Pad names length to 16-byte boundary for AES-ECB
        const nlAligned = nl % 16 === 0 ? nl : nl + (16 - nl % 16);
        const hlAligned = ec * 16 + nlAligned;
        const c = crypto.createCipheriv('aes-256-ecb', GTA5_AES_KEY, null); c.setAutoPadding(false);
        const eh = Buffer.concat([c.update(res.slice(16, 16 + hlAligned)), c.final()]);
        eh.copy(res, 16);
        res.writeUInt32LE(ENC_AES, 12);
        res.writeUInt32LE(nlAligned, 8);
        console.log(`[v57] AES header written: nlAligned=${nlAligned} hlAligned=${hlAligned}`);
    } else {
        // No AES key: output as unencrypted RPF so FiveM reads the header as plaintext
        res.writeUInt32LE(ENC_NONE, 12);
        console.log('[v57] WARN: no AES key - output as unencrypted RPF (enc=0)');
    }

    console.log(`[v57] Done: ${count} AWC(s) replaced in ${fname}`);
    return res;
}

async function handle(req, res) {
    let rpf = null, audio = null;
    for (const f of (req.files || [])) { if (f.buffer && f.buffer.slice(0,4).equals(RPF_MAGIC)) rpf = f; else if (f.buffer) audio = f; }
    if (!audio || (!rpf && req.body.useTemplate !== 'true')) return res.status(400).send('Missing files');
    try {
        const i = path.join(os.tmpdir(), `i_${Date.now()}`), o = path.join(os.tmpdir(), `o_${Date.now()}.wav`);
        fs.writeFileSync(i, audio.buffer);
        await new Promise((rs, rj) => exec(`ffmpeg -y -i "${i}" -ac 1 -ar 32000 -c:a pcm_s16le "${o}"`, (e) => e ? rj(e) : rs()));
        const pcm = fs.readFileSync(o);
        let pcmData = pcm; try { pcmData = pcm.slice(pcm.indexOf(Buffer.from('data')) + 8); } catch(e){}
        fs.unlinkSync(i); fs.unlinkSync(o);
        const buf = req.body.useTemplate === 'true' ? fs.readFileSync(RESIDENT_RPF_PATH) : rpf.buffer;
        const name = rpf ? rpf.originalname : 'RESIDENT.rpf', mod = processRpf(buf, pcmData, name);
        const zip = new AdmZip(); zip.addFile(`LHC Sound boost/${name}`, mod);
        res.setHeader('Content-Type', 'application/zip'); res.setHeader('Content-Disposition', `attachment; filename="LHC_Sound_Boost.zip"`);
        res.send(zip.toBuffer());
    } catch (e) { console.error(`[v57] Error:`, e); res.status(500).send(e.message); }
}

app.get('/health', (req, res) => res.json({
    version: 'v57',
    aesKey: GTA5_AES_KEY ? `loaded (${GTA5_AES_KEY.length} bytes)` : 'NOT LOADED - output will be unencrypted RPF',
    ngKeys: GTA5_NG_KEYS ? `loaded (${GTA5_NG_KEYS.length} keys)` : 'NOT LOADED',
}));

app.post('/api/Sound/inject', upload.any(), handle);
app.post('/api/SoundInjector/inject', upload.any(), handle);
app.listen(port, '0.0.0.0', () => console.log(`[v57] API Ready on port ${port}`));
