'use strict';
const express  = require('express');
const multer   = require('multer');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const { exec } = require('child_process');
const AdmZip   = require('adm-zip');
const crypto   = require('crypto');

const app  = express();
const port = 5000;
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload  = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

const RESIDENT_RPF_PATH = '/opt/lhc-sound/RESIDENT.rpf';
const KEYS_DIR          = '/opt/lhc-keys';

// ── RPF7 encryption constants ────────────────────────────────────────────────
const RPF_MAGIC = Buffer.from([0x37, 0x46, 0x50, 0x52]);
const ENC_OPEN  = 0x4E45504F;
const ENC_NONE  = 0x00000000;
const ENC_AES   = 0x0FFFFFF9;
const ENC_NG    = 0x0FEFFFFF;

// ── Key material (loaded at startup from /opt/lhc-keys) ─────────────────────
let GTA5_AES_KEY  = null;   // Buffer, 32 bytes
let GTA5_NG_KEYS  = null;   // Array of 101 Buffers, each 272 bytes
let GTA5_NG_TABLES = null;  // Array[17][16][256] of uint32
let GTA5_HASH_LUT  = null;  // Buffer, 256 bytes

function loadKeys() {
    try {
        const aesPath    = path.join(KEYS_DIR, 'gtav_aes_key.dat');
        const ngKeyPath  = path.join(KEYS_DIR, 'gtav_ng_key.dat');
        const ngTabPath  = path.join(KEYS_DIR, 'gtav_ng_decrypt_tables.dat');
        const lutPath    = path.join(KEYS_DIR, 'gtav_hash_lut.dat');

        if (!fs.existsSync(aesPath)) {
            console.warn('[v20] Key files not found in', KEYS_DIR, '— encrypted RPF support disabled');
            return;
        }

        GTA5_AES_KEY = fs.readFileSync(aesPath);

        const ngKeyRaw = fs.readFileSync(ngKeyPath);
        const NG_ENTRY = 272; // 68 uint32 × 4 bytes per key
        GTA5_NG_KEYS = [];
        for (let i = 0; i < 101; i++) {
            GTA5_NG_KEYS.push(ngKeyRaw.slice(i * NG_ENTRY, (i + 1) * NG_ENTRY));
        }

        const ngTabRaw = fs.readFileSync(ngTabPath);
        GTA5_NG_TABLES = [];
        let off = 0;
        for (let r = 0; r < 17; r++) {
            GTA5_NG_TABLES[r] = [];
            for (let t = 0; t < 16; t++) {
                const table = new Uint32Array(256);
                for (let e = 0; e < 256; e++) {
                    table[e] = ngTabRaw.readUInt32LE(off);
                    off += 4;
                }
                GTA5_NG_TABLES[r].push(table);
            }
        }

        GTA5_HASH_LUT = fs.readFileSync(lutPath);

        console.log('[v20] Crypto keys loaded successfully');
    } catch (e) {
        console.warn('[v20] Failed to load crypto keys:', e.message);
    }
}

loadKeys();

// ── GTA5 hash (used for NG key selection) ────────────────────────────────────
function gta5Hash(text) {
    let result = 0;
    for (let i = 0; i < text.length; i++) {
        const c = GTA5_HASH_LUT
            ? GTA5_HASH_LUT[text.charCodeAt(i) & 0xFF]
            : (text.charCodeAt(i) | 0x20) & 0xFF; // lowercase fallback
        const sum  = (c + result) >>> 0;
        const temp = Math.imul(1025, sum) >>> 0;
        result     = ((temp >>> 6) ^ temp) >>> 0;
    }
    const r9 = Math.imul(9, result) >>> 0;
    return Math.imul(32769, ((r9 >>> 11) ^ r9) >>> 0) >>> 0;
}

// ── NG decryption (ported from RageLib.GTA5 GTA5Encryption.cs) ───────────────
function ngDecryptRoundA(data, subKey, table) {
    const x1 = (table[0][data[0]] ^ table[1][data[1]]  ^ table[2][data[2]]   ^ table[3][data[3]]   ^ subKey[0]) >>> 0;
    const x2 = (table[4][data[4]] ^ table[5][data[5]]  ^ table[6][data[6]]   ^ table[7][data[7]]   ^ subKey[1]) >>> 0;
    const x3 = (table[8][data[8]] ^ table[9][data[9]]  ^ table[10][data[10]] ^ table[11][data[11]] ^ subKey[2]) >>> 0;
    const x4 = (table[12][data[12]]^ table[13][data[13]]^ table[14][data[14]]^ table[15][data[15]] ^ subKey[3]) >>> 0;
    const r  = Buffer.allocUnsafe(16);
    r.writeUInt32LE(x1, 0); r.writeUInt32LE(x2, 4);
    r.writeUInt32LE(x3, 8); r.writeUInt32LE(x4, 12);
    return r;
}

function ngDecryptRoundB(data, subKey, table) {
    const x1 = (table[0][data[0]]  ^ table[7][data[7]]  ^ table[10][data[10]] ^ table[13][data[13]] ^ subKey[0]) >>> 0;
    const x2 = (table[1][data[1]]  ^ table[4][data[4]]  ^ table[11][data[11]] ^ table[14][data[14]] ^ subKey[1]) >>> 0;
    const x3 = (table[2][data[2]]  ^ table[5][data[5]]  ^ table[8][data[8]]   ^ table[15][data[15]] ^ subKey[2]) >>> 0;
    const x4 = (table[3][data[3]]  ^ table[6][data[6]]  ^ table[9][data[9]]   ^ table[12][data[12]] ^ subKey[3]) >>> 0;
    const r  = Buffer.allocUnsafe(16);
    r.writeUInt32LE(x1, 0); r.writeUInt32LE(x2, 4);
    r.writeUInt32LE(x3, 8); r.writeUInt32LE(x4, 12);
    return r;
}

function ngDecryptBlock(block, keyBuf) {
    // Build 17 subkeys of 4 uint32 each from the 272-byte key
    const subKeys = [];
    for (let i = 0; i < 17; i++) {
        subKeys.push([
            keyBuf.readUInt32LE(i * 16),
            keyBuf.readUInt32LE(i * 16 + 4),
            keyBuf.readUInt32LE(i * 16 + 8),
            keyBuf.readUInt32LE(i * 16 + 12),
        ]);
    }

    let buf = block;
    buf = ngDecryptRoundA(buf, subKeys[0],  GTA5_NG_TABLES[0]);
    buf = ngDecryptRoundA(buf, subKeys[1],  GTA5_NG_TABLES[1]);
    for (let k = 2; k <= 15; k++) {
        buf = ngDecryptRoundB(buf, subKeys[k], GTA5_NG_TABLES[k]);
    }
    buf = ngDecryptRoundA(buf, subKeys[16], GTA5_NG_TABLES[16]);
    return buf;
}

function ngDecrypt(data, keyBuf) {
    const out    = Buffer.from(data);
    const blocks = Math.floor(data.length / 16);
    for (let b = 0; b < blocks; b++) {
        const dec = ngDecryptBlock(data.slice(b * 16, b * 16 + 16), keyBuf);
        dec.copy(out, b * 16);
    }
    // Trailing partial block kept as-is (matches GTA5Crypto.Decrypt behaviour)
    return out;
}

function isValidRootDir(dec16) {
    // Root directory entry: nameOff=0 AND w4=0x7FFFFF00 (dir marker)
    return dec16.readUInt16LE(0) === 0 && dec16.readUInt32LE(4) === 0x7FFFFF00;
}

function findNgKey(encBlock, filename, fileSize) {
    // 1. Try key derived from filename + file size (fast path)
    if (filename) {
        const idx    = ((gta5Hash(filename) + fileSize + 61) >>> 0) % 101;
        const keyBuf = GTA5_NG_KEYS[idx];
        const test   = ngDecryptBlock(encBlock.slice(0, 16), keyBuf);
        if (isValidRootDir(test)) return keyBuf;
    }
    // 2. Brute-force all 101 keys
    for (let i = 0; i < 101; i++) {
        const test = ngDecryptBlock(encBlock.slice(0, 16), GTA5_NG_KEYS[i]);
        if (isValidRootDir(test)) return GTA5_NG_KEYS[i];
    }
    throw new Error('No se pudo encontrar la clave NG para este RPF. Archivo no reconocido.');
}

// ── AES decryption (ECB, no padding) ─────────────────────────────────────────
function aesDecrypt(data) {
    const decipher = crypto.createDecipheriv('aes-256-ecb', GTA5_AES_KEY, null);
    decipher.setAutoPadding(false);
    const blocks  = Math.floor(data.length / 16);
    const aligned = data.slice(0, blocks * 16);
    const tail    = data.slice(blocks * 16);
    const dec     = Buffer.concat([decipher.update(aligned), decipher.final()]);
    return tail.length ? Buffer.concat([dec, tail]) : dec;
}

// ── Decrypt RPF header (entries + names) and return OPEN-flagged buffer ───────
function openRpfBuffer(rpfBuffer, encType, originalFilename) {
    const entryCount  = rpfBuffer.readUInt32LE(4);
    const namesLength = rpfBuffer.readUInt32LE(8);
    const blockStart  = 16;
    const blockEnd    = blockStart + entryCount * 16 + namesLength;
    const encBlock    = rpfBuffer.slice(blockStart, blockEnd);

    let decBlock;
    if (encType === ENC_AES) {
        if (!GTA5_AES_KEY) throw new Error('Claves AES no cargadas en el servidor.');
        decBlock = aesDecrypt(encBlock);
    } else {
        if (!GTA5_NG_KEYS || !GTA5_NG_TABLES) throw new Error('Claves NG no cargadas en el servidor.');
        const ngKey = findNgKey(encBlock, originalFilename, rpfBuffer.length);
        decBlock = ngDecrypt(encBlock, ngKey);
    }

    const result = Buffer.from(rpfBuffer);
    result.writeUInt32LE(ENC_OPEN, 12);  // mark as OPEN so existing parser works
    decBlock.copy(result, blockStart, 0, encBlock.length);

    // For NG RPFs, file data is also per-file NG-encrypted — decrypt all entries
    if (encType === ENC_NG) {
        decryptAllNgFileData(result);
    }

    return result;
}

// Decrypts all file-entry data in-place for a header-decrypted (OPEN-flagged) NG RPF buffer
function decryptAllNgFileData(openBuf) {
    const entryCount     = openBuf.readUInt32LE(4);
    const namesLength    = openBuf.readUInt32LE(8);
    const nameTableStart = 16 + entryCount * 16;
    const nameTableEnd   = nameTableStart + namesLength;

    // Build name table map
    const namesMap = new Map();
    let p = nameTableStart;
    while (p < nameTableEnd) {
        const startOff = p - nameTableStart;
        let name = '';
        while (p < nameTableEnd && openBuf[p] !== 0) name += String.fromCharCode(openBuf[p++]);
        namesMap.set(startOff, name.toLowerCase());
        p++;
    }

    for (let i = 0; i < entryCount; i++) {
        const eOff = 16 + i * 16;
        const w4   = openBuf.readUInt32LE(eOff + 4);
        if (w4 === 0x7FFFFF00) continue; // directory entry

        const nameOff  = openBuf.readUInt16LE(eOff);
        const name     = namesMap.get(nameOff) || '';
        const dataPage = openBuf[eOff+5] | (openBuf[eOff+6]<<8) | (openBuf[eOff+7]<<16);
        const dataOff  = dataPage * 512;
        const fileSize = openBuf.readUInt32LE(eOff + 8);

        if (dataOff === 0 || fileSize === 0 || dataOff + fileSize > openBuf.length) continue;

        const keyIdx = ((gta5Hash(name) + fileSize + 61) >>> 0) % 101;
        const enc    = openBuf.slice(dataOff, dataOff + fileSize);
        const dec    = ngDecrypt(enc, GTA5_NG_KEYS[keyIdx]);
        dec.copy(openBuf, dataOff);
    }
}

app.get('/ping', (req, res) => res.send('pong v20'));

// ──────────────────────────────────────────────────────────────────────────────
// SOUND INJECT  POST /api/Sound/inject
// Accepts: audio (MP3/WAV/OGG) + rpf (OPEN, AES or NG weapon sound RPF)
// Returns: ZIP "LHC Sound boost/" with WEAPONS_PLAYER.rpf + RESIDENT.rpf
// ──────────────────────────────────────────────────────────────────────────────
app.post('/api/Sound/inject',
    upload.fields([
        { name: 'audio', maxCount: 1 },
        { name: 'rpf',   maxCount: 1 },
    ]),
    async (req, res) => {
        const audioFile = req.files?.['audio']?.[0];
        const rpfFile   = req.files?.['rpf']?.[0];

        if (!audioFile) return res.status(400).send('Falta el archivo de audio (campo: audio)');
        if (!rpfFile)   return res.status(400).send('Falta el archivo RPF (campo: rpf)');

        try {
            // 1. Convert uploaded audio → OGG Vorbis via ffmpeg
            const oggBuffer = await convertToOgg(audioFile.buffer, audioFile.originalname || 'audio.mp3');

            // 2. Decrypt RPF header if AES/NG-encrypted
            let rpfBuffer = rpfFile.buffer;
            if (!rpfBuffer.slice(0, 4).equals(RPF_MAGIC)) {
                return res.status(400).send('Archivo RPF inválido (magic incorrecto).');
            }
            const encType = rpfBuffer.readUInt32LE(12);
            if (encType === ENC_AES || encType === ENC_NG) {
                const encName = encType === ENC_AES ? 'AES' : 'NG';
                console.log(`[v20] Decrypting ${encName}-encrypted RPF: ${rpfFile.originalname}`);
                rpfBuffer = openRpfBuffer(rpfBuffer, encType, rpfFile.originalname || '');
                console.log('[v20] Decryption OK — proceeding with injection');
            }

            // 3. Inject OGG into the (now OPEN) RPF
            const modifiedRpf = injectAudioIntoRpf(rpfBuffer, oggBuffer);

            // 4. Package into ZIP
            const zip = new AdmZip();
            zip.addFile('LHC Sound boost/WEAPONS_PLAYER.rpf', modifiedRpf);
            if (fs.existsSync(RESIDENT_RPF_PATH)) {
                zip.addLocalFile(RESIDENT_RPF_PATH, 'LHC Sound boost');
            }

            const zipBuffer = zip.toBuffer();
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', 'attachment; filename="LHC Sound boost.zip"');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
            res.send(zipBuffer);

        } catch (e) {
            console.error('[Sound] Error:', e.message);
            res.status(500).send(e.message);
        }
    }
);

app.get('/api/Sound/test', (req, res) => {
    const hasResident  = fs.existsSync(RESIDENT_RPF_PATH);
    const keysLoaded   = !!(GTA5_AES_KEY && GTA5_NG_KEYS && GTA5_NG_TABLES);
    res.send(
        `Sound API v3.0 (NG/AES decrypt) | ` +
        `RESIDENT.rpf: ${hasResident ? 'OK' : 'NOT FOUND'} | ` +
        `Crypto keys: ${keysLoaded ? 'OK' : 'NOT LOADED'} | ` +
        `ffmpeg: OK`
    );
});

// ──────────────────────────────────────────────────────────────────────────────
// Audio conversion: any audio → OGG Vorbis 44100 Hz
// ──────────────────────────────────────────────────────────────────────────────
function convertToOgg(audioBuffer, originalName) {
    const ext    = path.extname(originalName || '.mp3') || '.mp3';
    const tmpIn  = path.join(os.tmpdir(), `lhc_${Date.now()}_in${ext}`);
    const tmpOut = path.join(os.tmpdir(), `lhc_${Date.now()}_out.ogg`);

    return new Promise((resolve, reject) => {
        fs.writeFileSync(tmpIn, audioBuffer);
        exec(
            `ffmpeg -y -i "${tmpIn}" -acodec libvorbis -ar 44100 -q:a 4 "${tmpOut}" 2>&1`,
            (err, stdout) => {
                const cleanup = () => {
                    [tmpIn, tmpOut].forEach(f => { try { fs.unlinkSync(f); } catch {} });
                };
                if (err) {
                    cleanup();
                    return reject(new Error('Error convirtiendo audio: ' + stdout.slice(-300)));
                }
                try {
                    const buf = fs.readFileSync(tmpOut);
                    cleanup();
                    resolve(buf);
                } catch (e2) {
                    cleanup();
                    reject(new Error('No se pudo leer el OGG convertido'));
                }
            }
        );
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// RPF audio injection (works on OPEN RPFs only — call openRpfBuffer first)
// ──────────────────────────────────────────────────────────────────────────────
function injectAudioIntoRpf(rpfBuffer, oggBuffer) {
    if (!rpfBuffer.slice(0, 4).equals(RPF_MAGIC)) {
        throw new Error('Archivo RPF inválido (magic incorrecto). ¿Es realmente un RPF?');
    }

    const enc = rpfBuffer.readUInt32LE(12);
    if (enc !== ENC_OPEN && enc !== ENC_NONE) {
        throw new Error(
            `El RPF está encriptado (0x${enc.toString(16)}). ` +
            `Debes subir un RPF OPEN (sin encriptar) o el servidor fallará al desencriptarlo.`
        );
    }

    const entryCount     = rpfBuffer.readUInt32LE(4);
    const namesLength    = rpfBuffer.readUInt32LE(8);
    const nameTableStart = 16 + entryCount * 16;
    const nameTableEnd   = nameTableStart + namesLength;

    // Parse names table
    const namesMap = new Map();
    let p = nameTableStart;
    while (p < nameTableEnd) {
        const startOff = p - nameTableStart;
        let name = '';
        while (p < nameTableEnd && rpfBuffer[p] !== 0) {
            name += String.fromCharCode(rpfBuffer[p++]);
        }
        namesMap.set(startOff, name.toLowerCase());
        p++;
    }

    // Find the audio entry (.awc preferred)
    const AUDIO_EXTS = ['.awc', '.wav', '.ogg', '.mp3'];
    let audioEntry = null;

    for (let i = 0; i < entryCount; i++) {
        const eOff     = 16 + i * 16;
        const nameOff  = rpfBuffer.readUInt16LE(eOff);
        const w4       = rpfBuffer.readUInt32LE(eOff + 4);

        if (w4 === 0x7FFFFF00) continue; // directory entry

        const name    = namesMap.get(nameOff) || '';
        const isAudio = AUDIO_EXTS.some(ext => name.endsWith(ext));

        if (isAudio || (!audioEntry && i > 0)) {
            const dataPage       = rpfBuffer[eOff+5] | (rpfBuffer[eOff+6]<<8) | (rpfBuffer[eOff+7]<<16);
            const dataOffset     = dataPage * 512;
            const uncompressedSize = rpfBuffer.readUInt32LE(eOff + 8);
            audioEntry = { idx: i, eOff, name, dataOffset, uncompressedSize, w4 };
            if (isAudio) break;
        }
    }

    const oggMagic  = Buffer.from([0x4F, 0x67, 0x67, 0x53]);
    const dataStart = Math.ceil(nameTableEnd / 512) * 512;

    if (!audioEntry) {
        const oggIdx = rpfBuffer.indexOf(oggMagic, dataStart);
        if (oggIdx < 0) {
            throw new Error(
                'No se encontró audio (AWC/OGG) en el RPF. ' +
                'Asegúrate de subir el RPF de sonido del arma correcto.'
            );
        }
        return replaceOggInPlace(rpfBuffer, oggIdx, rpfBuffer.length - oggIdx, oggBuffer);
    }

    // Find OGG within the audio entry (may be wrapped in AWC container)
    let audioSlice = rpfBuffer.slice(audioEntry.dataOffset, audioEntry.dataOffset + audioEntry.uncompressedSize);
    let oggInSlice = audioSlice.indexOf(oggMagic);

    // If OGG not found in raw data, the file data is per-file NG-encrypted (NG RPFs)
    if (oggInSlice < 0 && GTA5_NG_KEYS && GTA5_NG_TABLES) {
        const keyIdx   = ((gta5Hash(audioEntry.name) + audioEntry.uncompressedSize + 61) >>> 0) % 101;
        const decSlice = ngDecrypt(audioSlice, GTA5_NG_KEYS[keyIdx]);
        const oggInDec = decSlice.indexOf(oggMagic);
        if (oggInDec >= 0) {
            console.log(`[Sound] Per-file NG decrypt OK for "${audioEntry.name}" (key[${keyIdx}])`);
            audioSlice = decSlice;
            oggInSlice = oggInDec;
        }
    }

    if (oggInSlice < 0) {
        throw new Error(
            `No se encontraron datos OGG dentro de "${audioEntry.name}". ` +
            `Asegúrate de que el RPF contiene audio OGG/AWC válido.`
        );
    }

    const oggAbsOffset    = audioEntry.dataOffset + oggInSlice;
    const originalOggSize = audioEntry.uncompressedSize - oggInSlice;

    if (oggBuffer.length <= originalOggSize) {
        const result = Buffer.from(rpfBuffer);
        oggBuffer.copy(result, oggAbsOffset);
        result.fill(0, oggAbsOffset + oggBuffer.length, oggAbsOffset + originalOggSize);
        return result;
    }

    console.log(`[Sound] OGG larger than original (${oggBuffer.length} > ${originalOggSize}) — rebuilding RPF`);
    return rebuildRpf(rpfBuffer, audioEntry, audioSlice, oggBuffer, oggInSlice, entryCount, namesLength, nameTableStart, nameTableEnd);
}

function replaceOggInPlace(rpfBuffer, oggAbsOffset, originalOggSize, newOgg) {
    if (newOgg.length <= originalOggSize) {
        const result = Buffer.from(rpfBuffer);
        newOgg.copy(result, oggAbsOffset);
        result.fill(0, oggAbsOffset + newOgg.length, oggAbsOffset + originalOggSize);
        return result;
    }
    const diff   = newOgg.length - originalOggSize;
    const result = Buffer.alloc(rpfBuffer.length + diff, 0);
    rpfBuffer.copy(result, 0, 0, oggAbsOffset);
    newOgg.copy(result, oggAbsOffset);
    rpfBuffer.copy(result, oggAbsOffset + newOgg.length, oggAbsOffset + originalOggSize);
    return result;
}

function rebuildRpf(rpfBuffer, targetEntry, decryptedAudioSlice, newOgg, oggOffsetInEntry, entryCount, namesLength, nameTableStart, nameTableEnd) {
    const preamble      = decryptedAudioSlice.slice(0, oggOffsetInEntry);
    const newAudioData  = Buffer.concat([preamble, newOgg]);

    const entries = [];
    for (let i = 0; i < entryCount; i++) {
        const eOff       = 16 + i * 16;
        const nameOff    = rpfBuffer.readUInt16LE(eOff);
        const w2         = rpfBuffer.readUInt16LE(eOff + 2);
        const w4         = rpfBuffer.readUInt32LE(eOff + 4);
        const sizeOnDisk = rpfBuffer.readUInt32LE(eOff + 8);
        const w12        = rpfBuffer.readUInt32LE(eOff + 12);
        const isDir      = (w4 === 0x7FFFFF00);

        let data = null;
        if (!isDir) {
            if (i === targetEntry.idx) {
                data = newAudioData;
            } else {
                const dPageRaw = rpfBuffer[eOff+5] | (rpfBuffer[eOff+6]<<8) | (rpfBuffer[eOff+7]<<16);
                const dOff = dPageRaw * 512;
                if (dOff > 0 && dOff + sizeOnDisk <= rpfBuffer.length) {
                    data = Buffer.from(rpfBuffer.slice(dOff, dOff + sizeOnDisk));
                }
            }
        }
        entries.push({ nameOff, w2, w4, sizeOnDisk: data ? data.length : sizeOnDisk, w12, isDir, data });
    }

    const tocEnd       = nameTableEnd;
    const newDataStart = Math.ceil(tocEnd / 512) * 512;
    let   currentPage  = newDataStart / 512;

    const fileOffsets = entries.map(e => {
        if (e.isDir || !e.data) return { page: null };
        const page = currentPage;
        currentPage += Math.ceil(e.data.length / 512);
        return { page };
    });

    const totalBytes = currentPage * 512;
    const output     = Buffer.alloc(totalBytes, 0);

    RPF_MAGIC.copy(output, 0);
    output.writeUInt32LE(entryCount,  4);
    output.writeUInt32LE(namesLength, 8);
    output.writeUInt32LE(ENC_OPEN,    12);

    for (let i = 0; i < entries.length; i++) {
        const e  = entries[i];
        const fo = fileOffsets[i];
        const ep = 16 + i * 16;

        // Copy the original entry as base (preserves all fields we don't explicitly change)
        rpfBuffer.copy(output, ep, 16 + i * 16, 16 + i * 16 + 16);

        if (!e.isDir && fo.page !== null) {
            // Write new page into bytes[5-7] of entry (3-byte LE page index)
            output[ep + 5] = fo.page & 0xFF;
            output[ep + 6] = (fo.page >> 8) & 0xFF;
            output[ep + 7] = (fo.page >> 16) & 0xFF;
            // Write uncompressed size into bytes[8-11]
            output.writeUInt32LE(e.sizeOnDisk, ep + 8);
            // For the replaced entry, also update compressed-size bytes[2-4]
            if (i === targetEntry.idx && e.data) {
                const cs = e.data.length;
                output[ep + 2] = cs & 0xFF;
                output[ep + 3] = (cs >> 8) & 0xFF;
                output[ep + 4] = (cs >> 16) & 0xFF;
            }
        }
    }

    rpfBuffer.copy(output, nameTableStart, nameTableStart, nameTableEnd);

    for (let i = 0; i < entries.length; i++) {
        const e  = entries[i];
        const fo = fileOffsets[i];
        if (!e.isDir && e.data && fo.page !== null) {
            e.data.copy(output, fo.page * 512);
        }
    }

    return output;
}

// ──────────────────────────────────────────────────────────────────────────────
// WEAPON CONVERTER  POST /api/WeaponConverter/convert  (v17 — unchanged)
// ──────────────────────────────────────────────────────────────────────────────
app.post('/api/WeaponConverter/convert', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');

    const targetId = (req.body.targetWeapon || '').toLowerCase().trim();
    const sourceId = (req.body.sourceWeapon || '').toLowerCase().trim();
    if (!targetId) return res.status(400).send('Missing target weapon ID.');

    const original = req.file.buffer;
    const log = [];

    try {
        log.push(`File size: ${original.length} bytes`);

        const rpfMagic  = Buffer.from([0x37, 0x46, 0x50, 0x52]);
        const rpfHeaders = [];
        let searchPos = 0;

        while ((searchPos = original.indexOf(rpfMagic, searchPos)) !== -1) {
            const entryCount  = original.readUInt32LE(searchPos + 4);
            const namesLength = original.readUInt32LE(searchPos + 8);
            const encFlag     = original.readUInt32LE(searchPos + 12);

            let encStr = 'UNKNOWN';
            if (encFlag === 0x4e45504f) encStr = 'OPEN';
            else if (encFlag === 0x0FFFFFF9) encStr = 'AES';
            else if (encFlag === 0x0FEFFFFF) encStr = 'NG';
            else if (encFlag === 0) encStr = 'NONE';
            else encStr = Buffer.from([encFlag&0xFF,(encFlag>>8)&0xFF,(encFlag>>16)&0xFF,(encFlag>>24)&0xFF]).toString('ascii');

            const nameTableOffset = searchPos + 16 + entryCount * 16;
            rpfHeaders.push({ offset: searchPos, entryCount, namesLength, encryption: encStr.trim(), nameTableOffset });
            log.push(`RPF at 0x${searchPos.toString(16)}: entries=${entryCount}, namesLen=${namesLength}, enc="${encStr}"`);
            searchPos += 4;
        }

        let totalReplacements = 0;
        const output = Buffer.from(original);

        for (const rpf of rpfHeaders) {
            if (rpf.encryption !== 'OPEN' && rpf.encryption !== 'NONE') {
                log.push(`  Skipping encrypted RPF at 0x${rpf.offset.toString(16)}`);
                continue;
            }

            const nameTableStart = rpf.nameTableOffset;
            const nameTableEnd   = nameTableStart + rpf.namesLength;
            const nameTableSize  = rpf.namesLength;

            if (nameTableSize <= 0 || nameTableSize > 100000 || nameTableEnd > output.length) {
                log.push(`  Skipping RPF at 0x${rpf.offset.toString(16)}: invalid name table size ${nameTableSize}`);
                continue;
            }

            const names = [];
            let pos = nameTableStart;
            while (pos < nameTableEnd) {
                let name = '';
                const startPos = pos;
                while (pos < nameTableEnd && output[pos] !== 0) {
                    name += String.fromCharCode(output[pos]);
                    pos++;
                }
                names.push({ name, offset: startPos - nameTableStart, originalName: name });
                pos++;
            }

            if (names.length === 0) continue;
            log.push(`  RPF at 0x${rpf.offset.toString(16)}: found ${names.length} names`);

            let hasChanges = false;
            const newNames = names.map(n => {
                let newName = n.name;
                const lower = newName.toLowerCase();
                if (lower.includes(sourceId)) {
                    const regex = new RegExp(escapeRegex(sourceId), 'gi');
                    newName = newName.replace(regex, targetId);
                    hasChanges = true;
                }
                return { ...n, newName };
            });

            if (!hasChanges) { log.push(`  No changes needed for this RPF`); continue; }

            const newNameTableSize = newNames.reduce((sum, n) => sum + n.newName.length + 1, 0);
            log.push(`  Old name table size: ${nameTableSize}, New: ${newNameTableSize}`);

            if (newNameTableSize > nameTableSize) {
                const dataStart       = Math.ceil((rpf.offset + 16 + (rpf.entryCount * 16) + rpf.namesLength) / 512) * 512;
                const paddingAvailable = dataStart - nameTableEnd;
                const extraNeeded     = newNameTableSize - nameTableSize;
                log.push(`  Need ${extraNeeded} extra bytes, padding available: ${paddingAvailable}`);
                if (extraNeeded <= paddingAvailable) {
                    output.writeUInt32LE(rpf.namesLength + extraNeeded, rpf.offset + 8);
                    log.push(`  Updated NamesLength`);
                } else {
                    log.push(`  WARNING: Not enough padding, skipping`);
                    continue;
                }
            }

            let writePos = nameTableStart;
            const newOffsets = [];
            for (const n of newNames) {
                newOffsets.push(writePos - nameTableStart);
                const nameBuf = Buffer.from(n.newName, 'ascii');
                nameBuf.copy(output, writePos);
                writePos += nameBuf.length;
                output[writePos] = 0;
                writePos++;
                if (n.name !== n.newName) {
                    log.push(`  RENAMED: "${n.name}" -> "${n.newName}"`);
                    totalReplacements++;
                }
            }
            while (writePos < nameTableEnd) { output[writePos] = 0; writePos++; }

            for (let i = 0; i < rpf.entryCount; i++) {
                const entryOffset    = rpf.offset + 16 + (i * 16);
                const currentNameOff = output.readUInt16LE(entryOffset);
                for (let j = 0; j < names.length; j++) {
                    if (names[j].offset === currentNameOff) {
                        output.writeUInt16LE(newOffsets[j], entryOffset);
                        break;
                    }
                }
            }
        }

        log.push(`Total name replacements: ${totalReplacements}`);

        if (totalReplacements === 0) {
            return res.status(400).send(`No replacements made. Source "${sourceId}" not found. Log: ${log.join(' | ')}`);
        }

        let binaryReplacements = 0;
        if (targetId.length <= sourceId.length) {
            const srcBuf = Buffer.from(sourceId, 'ascii');
            const dstBuf = Buffer.from(targetId, 'ascii');
            let offset = 0;
            while ((offset = output.indexOf(srcBuf, offset)) !== -1) {
                let inNameTable = false;
                for (const rpf of rpfHeaders) {
                    if (offset >= rpf.nameTableOffset && offset < rpf.nameTableOffset + rpf.namesLength) {
                        inNameTable = true; break;
                    }
                }
                if (!inNameTable) {
                    dstBuf.copy(output, offset);
                    for (let pp = dstBuf.length; pp < srcBuf.length; pp++) output[offset + pp] = 0x00;
                    binaryReplacements++;
                }
                offset += srcBuf.length;
            }
        }

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${targetId}.rpf"`);
        res.setHeader('X-Replacement-Count', String(totalReplacements + binaryReplacements));
        res.setHeader('X-Engine-Version', 'v20.0-ng-decrypt');
        res.setHeader('Access-Control-Expose-Headers', 'X-Replacement-Count, X-Engine-Version');
        res.send(output);

    } catch (e) {
        console.error('[v17] Error:', e);
        res.status(500).send('Converter error: ' + e.message);
    }
});

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

app.listen(port, '0.0.0.0', () => {
    console.log(`[v20] Sound Injection (NG/AES decrypt) + Converter API on port ${port}`);
});
