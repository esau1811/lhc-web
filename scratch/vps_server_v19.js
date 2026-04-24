const express = require('express');
const multer  = require('multer');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const { exec } = require('child_process');
const AdmZip  = require('adm-zip');

const app  = express();
const port = 5000;
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload  = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

const RESIDENT_RPF_PATH = '/opt/lhc-sound/RESIDENT.rpf';

// RPF7 constants
const RPF_MAGIC = Buffer.from([0x37, 0x46, 0x50, 0x52]); // "RPF7" stored LE
const ENC_OPEN  = 0x4e45504f;
const ENC_NONE  = 0x00000000;

app.get('/ping', (req, res) => res.send('pong v19'));

// ──────────────────────────────────────────────────────────────────────────────
// SOUND INJECT  POST /api/Sound/inject
// Accepts: audio (MP3/WAV) + rpf (OPEN weapon sound RPF)
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

            // 2. Inject OGG into the RPF
            const modifiedRpf = injectAudioIntoRpf(rpfFile.buffer, oggBuffer);

            // 3. Package into ZIP
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
    const hasResident = fs.existsSync(RESIDENT_RPF_PATH);
    res.send(`Sound API v2.0 (injection) | RESIDENT.rpf: ${hasResident ? 'OK' : 'NOT FOUND'} | ffmpeg: OK`);
});

// ──────────────────────────────────────────────────────────────────────────────
// Audio conversion: any audio → OGG Vorbis 44100 Hz
// ──────────────────────────────────────────────────────────────────────────────
function convertToOgg(audioBuffer, originalName) {
    const ext     = path.extname(originalName || '.mp3') || '.mp3';
    const tmpIn   = path.join(os.tmpdir(), `lhc_${Date.now()}_in${ext}`);
    const tmpOut  = path.join(os.tmpdir(), `lhc_${Date.now()}_out.ogg`);

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
// RPF audio injection
// ──────────────────────────────────────────────────────────────────────────────
function injectAudioIntoRpf(rpfBuffer, oggBuffer) {
    // Validate RPF magic
    if (!rpfBuffer.slice(0, 4).equals(RPF_MAGIC)) {
        throw new Error('Archivo RPF inválido (magic incorrecto). ¿Es realmente un RPF?');
    }

    const enc = rpfBuffer.readUInt32LE(12);
    if (enc !== ENC_OPEN && enc !== ENC_NONE) {
        throw new Error(
            `El RPF está encriptado (0x${enc.toString(16)}). ` +
            `Debes subir un RPF OPEN (sin encriptar). ` +
            `Los RPFs del juego original están encriptados — usa CodeWalker para exportar uno OPEN.`
        );
    }

    const entryCount   = rpfBuffer.readUInt32LE(4);
    const namesLength  = rpfBuffer.readUInt32LE(8);
    const nameTableStart = 16 + entryCount * 16;
    const nameTableEnd   = nameTableStart + namesLength;

    // Parse names table
    const namesMap = new Map(); // nameOffset → filename (lower-cased)
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

    // Find the audio entry
    // Priority: .awc > .wav > any file (if single file)
    const AUDIO_EXTS = ['.awc', '.wav', '.ogg', '.mp3'];
    let audioEntry = null;

    for (let i = 0; i < entryCount; i++) {
        const eOff     = 16 + i * 16;
        const nameOff  = rpfBuffer.readUInt16LE(eOff);
        const w4       = rpfBuffer.readUInt32LE(eOff + 4);
        const dataPage = w4 & 0x7FFFFF;

        // Skip directory entries (page = 0x7FFFFF)
        if (dataPage === 0x7FFFFF) continue;

        const name = namesMap.get(nameOff) || '';
        const isAudio = AUDIO_EXTS.some(ext => name.endsWith(ext));

        if (isAudio || (!audioEntry && i > 0)) {
            // i > 0 skips root dir; take first non-dir non-root entry as fallback
            const dataOffset = dataPage * 512;
            const sizeOnDisk = rpfBuffer.readUInt32LE(eOff + 8);
            audioEntry = { idx: i, eOff, name, dataOffset, sizeOnDisk, w4 };
            if (isAudio) break; // prefer an explicitly named audio file
        }
    }

    // Fallback: scan for OGG magic anywhere past the TOC
    const oggMagic  = Buffer.from([0x4F, 0x67, 0x67, 0x53]); // "OggS"
    const dataStart = Math.ceil(nameTableEnd / 512) * 512;

    if (!audioEntry) {
        const oggIdx = rpfBuffer.indexOf(oggMagic, dataStart);
        if (oggIdx < 0) {
            throw new Error(
                'No se encontró audio (AWC/OGG) en el RPF. ' +
                'Asegúrate de subir un RPF OPEN con datos de audio.'
            );
        }
        // Direct OGG at some offset — replace it + everything after until end of file
        return replaceOggInPlace(rpfBuffer, oggIdx, rpfBuffer.length - oggIdx, oggBuffer);
    }

    // Find OGG within the audio entry's data (might be wrapped in AWC)
    const audioSlice = rpfBuffer.slice(audioEntry.dataOffset, audioEntry.dataOffset + audioEntry.sizeOnDisk);
    const oggInSlice = audioSlice.indexOf(oggMagic);

    if (oggInSlice < 0) {
        throw new Error(
            `No se encontraron datos OGG dentro de "${audioEntry.name}". ` +
            `Asegúrate de que el RPF contiene audio OGG/AWC válido.`
        );
    }

    const oggAbsOffset   = audioEntry.dataOffset + oggInSlice;
    const originalOggSize = audioEntry.sizeOnDisk - oggInSlice;

    if (oggBuffer.length <= originalOggSize) {
        // ── Case A: new OGG fits — replace in-place, zero the tail ──
        const result = Buffer.from(rpfBuffer);
        oggBuffer.copy(result, oggAbsOffset);
        // Zero out leftover bytes (preserves file size, OGG is self-terminating)
        result.fill(0, oggAbsOffset + oggBuffer.length, oggAbsOffset + originalOggSize);
        return result;
    }

    // ── Case B: new OGG is larger — rebuild the RPF ──
    console.log(`[Sound] OGG larger than original (${oggBuffer.length} > ${originalOggSize}) — rebuilding RPF`);
    return rebuildRpf(rpfBuffer, audioEntry, oggBuffer, oggInSlice, entryCount, namesLength, nameTableStart, nameTableEnd);
}

function replaceOggInPlace(rpfBuffer, oggAbsOffset, originalOggSize, newOgg) {
    if (newOgg.length <= originalOggSize) {
        const result = Buffer.from(rpfBuffer);
        newOgg.copy(result, oggAbsOffset);
        result.fill(0, oggAbsOffset + newOgg.length, oggAbsOffset + originalOggSize);
        return result;
    }
    // Extend the buffer
    const diff   = newOgg.length - originalOggSize;
    const result = Buffer.alloc(rpfBuffer.length + diff, 0);
    rpfBuffer.copy(result, 0, 0, oggAbsOffset);
    newOgg.copy(result, oggAbsOffset);
    rpfBuffer.copy(result, oggAbsOffset + newOgg.length, oggAbsOffset + originalOggSize);
    return result;
}

function rebuildRpf(rpfBuffer, targetEntry, newOgg, oggOffsetInEntry, entryCount, namesLength, nameTableStart, nameTableEnd) {
    // Build new audio data: keep AWC preamble (before OGG), then new OGG
    const originalAudio = rpfBuffer.slice(targetEntry.dataOffset, targetEntry.dataOffset + targetEntry.sizeOnDisk);
    const preamble      = originalAudio.slice(0, oggOffsetInEntry);
    const newAudioData  = Buffer.concat([preamble, newOgg]);

    // Collect all entries
    const entries = [];
    for (let i = 0; i < entryCount; i++) {
        const eOff       = 16 + i * 16;
        const nameOff    = rpfBuffer.readUInt16LE(eOff);
        const w2         = rpfBuffer.readUInt16LE(eOff + 2);
        const w4         = rpfBuffer.readUInt32LE(eOff + 4);
        const sizeOnDisk = rpfBuffer.readUInt32LE(eOff + 8);
        const w12        = rpfBuffer.readUInt32LE(eOff + 12);
        const dataPage   = w4 & 0x7FFFFF;
        const isDir      = dataPage === 0x7FFFFF;

        let data = null;
        if (!isDir) {
            if (i === targetEntry.idx) {
                data = newAudioData;
            } else {
                const dOff = dataPage * 512;
                if (dOff + sizeOnDisk <= rpfBuffer.length) {
                    data = Buffer.from(rpfBuffer.slice(dOff, dOff + sizeOnDisk));
                }
            }
        }

        entries.push({ nameOff, w2, w4, sizeOnDisk: data ? data.length : sizeOnDisk, w12, isDir, data });
    }

    // Calculate new data section layout
    const tocEnd       = nameTableEnd;
    const newDataStart = Math.ceil(tocEnd / 512) * 512;
    let   currentPage  = newDataStart / 512;

    const fileOffsets = entries.map(e => {
        if (e.isDir || !e.data) return { page: 0x7FFFFF };
        const page = currentPage;
        currentPage += Math.ceil(e.data.length / 512);
        return { page };
    });

    const totalBytes = currentPage * 512;
    const output = Buffer.alloc(totalBytes, 0);

    // Header
    RPF_MAGIC.copy(output, 0);
    output.writeUInt32LE(entryCount,  4);
    output.writeUInt32LE(namesLength, 8);
    output.writeUInt32LE(ENC_OPEN,    12);

    // Entries
    for (let i = 0; i < entries.length; i++) {
        const e  = entries[i];
        const fo = fileOffsets[i];
        const ep = 16 + i * 16;

        output.writeUInt16LE(e.nameOff, ep);
        output.writeUInt16LE(e.w2,      ep + 2);

        if (e.isDir) {
            output.writeUInt32LE(e.w4, ep + 4);
        } else {
            const flags = (e.w4 >> 23) & 0x1FF;
            const newW4 = (fo.page & 0x7FFFFF) | (flags << 23);
            output.writeUInt32LE(newW4,        ep + 4);
        }

        output.writeUInt32LE(e.sizeOnDisk, ep + 8);
        output.writeUInt32LE(e.w12,        ep + 12);
    }

    // Names table (copy verbatim)
    rpfBuffer.copy(output, nameTableStart, nameTableStart, nameTableEnd);

    // File data
    for (let i = 0; i < entries.length; i++) {
        const e  = entries[i];
        const fo = fileOffsets[i];
        if (!e.isDir && e.data && fo.page !== 0x7FFFFF) {
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

        const rpfMagic = Buffer.from([0x37, 0x46, 0x50, 0x52]);
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
                    for (let p = dstBuf.length; p < srcBuf.length; p++) output[offset + p] = 0x00;
                    binaryReplacements++;
                }
                offset += srcBuf.length;
            }
        }

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${targetId}.rpf"`);
        res.setHeader('X-Replacement-Count', String(totalReplacements + binaryReplacements));
        res.setHeader('X-Engine-Version', 'v17.0-rpf-rebuild');
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
    console.log(`[v19] Sound Injection + Converter API on port ${port}`);
});
