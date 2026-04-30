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
        console.log('[v55] Keys loaded');
    } catch (e) { console.error('[v55] Key load error:', e.message); }
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
        const d = crypto.createDecipheriv('aes-256-ecb', GTA5_AES_KEY, null); d.setAutoPadding(false);
        const dec = Buffer.concat([d.update(enc.slice(0, Math.floor(enc.length/16)*16)), d.final()]);
        return enc.length % 16 ? Buffer.concat([dec, enc.slice(dec.length)]) : dec;
    }
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

function replaceAwc(buf, pcm) {
    const magic = Buffer.from('ADAT'); let off = buf.indexOf(magic);
    if (off === -1) {
        for (let i = 0; i < Math.min(buf.length, 1024); i += 4) {
            const pk = Buffer.alloc(4); for(let j=0; j<4; j++) pk[j] = buf[i+j] ^ magic[j];
            const tb = Buffer.alloc(16); for(let j=0; j<16; j++) tb[j] = buf[i+j] ^ pk[j % 4];
            if (tb.toString('utf8', 0, 4) === 'ADAT') {
                const x = Buffer.alloc(buf.length); for(let j=0; j<buf.length; j++) x[j] = buf[j] ^ pk[j % 4];
                buf = x; off = i; break;
            }
        }
    }
    if (off === -1) return null;
    const sub = buf.slice(off); if (sub.length < 16) return null;
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
            } else {
                const page = dh[eo+5] | (dh[eo+6]<<8) | (dh[eo+7]<<16);
                const us = dh.readUInt32LE(eo+8);
                const cs = dh[eo+2] | (dh[eo+3]<<8) | (dh[eo+4]<<16);
                const as = cs > 0 ? cs : us;
                if (page > 0 && as > 0 && page * 512 + as <= buf.length) {
                    const sec = buf.slice(page * 512, page * 512 + as); let dec = null;
                    if (sec.indexOf(Buffer.from('ADAT')) !== -1) dec = sec;
                    else {
                        let cleanName = name; if (cleanName.startsWith('/')) cleanName = cleanName.substring(1);
                        const tries = [us, cs, as];
                        for (const t of tries) {
                            if (t <= 0) continue;
                            const k = ((gta5Hash(cleanName.toLowerCase()) + t + 61) >>> 0) % 101;
                            const d = ngDecrypt(sec, GTA5_NG_KEYS[k]);
                            if (d.indexOf(Buffer.from('ADAT')) !== -1 || (cs > 0 && d[0] === 0x78)) { dec = d; break; }
                        }
                        if (!dec && GTA5_AES_KEY) {
                            const d = crypto.createDecipheriv('aes-256-ecb', GTA5_AES_KEY, null); d.setAutoPadding(false);
                            const al = Math.floor(sec.length/16)*16;
                            if (al >= 16) {
                                let ta = Buffer.concat([d.update(sec.slice(0, al)), d.final()]);
                                if (sec.length % 16) ta = Buffer.concat([ta, sec.slice(al)]);
                                if (ta.indexOf(Buffer.from('ADAT')) !== -1 || (cs > 0 && ta[0] === 0x78)) dec = ta;
                            }
                        }
                    }
                    if (dec) {
                        let wk = dec; if (cs > 0 && dec[0] === 0x78) { try { wk = zlib.inflateRawSync(dec); } catch(e){} }
                        if (name.toLowerCase().endsWith('.awc')) {
                            const mod = replaceAwc(Buffer.from(wk), pcm);
                            if (mod) {
                                mod.copy(res, page * 512); count++;
                                console.log(`[v55] INJECTED: ${currentPath}${name}`);
                                dh[eo+2]=0; dh[eo+3]=0; dh[eo+4]=0; dh.writeUInt32LE(mod.length, eo+8);
                            }
                        }
                    }
                }
            }
        }
    }

    // Start scan from root directory's children (entry 0 is always root dir in RPF7)
    const rootType = dh.readUInt32LE(4);
    if (rootType === 0x7FFFFF00) {
        const rootStart = dh.readUInt32LE(8), rootCount = dh.readUInt32LE(12);
        scan(rootStart, rootStart + rootCount, '');
    } else {
        scan(0, ec, '');
    }

    dh.copy(res, 16);

    if (GTA5_AES_KEY) {
        // namesLength MUST be aligned to 16 bytes for AES-ECB to encrypt/decrypt cleanly.
        // The padding bytes between nl and nlAligned are zeros in the buffer (header padding).
        const nlAligned = nl % 16 === 0 ? nl : nl + (16 - nl % 16);
        const hlAligned = ec * 16 + nlAligned;
        const c = crypto.createCipheriv('aes-256-ecb', GTA5_AES_KEY, null); c.setAutoPadding(false);
        const eh = Buffer.concat([c.update(res.slice(16, 16 + hlAligned)), c.final()]);
        eh.copy(res, 16);
        res.writeUInt32LE(ENC_AES, 12);
        res.writeUInt32LE(nlAligned, 8);  // update names length to aligned value in plaintext header
    }

    console.log(`[v55] Done: replaced ${count} AWC(s) in ${fname}`);
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
    } catch (e) { console.error(`[v55] Error:`, e); res.status(500).send(e.message); }
}

app.post('/api/Sound/inject', upload.any(), handle);
app.post('/api/SoundInjector/inject', upload.any(), handle);
app.listen(port, '0.0.0.0', () => console.log(`[v55] API Ready on port ${port}`));
