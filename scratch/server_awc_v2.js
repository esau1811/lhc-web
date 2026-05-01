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
//   0x00: "ADAT" magic (41 44 41 54)  <-- GTA V uses ADAT, NOT TADA
//   0x04: uint16 flags
//   0x06: uint16 entry_count       ← stream/chunk entries
//   0x08: uint32 (padding / version)
//   0x0C: uint32 (varies)
//   0x10: entry_table[entry_count], each 16 bytes:
//           +0  uint32 data_offset (from ADAT start)
//           +4  uint32 size | flags  (low 24 bits = size)
//           +8  uint32 id/hash
//           +12 uint8  chunk_type  (0x55 = raw audio DATA)
//           +13 3 bytes padding
function patchAWC(awcData, adpcmData) {
    let tadaOff = awcData.indexOf(Buffer.from('ADAT'));
    if (tadaOff === -1) tadaOff = awcData.indexOf(Buffer.from('TADA'));
    if (tadaOff === -1) throw new Error('No se detectó cabecera TADA/ADAT. El archivo debe estar desencriptado (Export -> Import en OpenIV).');

    const b = awcData.slice(tadaOff);
    let audioOff = -1;
    let sizeFieldOff = -1;

    // 1. Scan Table for 0x55 (Audio)
    let entryCount = b.readUInt16LE(0x06);
    if (entryCount === 0 || entryCount > 512) entryCount = b.readUInt32LE(0x0C);
    
    if (entryCount > 0 && entryCount < 512) {
        const TABLE = 0x10;
        for (let i = 0; i < entryCount; i++) {
            const base = TABLE + i * 16;
            if (base + 13 > b.length) break;
            if (b[base + 12] === 0x55) {
                audioOff = b.readUInt32LE(base);
                sizeFieldOff = base + 4;
                break;
            }
        }
    }

    // 2. Fallback: Pattern Match for 0x55
    if (audioOff <= 0 || audioOff >= b.length) {
        for (let i = 0x10; i < Math.min(b.length, 0x1000); i++) {
            if (b[i] === 0x55) {
                const base = i - 12;
                if (base >= 0) {
                    const testOff = b.readUInt32LE(base);
                    if (testOff > 0 && testOff < b.length) {
                        audioOff = testOff;
                        sizeFieldOff = base + 4;
                        break;
                    }
                }
            }
        }
    }

    if (audioOff <= 0 || audioOff >= b.length) throw new Error('No se encontró el bloque de audio en el archivo. Asegúrate de que sea un AWC de arma válido.');

    // SURGICAL REPLACEMENT: Keep original header exactly as is, just update size
    const header = Buffer.from(b.slice(0, audioOff));
    const oldVal = header.readUInt32LE(sizeFieldOff);
    const newVal = ((adpcmData.length & 0x00FFFFFF) | (oldVal & 0xFF000000)) >>> 0;
    header.writeUInt32LE(newVal, sizeFieldOff);

    console.log(`[inject] Surgical patch: offset=0x${audioOff.toString(16)} oldSize=${oldVal & 0xFFFFFF} newSize=${adpcmData.length}`);

    return Buffer.concat([awcData.slice(0, tadaOff), header, adpcmData]);
}

// ── ADPCM converter via native ffmpeg ─────────────────────────────────────────
function prepareAudio(audioBuf, sampleRate = '32000', format = 'pcm') {
    return new Promise((resolve, reject) => {
        const id   = `${Date.now()}_${(Math.random() * 9999) | 0}`;
        const inF  = path.join(os.tmpdir(), `ain_${id}`);
        const outF = path.join(os.tmpdir(), `aout_${id}.raw`);
        fs.writeFileSync(inF, audioBuf);
        
        let cmd;
        if (format === 'adpcm') {
            const wavF = outF + '.wav';
            cmd = `ffmpeg -y -i "${inF}" -acodec adpcm_ima_wav -ar ${sampleRate} -ac 1 "${wavF}"`;
            exec(cmd, (err) => {
                try { fs.unlinkSync(inF); } catch {}
                if (err) return reject(new Error(`ffmpeg error: ${err.message}`));
                try {
                    const wav = fs.readFileSync(wavF);
                    try { fs.unlinkSync(wavF); } catch {}
                    const dataPos = wav.indexOf(Buffer.from('data'));
                    if (dataPos >= 0) {
                        const dataSize = wav.readUInt32LE(dataPos + 4);
                        resolve(wav.slice(dataPos + 8, dataPos + 8 + dataSize));
                    } else {
                        resolve(wav.slice(44));
                    }
                } catch (e) { reject(e); }
            });
        } else {
            // Raw PCM 16-bit Little Endian
            cmd = `ffmpeg -y -i "${inF}" -f s16le -acodec pcm_s16le -ar ${sampleRate} -ac 1 "${outF}"`;
            exec(cmd, (err) => {
                try { fs.unlinkSync(inF); } catch {}
                if (err) return reject(new Error(`ffmpeg error: ${err.message}`));
                try {
                    const raw = fs.readFileSync(outF);
                    try { fs.unlinkSync(outF); } catch {}
                    resolve(raw);
                } catch (e) { reject(e); }
            });
        }
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

// 2. Ensamblar y procesar (Acepta 'audio' y 'awc' opcional)
app.post('/api/Sound/assemble-and-inject', upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'awc', maxCount: 1 }
]), async (req, res) => {
    try {
        const { uploadId, total, useTemplate, weaponType, sampleRate, format } = req.body;
        const audioFile = req.files['audio'] ? req.files['audio'][0] : null;
        const awcFile = req.files['awc'] ? req.files['awc'][0] : null;

        if (!audioFile) return res.status(400).json({ error: 'Falta el archivo de audio' });

        let awcBuf;
        if (useTemplate === 'true') {
            const tPath = path.join(TEMPLATES_DIR, `${weaponType}.awc`);
            if (fs.existsSync(tPath)) {
                awcBuf = fs.readFileSync(tPath);
            } else {
                if (!awcFile) return res.status(400).json({ error: `Plantilla ${weaponType} no encontrada. Sube tu propio .awc primero.` });
                awcBuf = awcFile.buffer;
                fs.writeFileSync(tPath, awcBuf);
            }
        } else {
            if (awcFile) {
                awcBuf = awcFile.buffer;
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
        }

        console.log(`[inject] Request: weapon=${weaponType} rate=${sampleRate} format=${format || 'pcm'}`);

        const adpcm   = await prepareAudio(audioFile.buffer, sampleRate || '32000', format || 'pcm');
        console.log(`[inject] audio=${adpcm.length} bytes @ ${sampleRate || '32000'}Hz (${format || 'pcm'})`);

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

// 3. Firmar archivo .RPF con ArchiveFix
app.post('/api/Sound/fix-rpf', upload.single('rpf'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se ha subido ningún archivo .RPF' });

    const id = `${Date.now()}_${(Math.random() * 9999) | 0}`;
    const rpfPath = path.join(os.tmpdir(), `fix_${id}_${req.file.originalname}`);
    
    try {
        fs.writeFileSync(rpfPath, req.file.buffer);
        console.log(`[fix-rpf] Procesando: ${req.file.originalname} (${req.file.size} bytes)`);

        // Ejecutar ArchiveFix.exe usando Wine
        // El comando suele ser: wine ArchiveFix.exe <archivo.rpf>
        // ArchiveFix modifica el archivo original in-place
        const cmd = `wine ArchiveFix.exe "${rpfPath}"`;
        
        exec(cmd, { cwd: __dirname }, (err, stdout, stderr) => {
            if (err) {
                console.error('[fix-rpf] Error de Wine/ArchiveFix:', stderr);
                try { fs.unlinkSync(rpfPath); } catch {}
                return res.status(500).json({ error: 'Error al firmar el archivo RPF. Asegúrate de que es un archivo válido.' });
            }

            console.log('[fix-rpf] ArchiveFix salida:', stdout);

            // Leer el archivo ya firmado
            const fixedBuffer = fs.readFileSync(rpfPath);
            
            // Limpiar
            try { fs.unlinkSync(rpfPath); } catch {}

            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="FIXED_${req.file.originalname}"`);
            res.send(fixedBuffer);
        });

    } catch (err) {
        console.error('[fix-rpf] Error general:', err.message);
        try { fs.unlinkSync(rpfPath); } catch {}
        res.status(500).json({ error: err.message });
    }
});

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
