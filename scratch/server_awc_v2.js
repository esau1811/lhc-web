'use strict';
// server_awc_v2 — Surgical Injector + Jenkins Hash
// Deps: express, multer, cors, adm-zip, native ffmpeg

const express  = require('express');
const multer   = require('multer');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const { exec } = require('child_process');
const AdmZip   = require('adm-zip');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } }); // Subido a 500MB para Resident

const BASE_DIR      = '/var/www/lhc-node';
const CHUNKS_DIR    = path.join(BASE_DIR, 'chunks');
const TEMPLATES_DIR = path.join(BASE_DIR, 'templates');

[CHUNKS_DIR, TEMPLATES_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const WEAPON_FILES = {
    pistol:       'ptl_pistol.awc',
    combatpistol: 'ptl_combat.awc',
    smg:          'smg_smg.awc',
    microsmg:     'smg_micro.awc',
    killsound:    'resident.awc',
};

// Jenkins Hash — El radar de GTA V
function jenkinsHash(str) {
    str = str.toLowerCase();
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash += str.charCodeAt(i);
        hash += (hash << 10);
        hash ^= (hash >>> 6);
    }
    hash += (hash << 3);
    hash ^= (hash >>> 11);
    hash += (hash << 15);
    return (hash >>> 0);
}

// ── MODO QUIRÚRGICO (Resident) ────────────────────────────────────────────────
function patchSurgical(awcData, pcmData, targetName) {
    let tadaOff = awcData.indexOf(Buffer.from('ADAT'));
    if (tadaOff === -1) tadaOff = awcData.indexOf(Buffer.from('TADA'));
    if (tadaOff === -1) throw new Error('No se detectó cabecera AWC en el archivo Resident.');

    const targetId = jenkinsHash(targetName);
    console.log(`[surgical] Buscando: ${targetName} -> ID: 0x${targetId.toString(16).toUpperCase()}`);

    const b = Buffer.from(awcData.slice(tadaOff));
    const entryCount = b.readUInt16LE(0x06);
    let found = false;

    // Metadatos básicos para 32000Hz (PCM Mono)
    const newMeta = Buffer.from([
        0x00, 0x00, 0x00, 0x00, // Flags
        0x00, 0x7D, 0x00, 0x00, // 32000 Hz
        0x01, 0x00, 0x00, 0x00, // 1 Canal (Mono)
        0x00, 0x00, 0x00, 0x00  // Padding
    ]);

    const audioPos = b.length;
    const metaPos  = audioPos + pcmData.length;
    const finalBuf = Buffer.alloc(metaPos + newMeta.length, 0);
    b.copy(finalBuf, 0);

    pcmData.copy(finalBuf, audioPos);
    newMeta.copy(finalBuf, metaPos);

    for (let i = 0x10; i < 0x10 + (entryCount * 16); i += 16) {
        const id = finalBuf.readUInt32LE(i + 8);
        const type = finalBuf[i + 12];
        if (id === targetId) {
            if (type === 0x55) {
                finalBuf.writeUInt32LE(audioPos, i);
                finalBuf.writeUInt32LE((pcmData.length & 0xFFFFFF) | 0x01000000, i + 4);
                found = true;
            } else if (type === 0x01) {
                finalBuf.writeUInt32LE(metaPos, i);
                finalBuf.writeUInt32LE((newMeta.length & 0xFFFFFF) | 0x01000000, i + 4);
            }
        }
    }
    if (!found) throw new Error(`El nombre "${targetName}" no existe en este archivo AWC.`);
    const out = Buffer.alloc(tadaOff + finalBuf.length);
    awcData.copy(out, 0, 0, tadaOff);
    finalBuf.copy(out, tadaOff);
    return out;
}

// ── MODO ESPEJO ───────────────────────────────────────────────────────────────
function patchAWC(awcData, pcmData) {
    let tadaOff = awcData.indexOf(Buffer.from('ADAT'));
    if (tadaOff === -1) tadaOff = awcData.indexOf(Buffer.from('TADA'));
    if (tadaOff === -1) throw new Error('No se detectó cabecera TADA/ADAT.');
    const b = Buffer.from(awcData.slice(tadaOff));
    let mainAudioOff = -1;
    let mainFlags = 0;
    for (let i = 0x10; i < Math.min(b.length, 0x4000); i++) {
        const dOff = b.readUInt32LE(i);
        const szFlags = b.readUInt32LE(i + 4);
        if (dOff >= 64 && dOff < 4096 && (szFlags & 0xFFFFFF) > 1000 && b[i + 12] === 0x55) {
            mainAudioOff = dOff;
            mainFlags = szFlags & 0xFF000000;
            break;
        }
    }
    if (mainAudioOff === -1) throw new Error('No se pudo localizar el audio.');
    for (let i = 0x10; i < mainAudioOff - 16; i += 16) {
        const type = b[i + 12];
        if (type === 0x55 || type === 0x01 || type === 0x1D) {
            b.writeUInt32LE(mainAudioOff, i);
            b.writeUInt32LE(((pcmData.length & 0xFFFFFF) | mainFlags) >>> 0, i + 4);
        }
    }
    const header = b.slice(0, mainAudioOff);
    const finalBuf = Buffer.alloc(Math.max(b.length, mainAudioOff + pcmData.length), 0);
    header.copy(finalBuf, 0);
    pcmData.copy(finalBuf, mainAudioOff);
    const out = Buffer.alloc(tadaOff + finalBuf.length);
    awcData.copy(out, 0, 0, tadaOff);
    finalBuf.copy(out, tadaOff);
    return out;
}

function prepareAudio(audioBuf, sampleRate = '32000') {
    return new Promise((resolve, reject) => {
        const id   = `${Date.now()}`;
        const inF  = path.join(os.tmpdir(), `ain_${id}`);
        const outF = path.join(os.tmpdir(), `aout_${id}.raw`);
        fs.writeFileSync(inF, audioBuf);
        exec(`ffmpeg -y -i "${inF}" -f s16le -acodec pcm_s16le -ar ${sampleRate} -ac 1 "${outF}"`, (err) => {
            try { fs.unlinkSync(inF); } catch {}
            if (err) return reject(err);
            const raw = fs.readFileSync(outF);
            try { fs.unlinkSync(outF); } catch {}
            resolve(raw);
        });
    });
}

app.post('/api/Sound/upload-chunk', upload.single('chunk'), (req, res) => {
    const { uploadId, index } = req.body;
    fs.writeFileSync(path.join(CHUNKS_DIR, `${uploadId}_${index}`), req.file.buffer);
    res.json({ status: 'ok' });
});

app.post('/api/Sound/assemble-and-inject', upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'awc', maxCount: 1 }]), async (req, res) => {
    try {
        const { uploadId, total, useTemplate, weaponType, sampleRate, surgicalName } = req.body;
        const audioFile = req.files['audio'][0];
        const awcFile = req.files['awc'] ? req.files['awc'][0] : null;
        let awcBuf;
        if (useTemplate === 'true') {
            awcBuf = fs.readFileSync(path.join(TEMPLATES_DIR, `${weaponType}.awc`));
        } else if (awcFile) {
            awcBuf = awcFile.buffer;
        } else {
            const parts = [];
            for (let i = 0; i < parseInt(total); i++) {
                const cp = path.join(CHUNKS_DIR, `${uploadId}_${i}`);
                parts.push(fs.readFileSync(cp));
                fs.unlinkSync(cp);
            }
            awcBuf = Buffer.concat(parts);
        }
        const sRate = sampleRate || '32000';
        const adpcm = await prepareAudio(audioFile.buffer, sRate);
        let patched;
        if (surgicalName && surgicalName.trim() !== "") {
            patched = patchSurgical(awcBuf, adpcm, surgicalName.trim());
        } else {
            patched = patchAWC(awcBuf, adpcm);
        }
        const zip = new AdmZip();
        const outName = awcFile ? awcFile.originalname : (WEAPON_FILES[weaponType] || 'patched.awc');
        zip.addFile(outName, patched);
        res.send(zip.toBuffer());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/Sound/fix-rpf', upload.single('rpf'), async (req, res) => {
    const rpfPath = path.join(os.tmpdir(), req.file.originalname);
    fs.writeFileSync(rpfPath, req.file.buffer);
    exec(`wine ArchiveFix.exe "${rpfPath}"`, (err) => {
        if (err) return res.status(500).send('Error');
        const fixed = fs.readFileSync(rpfPath);
        fs.unlinkSync(rpfPath);
        res.send(fixed);
    });
});

app.listen(5000, '0.0.0.0', () => console.log('Listo'));
