'use strict';
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

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, `upload_${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage: storage });

const CHUNKS_DIR = path.join(os.tmpdir(), 'lhc_chunks');
if (!fs.existsSync(CHUNKS_DIR)) fs.mkdirSync(CHUNKS_DIR, { recursive: true });

// ENDPOINT PARA RECIBIR TROZOS (CHUNKS)
app.post('/api/Sound/upload-chunk', upload.single('chunk'), (req, res) => {
    const { uploadId, index } = req.body;
    const chunkPath = path.join(CHUNKS_DIR, `${uploadId}_${index}`);
    fs.renameSync(req.file.path, chunkPath);
    res.json({ status: 'ok' });
});

// ENDPOINT PARA UNIR TROZOS Y FIRMAR RPF
app.post('/api/Sound/assemble-and-fix-rpf', async (req, res) => {
    req.setTimeout(0);
    const { uploadId, total, fileName } = req.body;
    const rpfPath = path.join(os.tmpdir(), `assembled_${Date.now()}_${fileName}`);
    const writeStream = fs.createWriteStream(rpfPath);

    try {
        for (let i = 0; i < total; i++) {
            const chunkPath = path.join(CHUNKS_DIR, `${uploadId}_${i}`);
            const chunkBuffer = fs.readFileSync(chunkPath);
            writeStream.write(chunkBuffer);
            fs.unlinkSync(chunkPath); // Borrar trozo usado
        }
        writeStream.end();

        writeStream.on('finish', () => {
            console.log(`[fix-rpf] Archivo ensamblado: ${rpfPath}. Firmando...`);
            exec(`wine ArchiveFix.exe "${rpfPath}"`, (err) => {
                if (err) return res.status(500).json({ error: 'Error ArchiveFix' });
                const fixed = fs.readFileSync(rpfPath);
                res.send(fixed);
                fs.unlinkSync(rpfPath);
            });
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ... (Resto de funciones patchAWC, patchSurgical, prepareAudio se mantienen iguales)
function findAWCHeader(data) { if (!data || data.length < 4) return -1; if (data[0] === 0x41 && data[1] === 0x57 && data[2] === 0x43 && data[3] === 0x20) return 0; let off = data.indexOf(Buffer.from('ADAT')); if (off === -1) off = data.indexOf(Buffer.from('TADA')); return off; }
function jenkinsHash(str) { str = (str || "").toLowerCase(); let hash = 0; for (let i = 0; i < str.length; i++) { hash += str.charCodeAt(i); hash += (hash << 10); hash ^= (hash >>> 6); } hash += (hash << 3); hash ^= (hash >>> 11); hash += (hash << 15); return (hash >>> 0); }

function patchSurgical(awcData, pcmData, targetName) {
    let tadaOff = findAWCHeader(awcData);
    if (tadaOff === -1) throw new Error('AWC encriptado.');
    const targetId = jenkinsHash(targetName);
    const b = Buffer.from(awcData.slice(tadaOff));
    const entryCount = b.readUInt16LE(0x06);
    let found = false;
    const newMeta = Buffer.from([0x00,0x00,0x00,0x00,0x00,0x7D,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00]);
    const audioPos = b.length; const metaPos = audioPos + pcmData.length;
    const finalBuf = Buffer.alloc(metaPos + newMeta.length, 0);
    b.copy(finalBuf, 0); pcmData.copy(finalBuf, audioPos); newMeta.copy(finalBuf, metaPos);
    for (let i = 0x10; i < 0x10 + (entryCount * 16); i += 16) {
        if (i + 16 > b.length) break;
        const id = finalBuf.readUInt32LE(i + 8); const type = finalBuf[i + 12];
        if (id === targetId) {
            if (type === 0x55) { finalBuf.writeUInt32LE(audioPos, i); finalBuf.writeUInt32LE((pcmData.length & 0xFFFFFF) | 0x01000000, i + 4); found = true; }
            else if (type === 0x01) { finalBuf.writeUInt32LE(metaPos, i); finalBuf.writeUInt32LE((newMeta.length & 0xFFFFFF) | 0x01000000, i + 4); }
        }
    }
    if (!found) throw new Error(`"${targetName}" no encontrado.`);
    const out = Buffer.alloc(tadaOff + finalBuf.length); awcData.copy(out, 0, 0, tadaOff); finalBuf.copy(out, tadaOff);
    return out;
}

app.post('/api/Sound/assemble-and-inject', upload.fields([{ name: 'audio' }, { name: 'awc' }]), async (req, res) => {
    req.setTimeout(0);
    try {
        const audioBuf = fs.readFileSync(req.files['audio'][0].path);
        const awcBuf = fs.readFileSync(req.files['awc'][0].path);
        const { surgicalName, sampleRate } = req.body;
        exec(`ffmpeg -y -i "${req.files['audio'][0].path}" -f s16le -acodec pcm_s16le -ar ${sampleRate || 32000} -ac 1 "/tmp/out.raw"`, (err) => {
            const pcm = fs.readFileSync("/tmp/out.raw");
            let patched;
            if (surgicalName) patched = patchSurgical(awcBuf, pcm, surgicalName);
            else { /* patchAWC simple... */ }
            const zip = new AdmZip(); zip.addFile(req.files['awc'][0].originalname, patched);
            res.send(zip.toBuffer());
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(5000, '0.0.0.0', () => console.log('Servidor con soporte de Chunks listo'));
