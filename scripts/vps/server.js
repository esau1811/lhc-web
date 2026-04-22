const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// Aumentar límites para archivos de hasta 100MB
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } 
});

app.get('/ping', (req, res) => {
    res.send('pong');
});

app.post('/api/WeaponConverter/convert', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No se subió ningún archivo.');
    }

    const sourceId = req.body.sourceWeapon || req.body.weaponId;
    const targetId = req.body.targetWeapon || 'target';

    console.log(`Recibido RPF para ${sourceId} -> ${targetId}. Tamaño: ${req.file.size} bytes`);

    // In-memory byte replacement
    const result = Buffer.from(req.file.buffer);

    const sourceBytes = Buffer.from(sourceId, 'ascii');
    const targetBytes = Buffer.from(targetId, 'ascii');
    const paddedTarget = Buffer.alloc(sourceBytes.length, 0);
    targetBytes.copy(paddedTarget, 0, 0, Math.min(targetBytes.length, sourceBytes.length));

    let offset = 0;
    while (offset < result.length - sourceBytes.length) {
        const idx = result.indexOf(sourceBytes, offset);
        if (idx === -1) break;
        paddedTarget.copy(result, idx);
        offset = idx + sourceBytes.length;
    }

    const sourceLower = sourceId.toLowerCase();
    if (sourceLower !== sourceId) {
        const srcBuf = Buffer.from(sourceLower, 'ascii');
        const tgtBuf = Buffer.alloc(srcBuf.length, 0);
        Buffer.from(targetId.toLowerCase(), 'ascii').copy(tgtBuf, 0, 0, Math.min(targetId.length, srcBuf.length));

        let off = 0;
        while (off < result.length - srcBuf.length) {
            const i = result.indexOf(srcBuf, off);
            if (i === -1) break;
            tgtBuf.copy(result, i);
            off = i + srcBuf.length;
        }
    }

    // Devolver el buffer modificado
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${targetId}.rpf"`);
    res.setHeader('Content-Length', result.length);
    res.send(result);
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor ligero escuchando en el puerto ${port}`);
});
