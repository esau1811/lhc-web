'use strict';
// server_awc_v2 — Chunk upload + AWC inject fix
// Deps: express, multer, cors, adm-zip (already installed from v76), native ffmpeg

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

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 300 * 1024 * 1024 } });

const BASE_DIR      = '/var/www/lhc-node';
const CHUNKS_DIR    = path.join(BASE_DIR, 'chunks');
const TEMPLATES_DIR = path.join(BASE_DIR, 'templates');

[CHUNKS_DIR, TEMPLATES_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// weaponType → awc filename mapping (must match names in OpenIV / FiveM resource)
const WEAPON_FILES = {
    pistol:       'ptl_pistol.awc',
    combatpistol: 'ptl_combat.awc',
    smg:          'smg_smg.awc',
    microsmg:     'smg_micro.awc',
    killsound:    'resident.awc',
};

// ── AWC patcher ────────────────────────────────────────────────────────────────
// GTA5 AWC (decrypted, exported via OpenIV) format:
//   0x00: "TADA" magic (54 41 44 41)
//   0x04: uint16 flags
//   0x06: uint16 entry_count       ← stream/chunk entries
//   0x08: uint32 (padding / version)
//   0x0C: uint32 (varies)
//   0x10: entry_table[entry_count], each 16 bytes:
//           +0  uint32 data_offset (from TADA start)
//           +4  uint32 size | flags  (low 24 bits = size)
//           +8  uint32 id/hash
//           +12 uint8  chunk_type  (0x55 = raw audio DATA)
//           +13 3 bytes padding
function patchAWC(awcData, adpcmData) {
    const tadaOff = awcData.indexOf(Buffer.from('TADA'));
    if (tadaOff === -1) throw new Error('No se encontró magia TADA — el archivo no es un AWC válido (¿está encriptado? expórtalo con OpenIV)');

    const b = awcData.slice(tadaOff);
    console.log('[awc] header hex:', b.slice(0, 32).toString('hex'));

    // Try uint16 at 0x06 first, then uint32 at 0x0C as fallback
    let entryCount = b.readUInt16LE(0x06);
    if (entryCount === 0 || entryCount > 512) entryCount = b.readUInt32LE(0x0C);
    if (entryCount === 0 || entryCount > 512) throw new Error(`Estructura AWC inválida (entryCount=${entryCount})`);
    console.log('[awc] entryCount:', entryCount);

    const TABLE = 0x10;
    let audioOff = -1, audioIdx = -1;

    for (let i = 0; i < entryCount; i++) {
        const base = TABLE + i * 16;
        if (base + 16 > b.length) break;
        const type = b[base + 12];
        const off  = b.readUInt32LE(base);
        console.log(`[awc] entry ${i}: type=0x${type.toString(16)} offset=0x${off.toString(16)}`);
        if (type === 0x55) { audioOff = off; audioIdx = i; }
    }

    if (audioOff === -1) throw new Error('No se encontró chunk de audio (tipo 0x55) en el AWC');
    if (audioOff === 0 || audioOff >= b.length) throw new Error(`Offset de audio inválido: 0x${audioOff.toString(16)}`);

    // Build patched header (mutable copy up to audio data)
    const header = Buffer.from(b.slice(0, audioOff));

    // Update size field: preserve high-byte flags, write new size in low 24 bits
    const sizeOff  = TABLE + audioIdx * 16 + 4;
    const flagBits = header.readUInt32LE(sizeOff) & 0xFF000000;
    header.writeUInt32LE((adpcmData.length & 0x00FFFFFF) | flagBits, sizeOff);

    return Buffer.concat([awcData.slice(0, tadaOff), header, adpcmData]);
}

// ── ADPCM converter via native ffmpeg ─────────────────────────────────────────
function toADPCM(audioBuf) {
    return new Promise((resolve, reject) => {
        const id   = `${Date.now()}_${(Math.random() * 9999) | 0}`;
        const inF  = path.join(os.tmpdir(), `ain_${id}`);
        const outF = path.join(os.tmpdir(), `aout_${id}.wav`);
        fs.writeFileSync(inF, audioBuf);
        exec(`ffmpeg -y -i "${inF}" -acodec adpcm_ima_wav -ar 32000 -ac 1 "${outF}"`, (err) => {
            try { fs.unlinkSync(inF); } catch {}
            if (err) return reject(new Error(`ffmpeg: ${err.message}`));
            try {
                const wav = fs.readFileSync(outF);
                try { fs.unlinkSync(outF); } catch {}
                const di = wav.indexOf(Buffer.from('data'));
                if (di >= 0) resolve(wav.slice(di + 8, di + 8 + wav.readUInt32LE(di + 4)));
                else resolve(wav.slice(44));
            } catch (e) { reject(e); }
        });
    });
}

// ── ENDPOINTS ─────────────────────────────────────────────────────────────────

// 1. Recibir chunks del archivo AWC grande
app.post('/api/Sound/upload-chunk', upload.single('chunk'), (req, res) => {
    const { uploadId, index, total } = req.body;
    if (!uploadId || index == null) return res.status(400).json({ error: 'Faltan uploadId/index' });
    fs.writeFileSync(path.join(CHUNKS_DIR, `${uploadId}_${index}`), req.file.buffer);
    console.log(`[chunk] ${uploadId} ${index}/${total}`);
    res.json({ status: 'ok' });
});

// 2. Ensamblar chunks e inyectar el audio
app.post('/api/Sound/assemble-and-inject', upload.single('audio'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo de audio' });

    const { uploadId, total, useTemplate, weaponType } = req.body;
    let awcBuf;

    try {
        if (useTemplate === 'true') {
            const tPath = path.join(TEMPLATES_DIR, `${weaponType}.awc`);
            if (!fs.existsSync(tPath)) {
                return res.status(404).json({
                    error: `Plantilla "${weaponType}.awc" no configurada en el servidor. Usa el modo "Subir mi propio .AWC".`
                });
            }
            awcBuf = fs.readFileSync(tPath);
        } else {
            const n = parseInt(total, 10);
            if (!n || n <= 0) return res.status(400).json({ error: 'Total de chunks inválido' });
            const parts = [];
            for (let i = 0; i < n; i++) {
                const cp = path.join(CHUNKS_DIR, `${uploadId}_${i}`);
                if (!fs.existsSync(cp)) return res.status(400).json({ error: `Chunk ${i} no encontrado` });
                parts.push(fs.readFileSync(cp));
            }
            awcBuf = Buffer.concat(parts);
            for (let i = 0; i < n; i++) try { fs.unlinkSync(path.join(CHUNKS_DIR, `${uploadId}_${i}`)); } catch {}
        }

        console.log(`[inject] awcSize=${awcBuf.length} useTemplate=${useTemplate} weapon=${weaponType}`);

        const adpcm   = await toADPCM(req.file.buffer);
        console.log(`[inject] adpcm=${adpcm.length} bytes`);

        const patched = patchAWC(awcBuf, adpcm);
        console.log(`[inject] patchedAwc=${patched.length} bytes`);

        const outName = WEAPON_FILES[weaponType] || `${weaponType || 'patched'}.awc`;
        const zip = new AdmZip();
        zip.addFile(outName, patched);

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="LHC_Sound_${weaponType || 'sound'}.zip"`);
        res.send(zip.toBuffer());

    } catch (err) {
        console.error('[inject] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 3. Subir plantilla AWC (uso admin / one-time setup)
app.post('/api/Sound/upload-template', upload.single('awc'), (req, res) => {
    const { weaponType } = req.body;
    if (!weaponType || !req.file) return res.status(400).json({ error: 'Faltan weaponType o archivo' });
    const dest = path.join(TEMPLATES_DIR, `${weaponType}.awc`);
    fs.writeFileSync(dest, req.file.buffer);
    console.log(`[template] ${weaponType} guardado (${req.file.buffer.length} bytes)`);
    res.json({ status: 'ok', file: dest });
});

app.get('/health', (req, res) => res.json({ version: 'server_awc_v2', status: 'ok' }));

app.listen(5000, '0.0.0.0', () => console.log('[server_awc_v2] Listo en puerto 5000'));
