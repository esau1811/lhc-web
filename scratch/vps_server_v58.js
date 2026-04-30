'use strict';
// v58 — New approach: Build a CLEAN RPF with OPEN encryption from a template AWC
// Since the uploaded RPF has custom/modded NG encryption we cannot crack per-file,
// we instead:
//   1. Decrypt only the HEADER (which we CAN do)
//   2. Read the AWC file structure from the header
//   3. Create a brand-new RPF with ENC_OPEN (plaintext) header
//   4. Copy the original data pages AS-IS  
//   5. For each AWC, create a CLEAN unencrypted AWC with the user's PCM injected
//   6. FiveM reads OPEN RPFs perfectly fine

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

const RPF_MAGIC = Buffer.from([0x37, 0x46, 0x50, 0x52]); // "7FPR"
const ENC_AES   = 0x0FFFFFF9;
const ENC_NG    = 0x0FEFFFFF;
const ENC_NONE  = 0x00000000;
const ENC_OPEN  = 0x4E45504F; // "OPEN" — FiveM reads this as plaintext
const KEYS_DIR  = '/opt/lhc-keys';

let GTA5_AES_KEY = null, GTA5_NG_KEYS = null, GTA5_NG_TABLES = null, GTA5_HASH_LUT = null;

function loadKeys() {
    try {
        const aesPath = path.join(KEYS_DIR, 'gtav_aes_key.dat');
        if (fs.existsSync(aesPath)) GTA5_AES_KEY = fs.readFileSync(aesPath);
        const ngKeyRaw = fs.readFileSync(path.join(KEYS_DIR, 'gtav_ng_key.dat'));
        GTA5_NG_KEYS = []; for (let i = 0; i < 101; i++) GTA5_NG_KEYS.push(ngKeyRaw.slice(i * 272, (i + 1) * 272));
        const ngTabRaw = fs.readFileSync(path.join(KEYS_DIR, 'gtav_ng_decrypt_tables.dat'));
        GTA5_NG_TABLES = []; let off = 0;
        for (let r = 0; r < 17; r++) { GTA5_NG_TABLES[r] = []; for (let t = 0; t < 16; t++) { const table = new Uint32Array(256); for (let e = 0; e < 256; e++) { table[e] = ngTabRaw.readUInt32LE(off); off += 4; } GTA5_NG_TABLES[r].push(table); } }
        GTA5_HASH_LUT = fs.readFileSync(path.join(KEYS_DIR, 'gtav_hash_lut.dat'));
        console.log('[v58] Keys loaded');
    } catch (e) { console.error('[v58] Key load error:', e.message); }
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
    if (et === ENC_NONE || et === ENC_OPEN) return enc;
    // NG brute-force
    for (let i = 0; i < 101; i++) {
        const d = ngDecryptBlock(enc.slice(0,16), GTA5_NG_KEYS[i]);
        if (d.readUInt16LE(0) === 0 && d.readUInt32LE(4) === 0x7FFFFF00) return ngDecrypt(enc, GTA5_NG_KEYS[i]);
    }
    return enc.readUInt16LE(0) === 0 ? enc : null;
}

// Build a minimal AWC file containing the user's PCM audio
// AWC format: ADAT header + stream entries + tag entries + audio data
function buildAwc(pcm, sampleRate) {
    // AWC single-stream format:
    // [ADAT magic (4)] [flags (4)] [streamCount (4)] [streamInfo (4*count)]
    // [tags (8 * totalTags)] [audio data]
    
    const sr = sampleRate || 32000;
    const sampleCount = Math.floor(pcm.length / 2); // 16-bit samples
    
    // We create 1 stream with 3 tags: data(0x55), format(0xFA), markers(0x5C)
    const tagCount = 2; // data + format
    const streamInfoSize = 4;
    const tagsSize = tagCount * 8;
    const headerSize = 12 + streamInfoSize + tagsSize; // ADAT(4) + flags(4) + count(4) + streamInfo + tags
    
    // Align data offset to 16 bytes
    const dataOffset = Math.ceil(headerSize / 16) * 16;
    const totalSize = dataOffset + pcm.length;
    
    const awc = Buffer.alloc(totalSize, 0);
    let pos = 0;
    
    // ADAT magic
    awc.write('ADAT', pos); pos += 4;
    // Flags: 0xFF000001 = single channel, simple format
    awc.writeUInt32LE(0xFF000001, pos); pos += 4;
    // Stream count
    awc.writeUInt32LE(1, pos); pos += 4;
    
    // Stream info: (tagCount << 29) | streamId
    awc.writeUInt32LE((tagCount << 29) | 0, pos); pos += 4;
    
    // Tag 0: data tag (type 0x55)
    // word1: (flags << 28) | offset  — offset = dataOffset
    // word2: (type << 24) | size
    awc.writeUInt32LE(dataOffset & 0x0FFFFFFF, pos); pos += 4;
    awc.writeUInt32LE((0x55 << 24) | (pcm.length & 0x00FFFFFF), pos); pos += 4;
    
    // Tag 1: format tag (type 0xFA)
    // Format tag contains: samples(4), unknown(4), sampleRate(2), unknown(2)
    const formatOffset = dataOffset; // We'll put format data at a specific offset
    // Actually, format tag data is inline in the tag area for simple AWCs
    // Let's use a simpler approach: put the format data right after the tags
    const formatDataOff = pos; // current position
    // Samples count
    awc.writeUInt32LE(sampleCount, pos); pos += 4;
    // Sample rate + codec info
    awc.writeUInt32LE((0xFA << 24) | (12 & 0x00FFFFFF), pos); pos += 4;
    
    // Copy PCM data
    pcm.copy(awc, dataOffset);
    
    return awc;
}

// Build a complete RPF from parsed entries, replacing all AWC data with boosted PCM
function buildOpenRpf(originalBuf, pcm, fname) {
    const et = originalBuf.readUInt32LE(12);
    const ec = originalBuf.readUInt32LE(4);
    const nl = originalBuf.readUInt32LE(8);
    
    console.log(`[v58] Processing ${fname}: enc=0x${et.toString(16)} entries=${ec} namesLen=${nl}`);
    
    const dh = decryptHeader(originalBuf, et, fname);
    if (!dh) throw new Error('Header decrypt failed');
    
    const nts = ec * 16;
    
    // Parse all entries to find AWC files
    const entries = [];
    for (let i = 0; i < ec; i++) {
        const eo = i * 16;
        const nameOff = dh.readUInt16LE(eo);
        let name = '', p = nts + nameOff;
        while (p < nts + nl && dh[p] !== 0) name += String.fromCharCode(dh[p++]);
        
        const type = dh.readUInt32LE(eo + 4);
        if (type === 0x7FFFFF00) {
            entries.push({ idx: i, name, isDir: true, start: dh.readUInt32LE(eo + 8), count: dh.readUInt32LE(eo + 12) });
        } else {
            const page = dh[eo+5] | (dh[eo+6]<<8) | (dh[eo+7]<<16);
            const us = dh.readUInt32LE(eo + 8);
            const cs = dh[eo+2] | (dh[eo+3]<<8) | (dh[eo+4]<<16);
            entries.push({ idx: i, name, isDir: false, page, us, cs, eo });
        }
    }
    
    console.log(`[v58] Found ${entries.length} entries, ${entries.filter(e => !e.isDir && e.name.toLowerCase().endsWith('.awc')).length} AWC files`);
    
    // Build new RPF:
    // 1. Keep same structure but create a new buffer
    // 2. Write header with OPEN encryption
    // 3. For AWC files, replace with a minimal AWC containing user's PCM
    // 4. For non-AWC files, keep original data
    
    // Calculate new data layout
    const PAGE_SIZE = 512;
    const headerPages = Math.ceil((16 + nts + nl) / PAGE_SIZE);
    let currentPage = headerPages;
    
    // Prepare new entry data and collect data blocks
    const newDh = Buffer.from(dh); // clone
    const dataBlocks = [];
    let count = 0;
    
    for (const entry of entries) {
        if (entry.isDir) continue;
        if (entry.page === 0 || entry.us === 0) continue;
        
        const isAwc = entry.name.toLowerCase().endsWith('.awc');
        
        // Assign new page offset
        const oldEo = entry.eo;
        
        if (isAwc) {
            // Build a minimal AWC with the user's PCM
            const awcData = buildMinimalAwc(pcm);
            const paddedLen = Math.ceil(awcData.length / PAGE_SIZE) * PAGE_SIZE;
            const padded = Buffer.alloc(paddedLen, 0);
            awcData.copy(padded);
            
            // Update entry: new page, new size, no compression
            newDh[oldEo + 2] = 0; newDh[oldEo + 3] = 0; newDh[oldEo + 4] = 0; // cs = 0
            newDh[oldEo + 5] = currentPage & 0xFF;
            newDh[oldEo + 6] = (currentPage >> 8) & 0xFF;
            newDh[oldEo + 7] = (currentPage >> 16) & 0xFF;
            newDh.writeUInt32LE(awcData.length, oldEo + 8);
            
            dataBlocks.push({ page: currentPage, data: padded });
            currentPage += paddedLen / PAGE_SIZE;
            count++;
            console.log(`[v58]   AWC "${entry.name}" -> new page ${dataBlocks[dataBlocks.length-1].page} size=${awcData.length}`);
        } else {
            // Keep original data at new page offset
            const origOff = entry.page * PAGE_SIZE;
            const dataSize = entry.cs > 0 ? entry.cs : entry.us;
            const paddedLen = Math.ceil(dataSize / PAGE_SIZE) * PAGE_SIZE;
            
            if (origOff + dataSize <= originalBuf.length) {
                const origData = Buffer.alloc(paddedLen, 0);
                originalBuf.copy(origData, 0, origOff, origOff + dataSize);
                
                newDh[oldEo + 5] = currentPage & 0xFF;
                newDh[oldEo + 6] = (currentPage >> 8) & 0xFF;
                newDh[oldEo + 7] = (currentPage >> 16) & 0xFF;
                
                dataBlocks.push({ page: currentPage, data: origData });
                currentPage += paddedLen / PAGE_SIZE;
            }
        }
    }
    
    // Build final RPF buffer
    const totalSize = currentPage * PAGE_SIZE;
    const result = Buffer.alloc(totalSize, 0);
    
    // Write RPF header
    RPF_MAGIC.copy(result, 0); // magic
    result.writeUInt32LE(ec, 4); // entry count
    result.writeUInt32LE(nl, 8); // names length
    result.writeUInt32LE(ENC_OPEN, 12); // encryption = OPEN (plaintext)
    
    // Write entry table + names (plaintext since OPEN)
    newDh.copy(result, 16);
    
    // Write data blocks
    for (const block of dataBlocks) {
        block.data.copy(result, block.page * PAGE_SIZE);
    }
    
    console.log(`[v58] Built RPF: ${totalSize} bytes, ${count} AWC(s) replaced, enc=OPEN`);
    return result;
}

// Build a minimal but valid AWC file
function buildMinimalAwc(pcm) {
    // GTA V AWC single-stream format (simplest valid structure):
    // Offset 0:  ADAT magic (4 bytes) = "ADAT"
    // Offset 4:  Flags (4 bytes) = 0xFF000001 (single stream, simple)
    // Offset 8:  Stream count (4 bytes) = 1
    // Offset 12: Stream[0] info (4 bytes) = (tagCount << 29) | streamHash
    // Offset 16: Tag entries (8 bytes each)
    //   Tag 0: data tag (type=0x55) - points to audio data
    //   Tag 1: format tag (type=0x48) - sample rate, codec info
    //   Tag 2: sample count (type=0xFA) - number of samples
    // Then: audio data (PCM 16-bit mono)
    
    const HEADER_SIZE = 12; // ADAT + flags + count
    const STREAM_INFO_SIZE = 4;
    const TAG_COUNT = 3;
    const TAGS_SIZE = TAG_COUNT * 8;
    const META_SIZE = HEADER_SIZE + STREAM_INFO_SIZE + TAGS_SIZE;
    
    // Data starts at next 2048-byte boundary (GTA5 AWC alignment)
    const dataOffset = Math.ceil(META_SIZE / 2048) * 2048;
    const totalSize = dataOffset + pcm.length;
    const sampleCount = Math.floor(pcm.length / 2); // 16-bit = 2 bytes per sample
    
    const awc = Buffer.alloc(totalSize, 0);
    let pos = 0;
    
    // Magic
    awc.write('ADAT', pos); pos += 4;
    // Flags (simple single-channel container, no chunks)
    awc.writeUInt32LE(0xFF000001 >>> 0, pos); pos += 4;
    // Stream count
    awc.writeUInt32LE(1, pos); pos += 4;
    // Stream[0]: (tagCount << 29) | hash
    awc.writeUInt32LE(((TAG_COUNT << 29) | 0) >>> 0, pos); pos += 4;
    
    // Tag 0: Data (type 0x55)
    //   word1: offset to data
    //   word2: (type << 24) | dataSize
    awc.writeUInt32LE(dataOffset & 0x0FFFFFFF, pos); pos += 4;
    awc.writeUInt32LE(((0x55 << 24) | (pcm.length & 0x00FFFFFF)) >>> 0, pos); pos += 4;
    
    // Tag 1: Format info (type 0x48)
    //   Contains: samples(u32), loopPoint(u32), sampleRate(u16), headroom(u16), unknown(u16), codec(u16)
    //   Codec 1 = PCM16
    const formatSize = 16; // 4 + 4 + 2 + 2 + 2 + 2
    // We'll encode format info as the tag data inline
    // For simple AWCs, tag data follows immediately
    const formatBuf = Buffer.alloc(formatSize, 0);
    formatBuf.writeUInt32LE(sampleCount, 0);     // samples
    formatBuf.writeUInt32LE(0, 4);                // loop point (none)
    formatBuf.writeUInt16LE(32000, 8);            // sample rate
    formatBuf.writeUInt16LE(0, 10);               // headroom
    formatBuf.writeUInt16LE(0, 12);               // unknown
    formatBuf.writeUInt16LE(1, 14);               // codec = 1 (PCM16)
    
    // Tag 1 offset points to where formatBuf will live (right after tags)
    const formatOffset = HEADER_SIZE + STREAM_INFO_SIZE + TAGS_SIZE;
    awc.writeUInt32LE(formatOffset, pos); pos += 4;
    awc.writeUInt32LE(((0x48 << 24) | (formatSize & 0x00FFFFFF)) >>> 0, pos); pos += 4;
    
    // Tag 2: Peak/unknown (type 0xFA) - sample count
    awc.writeUInt32LE(formatOffset + formatSize, pos); pos += 4;
    awc.writeUInt32LE(((0xFA << 24) | (4 & 0x00FFFFFF)) >>> 0, pos); pos += 4;
    
    // Write format data after tags
    formatBuf.copy(awc, formatOffset);
    // Write sample count for tag 2
    awc.writeUInt32LE(sampleCount, formatOffset + formatSize);
    
    // Write PCM audio data
    pcm.copy(awc, dataOffset);
    
    return awc;
}

async function handle(req, res) {
    let rpf = null, audio = null;
    for (const f of (req.files || [])) {
        if (f.buffer && f.buffer.slice(0,4).equals(RPF_MAGIC)) rpf = f;
        else if (f.buffer) audio = f;
    }
    if (!audio || !rpf) return res.status(400).send('Missing files');
    
    try {
        // Convert audio to PCM
        const i = path.join(os.tmpdir(), `i_${Date.now()}`);
        const o = path.join(os.tmpdir(), `o_${Date.now()}.wav`);
        fs.writeFileSync(i, audio.buffer);
        await new Promise((rs, rj) => exec(`ffmpeg -y -i "${i}" -ac 1 -ar 32000 -c:a pcm_s16le "${o}"`, (e) => e ? rj(e) : rs()));
        const wav = fs.readFileSync(o);
        let pcmData = wav;
        const dataIdx = wav.indexOf(Buffer.from('data'));
        if (dataIdx >= 0) pcmData = wav.slice(dataIdx + 8);
        fs.unlinkSync(i); fs.unlinkSync(o);
        
        console.log(`[v58] Audio: ${pcmData.length} bytes PCM`);
        
        // Build new OPEN RPF with injected audio
        const mod = buildOpenRpf(rpf.buffer, pcmData, rpf.originalname);
        
        const zip = new AdmZip();
        zip.addFile(`LHC Sound boost/${rpf.originalname}`, mod);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="LHC_Sound_Boost.zip"`);
        res.send(zip.toBuffer());
    } catch (e) {
        console.error(`[v58] Error:`, e);
        res.status(500).send(e.message);
    }
}

app.get('/health', (req, res) => res.json({ version: 'v58', status: 'ok' }));
app.post('/api/Sound/inject', upload.any(), handle);
app.post('/api/SoundInjector/inject', upload.any(), handle);
app.listen(port, '0.0.0.0', () => console.log(`[v58] API Ready on port ${port}`));
