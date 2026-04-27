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
const upload  = multer({ storage, limits: { fileSize: 150 * 1024 * 1024 } }); // allow 150MB for RPFs

// ── GTA V RPF Definitions ─────────────────────────────────────────────────────
const RPF_MAGIC = Buffer.from([0x37, 0x46, 0x50, 0x52]); // "54PR" -> RPF7
const ENC_OPEN  = 0x4e45504f; // "OPEN"
const ENC_NONE  = 0;
const ENC_AES   = 0x0FFFFFF9;
const ENC_NG    = 0x0FEFFFFF;

// ──────────────────────────────────────────────────────────────────────────────
// AWC PCM GENERATOR
// ──────────────────────────────────────────────────────────────────────────────
function wavToAwc(wavBuffer, streamId) {
    if (wavBuffer.toString('utf8', 0, 4) !== 'RIFF' || wavBuffer.toString('utf8', 8, 12) !== 'WAVE') {
        throw new Error('El archivo generado no es un WAV válido.');
    }
    
    let fmtOffset = 12;
    while (wavBuffer.toString('utf8', fmtOffset, fmtOffset + 4) !== 'fmt ') {
        fmtOffset += 8 + wavBuffer.readUInt32LE(fmtOffset + 4);
    }
    const channels = wavBuffer.readUInt16LE(fmtOffset + 10);
    const sampleRate = wavBuffer.readUInt32LE(fmtOffset + 12);
    
    let dataOffset = 12;
    while (wavBuffer.toString('utf8', dataOffset, dataOffset + 4) !== 'data') {
        dataOffset += 8 + wavBuffer.readUInt32LE(dataOffset + 4);
    }
    const dataSize = wavBuffer.readUInt32LE(dataOffset + 4);
    const audioData = wavBuffer.slice(dataOffset + 8, dataOffset + 8 + dataSize);
    const numSamples = dataSize / (channels * 2);

    const awc = Buffer.alloc(1024 + audioData.length);
    let o = 0;
    
    awc.write('ADAT', o); o += 4;
    awc.writeUInt32LE(0xFF000001, o); o += 4;
    awc.writeUInt32LE(1, o); o += 4;
    o += 4; // header size
    
    const infoHeader = (2 << 29) | (streamId & 0x1FFFFFFF);
    awc.writeUInt32LE(infoHeader, o); o += 4;
    
    const tagsOffset = o;
    o += 8 * 2;
    
    const sfxHeaderOffset = o;
    awc.writeUInt32LE(numSamples, o); o += 4;
    awc.writeInt32LE(-1, o); o += 4;
    awc.writeUInt16LE(sampleRate, o); o += 2;
    awc.writeUInt16LE(0, o); o += 2; 
    awc.writeUInt32LE(0, o); o += 4;
    awc.writeUInt32LE(0, o); o += 4;
    awc.writeUInt8(0x00, o); o += 1; // PCM 16-bit LE
    awc.writeUInt8(0, o); o += 1;
    awc.writeUInt16LE(0, o); o += 2;
    awc.writeUInt32LE(0, o); o += 4;
    
    const dataAlign = Math.ceil(o / 2048) * 2048;
    o = dataAlign;
    
    const audioDataOffset = o;
    audioData.copy(awc, o);
    o += audioData.length;
    
    function writeTag(type, size, offset, buf, writeOff) {
        const lo = offset & 0x0FFFFFFF;
        const mid = size & 0x0FFFFFFF;
        const hi = type & 0xFF;
        const b = Buffer.alloc(8);
        b.writeUInt32LE((lo | ((mid & 0xF) << 28)) >>> 0, 0);
        b.writeUInt32LE(((mid >>> 4) | (hi << 24)) >>> 0, 4);
        b.copy(buf, writeOff);
    }
    
    writeTag(0xFA, 0x18, sfxHeaderOffset, awc, tagsOffset); 
    writeTag(0x55, audioData.length, audioDataOffset, awc, tagsOffset + 8);
    
    awc.writeUInt32LE(sfxHeaderOffset + 0x18, 12); 
    
    return awc.slice(0, o);
}

// ──────────────────────────────────────────────────────────────────────────────
// SOUND INJECT  POST /api/Sound/inject
// User uploads MP3 + RPF. We replace the .awc inside the RPF.
// ──────────────────────────────────────────────────────────────────────────────
app.post('/api/Sound/inject', upload.fields([{ name: 'audio' }, { name: 'rpf' }]), async (req, res) => {
    const audioFile = req.files?.['audio']?.[0];
    const rpfFile   = req.files?.['rpf']?.[0];

    if (!audioFile) return res.status(400).send('Falta el archivo de audio.');
    if (!rpfFile)   return res.status(400).send('Falta el archivo RPF.');

    try {
        console.log(`[v22] Procesando RPF: ${rpfFile.originalname} y Audio: ${audioFile.originalname}`);

        // 1. Convert MP3 to WAV (PCM 16-bit LE, 44100Hz, Mono)
        const wavBuf = await convertToWav(audioFile.buffer, audioFile.originalname);
        
        let rpfBuffer = rpfFile.buffer;
        if (!rpfBuffer.slice(0, 4).equals(RPF_MAGIC)) {
            return res.status(400).send('Archivo RPF inválido.');
        }

        const encType = rpfBuffer.readUInt32LE(12);
        if (encType !== ENC_OPEN && encType !== ENC_NONE) {
            return res.status(400).send('El RPF está encriptado. Debes subir un RPF OPEN (creado con CodeWalker).');
        }

        const modifiedRpf = replaceAwcInRpf(rpfBuffer, wavBuf);

        const zip = new AdmZip();
        zip.addFile(`LHC Sound boost/${rpfFile.originalname}`, modifiedRpf);

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="LHC Sound boost.zip"');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        res.send(zip.toBuffer());

    } catch (e) {
        console.error('[Sound] Error:', e.message);
        res.status(500).send(e.message);
    }
});

function convertToWav(audioBuffer, originalName) {
    const ext = path.extname(originalName || '.mp3') || '.mp3';
    const tmpIn = path.join(os.tmpdir(), `lhc_${Date.now()}_in${ext}`);
    const tmpOut = path.join(os.tmpdir(), `lhc_${Date.now()}_out.wav`);

    return new Promise((resolve, reject) => {
        fs.writeFileSync(tmpIn, audioBuffer);
        // Force Mono, 44100Hz, PCM 16-bit LE
        exec(`ffmpeg -y -i "${tmpIn}" -ac 1 -ar 44100 -c:a pcm_s16le "${tmpOut}" 2>&1`, (err, stdout) => {
            const clean = () => { [tmpIn, tmpOut].forEach(f => { try { fs.unlinkSync(f); } catch {} }); };
            if (err) { clean(); return reject(new Error('Error ffmpeg: ' + stdout.slice(-200))); }
            try { const b = fs.readFileSync(tmpOut); clean(); resolve(b); }
            catch (e) { clean(); reject(new Error('No se pudo leer el WAV')); }
        });
    });
}

function replaceAwcInRpf(rpfBuffer, wavBuf) {
    const entryCount = rpfBuffer.readUInt32LE(4);
    const namesLength = rpfBuffer.readUInt32LE(8);
    const nameTableStart = 16 + entryCount * 16;
    const nameTableEnd = nameTableStart + namesLength;

    const entries = [];
    let targetEntry = null;

    const fileNames = [];
    for (let i = 0; i < entryCount; i++) {
        const eOff = 16 + i * 16;
        const nameOff = rpfBuffer.readUInt16LE(eOff);
        const w2 = rpfBuffer.readUInt16LE(eOff + 2);
        const w4 = rpfBuffer.readUInt32LE(eOff + 4);
        const sizeOnDisk = rpfBuffer.readUInt32LE(eOff + 8);
        const w12 = rpfBuffer.readUInt32LE(eOff + 12);
        const isDir = (w4 === 0x7FFFFF00);

        let name = '';
        if (nameOff < namesLength) {
            let p = nameTableStart + nameOff;
            while (p < nameTableEnd && rpfBuffer[p] !== 0) name += String.fromCharCode(rpfBuffer[p++]);
        }
        fileNames.push(name);

        let data = null;
        let dataOffset = 0;
        if (!isDir) {
            const dataPage = rpfBuffer[eOff+5] | (rpfBuffer[eOff+6]<<8) | (rpfBuffer[eOff+7]<<16);
            dataOffset = dataPage * 512;
            if (dataOffset > 0 && dataOffset + sizeOnDisk <= rpfBuffer.length) {
                data = Buffer.from(rpfBuffer.slice(dataOffset, dataOffset + sizeOnDisk));
            }
        }

        entries.push({ idx: i, nameOff, w2, w4, sizeOnDisk, w12, isDir, name, data, dataOffset });

        if (!targetEntry && !isDir && name.toLowerCase().endsWith('.awc')) {
            targetEntry = entries[entries.length - 1];
        }
    }

    if (!targetEntry) {
        console.log('[Debug] No AWC found. Files in RPF:', fileNames.join(', '));
        throw new Error(`No se encontró ningún archivo .awc en el RPF subido. Archivos encontrados: ${fileNames.slice(0, 10).join(', ')}...`);
    }

    // Read stream ID from the original AWC
    let streamId = 0;
    if (targetEntry.data && targetEntry.data.slice(0, 4).equals(Buffer.from('ADAT'))) {
        streamId = targetEntry.data.readUInt32LE(0x10) & 0x1FFFFFFF;
    } else {
        throw new Error('El archivo .awc original no es válido o está corrupto.');
    }

    console.log(`[v22] Reemplazando AWC "${targetEntry.name}" (stream ID: ${streamId})`);

    // Generate PCM AWC
    const newAwc = wavToAwc(wavBuf, streamId);
    
    // Replace data
    targetEntry.data = newAwc;
    targetEntry.sizeOnDisk = newAwc.length;

    // Reconstruct RPF
    const newDataStart = Math.ceil(nameTableEnd / 512) * 512;
    let currentPage = newDataStart / 512;

    const fileOffsets = entries.map(e => {
        if (e.isDir || !e.data) return null;
        const page = currentPage;
        currentPage += Math.ceil(e.data.length / 512);
        return page;
    });

    const totalBytes = currentPage * 512;
    const output = Buffer.alloc(totalBytes, 0);

    RPF_MAGIC.copy(output, 0);
    output.writeUInt32LE(entryCount, 4);
    output.writeUInt32LE(namesLength, 8);
    output.writeUInt32LE(ENC_OPEN, 12);

    for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const page = fileOffsets[i];
        const ep = 16 + i * 16;

        rpfBuffer.copy(output, ep, ep, ep + 16);

        if (!e.isDir && page !== null) {
            output[ep + 5] = page & 0xFF;
            output[ep + 6] = (page >> 8) & 0xFF;
            output[ep + 7] = (page >> 16) & 0xFF;
            output.writeUInt32LE(e.sizeOnDisk, ep + 8);
            
            if (e === targetEntry) {
                const cs = e.data.length;
                output[ep + 2] = cs & 0xFF;
                output[ep + 3] = (cs >> 8) & 0xFF;
                output[ep + 4] = (cs >> 16) & 0xFF;
            }
        }
    }

    rpfBuffer.copy(output, nameTableStart, nameTableStart, nameTableEnd);

    for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const page = fileOffsets[i];
        if (!e.isDir && e.data && page !== null) {
            e.data.copy(output, page * 512);
        }
    }

    return output;
}

app.listen(port, '0.0.0.0', () => {
    console.log(`[v22] AWC PCM Generator API on port ${port}`);
});
