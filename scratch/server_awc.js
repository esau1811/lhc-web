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
const upload  = multer({ storage });

const chunksDir = path.join(__dirname, 'chunks');
if (!fs.existsSync(chunksDir)) fs.mkdirSync(chunksDir);

const templatesDir = path.join(__dirname, 'templates');
if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir);

function patchAWC(awcData, adpcmData) {
    let tadaOffset = awcData.indexOf(Buffer.from('TADA'));
    if (tadaOffset === -1) tadaOffset = awcData.indexOf(Buffer.from('AWC\x01'));
    if (tadaOffset === -1) throw new Error('AWC Magic not found');
    
    const body = awcData.slice(tadaOffset);
    const chunkCount = body.readUInt32LE(0x0C);
    let chunkTableOffset = 0x10;
    let audioChunkOffset = -1;
    let audioChunkIndex = -1;

    for (let i = 0; i < chunkCount; i++) {
        const type = body.readUInt8(chunkTableOffset + i * 16 + 12);
        if (type === 0x55) {
            audioChunkOffset = body.readUInt32LE(chunkTableOffset + i * 16);
            audioChunkIndex = i;
            break;
        }
    }

    if (audioChunkOffset === -1) throw new Error('No audio chunk');

    const patchedBody = Buffer.alloc(audioChunkOffset + adpcmData.length);
    body.copy(patchedBody, 0, 0, audioChunkOffset);
    adpcmData.copy(patchedBody, audioChunkOffset);

    const sizeMask = body.readUInt32LE(chunkTableOffset + audioChunkIndex * 16 + 4) & 0xFF000000;
    patchedBody.writeUInt32LE(adpcmData.length | sizeMask, chunkTableOffset + audioChunkIndex * 16 + 4);

    return Buffer.concat([awcData.slice(0, tadaOffset), patchedBody]);
}

async function convertToADPCM(inputBuffer) {
    const tempIn = path.join(__dirname, `temp_${Date.now()}.mp3`);
    const tempOut = path.join(__dirname, `temp_${Date.now()}.wav`);
    fs.writeFileSync(tempIn, inputBuffer);
    return new Promise((resolve, reject) => {
        ffmpeg(tempIn).toFormat('wav').audioCodec('adpcm_ima_wav').audioChannels(1).audioFrequency(32000)
            .on('end', () => {
                const res = fs.readFileSync(tempOut);
                fs.unlinkSync(tempIn); fs.unlinkSync(tempOut);
                resolve(res.slice(res.indexOf('data') + 8));
            }).on('error', reject).save(tempOut);
    });
}

// ENDPOINT PARA CHUNKS
router.post('/upload-chunk', upload.single('chunk'), (req, res) => {
    const { uploadId, index, total } = req.body;
    const chunkPath = path.join(chunksDir, `${uploadId}_${index}`);
    fs.writeFileSync(chunkPath, req.file.buffer);
    res.send({ status: 'ok' });
});

router.post('/assemble-and-inject', upload.single('audio'), async (req, res) => {
    try {
        const { uploadId, total, useTemplate, weaponType } = req.body;
        let awcBuffer;

        if (useTemplate === 'true') {
            const tPath = path.join(templatesDir, `${weaponType}.awc`);
            if (fs.existsSync(tPath)) awcBuffer = fs.readFileSync(tPath);
            else {
                // Assemble from chunks if template doesn't exist
                awcBuffer = Buffer.alloc(0);
                for (let i = 0; i < total; i++) {
                    const cPath = path.join(chunksDir, `${uploadId}_${i}`);
                    awcBuffer = Buffer.concat([awcBuffer, fs.readFileSync(cPath)]);
                    fs.unlinkSync(cPath);
                }
                fs.writeFileSync(tPath, awcBuffer);
            }
        } else {
            awcBuffer = Buffer.alloc(0);
            for (let i = 0; i < total; i++) {
                const cPath = path.join(chunksDir, `${uploadId}_${i}`);
                awcBuffer = Buffer.concat([awcBuffer, fs.readFileSync(cPath)]);
                fs.unlinkSync(cPath);
            }
        }

        const adpcm = await convertToADPCM(req.file.buffer);
        const patched = patchAWC(awcBuffer, adpcm);

        const zip = new JSZip();
        zip.file('patched.awc', patched);
        const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });

        res.set('Content-Type', 'application/zip');
        res.send(zipBuf);
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

app.use('/api/Sound', router);
app.listen(5000, () => console.log('[Hacker Chunk Mode] Ready on 5000'));
