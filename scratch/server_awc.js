const express = require('express');
const multer  = require('multer');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
const ffmpeg  = require('fluent-ffmpeg');
const JSZip   = require('jszip');

const app     = express();
const router  = express.Router();

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload  = multer({ storage, limits: { fileSize: 250 * 1024 * 1024 } });

// Crear carpeta de plantillas si no existe
const templatesDir = path.join(__dirname, 'templates');
if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir);

function patchAWC(awcData, adpcmData) {
    let tadaOffset = awcData.indexOf(Buffer.from('TADA'));
    if (tadaOffset === -1) tadaOffset = awcData.indexOf(Buffer.from('AWC\x01'));
    
    if (tadaOffset === -1) {
        const magicHex = awcData.slice(0, 4).toString('hex');
        console.log(`[AWC] Header Magic: (Hex: ${magicHex})`);
        console.log(`[AWC] First 64 bytes: ${awcData.slice(0, 64).toString('hex')}`);
        throw new Error('No se encontró una firma AWC válida en el archivo. Hex: ' + magicHex);
    }
    
    console.log(`[AWC] Found valid signature at offset: ${tadaOffset}`);
    const head = awcData.slice(0, tadaOffset);
    const body = awcData.slice(tadaOffset);
    
    const streamCount = body.readUInt32LE(0x08);
    const chunkCount = body.readUInt32LE(0x0C);
    
    let chunkTableOffset = 0x10;
    let audioChunkOffset = -1;
    let audioChunkSize = -1;
    let audioChunkIndex = -1;

    for (let i = 0; i < chunkCount; i++) {
        const type = body.readUInt8(chunkTableOffset + i * 16 + 12);
        if (type === 0x55) {
            audioChunkOffset = body.readUInt32LE(chunkTableOffset + i * 16);
            audioChunkSize = body.readUInt32LE(chunkTableOffset + i * 16 + 4) & 0x00FFFFFF;
            audioChunkIndex = i;
            break;
        }
    }

    if (audioChunkOffset === -1) throw new Error('No se encontró bloque de audio (0x55)');

    const patchedBody = Buffer.alloc(audioChunkOffset + adpcmData.length);
    body.copy(patchedBody, 0, 0, audioChunkOffset);
    adpcmData.copy(patchedBody, audioChunkOffset);

    const sizeMask = body.readUInt32LE(chunkTableOffset + audioChunkIndex * 16 + 4) & 0xFF000000;
    patchedBody.writeUInt32LE(adpcmData.length | sizeMask, chunkTableOffset + audioChunkIndex * 16 + 4);

    return Buffer.concat([head, patchedBody]);
}

async function convertToADPCM(inputBuffer) {
    const tempIn = path.join(__dirname, `temp_in_${Date.now()}.mp3`);
    const tempOut = path.join(__dirname, `temp_out_${Date.now()}.wav`);
    fs.writeFileSync(tempIn, inputBuffer);

    return new Promise((resolve, reject) => {
        ffmpeg(tempIn)
            .toFormat('wav')
            .audioCodec('adpcm_ima_wav')
            .audioChannels(1)
            .audioFrequency(32000)
            .on('error', (err) => reject(err))
            .on('end', () => {
                const result = fs.readFileSync(tempOut);
                fs.unlinkSync(tempIn);
                fs.unlinkSync(tempOut);
                resolve(result.slice(result.indexOf('data') + 8));
            })
            .save(tempOut);
    });
}

router.post('/inject', upload.fields([{ name: 'audio' }, { name: 'awc' }]), async (req, res) => {
    try {
        const audioFile = req.files['audio'] ? req.files['audio'][0] : null;
        const useTemplate = req.body.useTemplate === 'true';
        const weaponType = req.body.weaponType || 'pistol';

        let awcBuffer;
        if (useTemplate) {
            const templatePath = path.join(__dirname, 'templates', `${weaponType}.awc`);
            if (!fs.existsSync(templatePath)) {
                // Si no existe la plantilla, comprobamos si nos han pasado un AWC para guardarlo como plantilla
                const awcFile = req.files['awc'] ? req.files['awc'][0] : null;
                if (!awcFile) return res.status(400).send(`Falta plantilla para ${weaponType}. Por favor, sube el archivo una vez para guardarlo.`);
                awcBuffer = awcFile.buffer;
                fs.writeFileSync(templatePath, awcBuffer);
                console.log(`[AWC] Template saved: ${weaponType}`);
            } else {
                awcBuffer = fs.readFileSync(templatePath);
            }
        } else {
            const awcFile = req.files['awc'] ? req.files['awc'][0] : null;
            if (!awcFile) return res.status(400).send('Falta el archivo .awc');
            awcBuffer = awcFile.buffer;
        }

        if (!audioFile) return res.status(400).send('Falta el archivo de audio');

        const adpcmBuffer = await convertToADPCM(audioFile.buffer);
        const patchedBuffer = patchAWC(awcBuffer, adpcmBuffer);

        const zip = new JSZip();
        zip.file(useTemplate ? `${weaponType}.awc` : 'patched.awc', patchedBuffer);
        const zipContent = await zip.generateAsync({ type: 'nodebuffer' });

        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', `attachment; filename=LHC_Sound_${weaponType}.zip`);
        res.send(zipContent);

    } catch (err) {
        console.error('[AWC] Error:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

app.use('/api/Sound', router);
app.listen(5000, () => console.log('[AWC Pipeline] Ready on port 5000'));
