const express = require('express');
const multer = require('multer');
const cors = require('cors');

const app = express();
const port = 5000;
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

app.get('/ping', (req, res) => res.send('pong v17'));

/**
 * v17 - RPF7 Nested Rebuild Engine (Fixed Header Parsing)
 * 
 * Header structure:
 * 0: Magic (0x52504637)
 * 4: EntryCount
 * 8: NamesLength
 * 12: Encryption
 */
app.post('/api/WeaponConverter/convert', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');

    const targetId = (req.body.targetWeapon || '').toLowerCase().trim();
    const sourceId = (req.body.sourceWeapon || '').toLowerCase().trim();
    if (!targetId) return res.status(400).send('Missing target weapon ID.');

    const original = req.file.buffer;
    const log = [];

    try {
        log.push(`File size: ${original.length} bytes`);

        const rpfMagic = Buffer.from([0x37, 0x46, 0x50, 0x52]); // "7FPR"
        const rpfHeaders = [];
        let searchPos = 0;
        
        while ((searchPos = original.indexOf(rpfMagic, searchPos)) !== -1) {
            // Read header
            const entryCount = original.readUInt32LE(searchPos + 4);
            const namesLength = original.readUInt32LE(searchPos + 8);
            const encFlag = original.readUInt32LE(searchPos + 12);
            
            let encStr = 'UNKNOWN';
            if (encFlag === 0x4e45504f) encStr = 'OPEN';
            else if (encFlag === 0x0FFFFFF9) encStr = 'AES';
            else if (encFlag === 0x0FEFFFFF) encStr = 'NG';
            else if (encFlag === 0) encStr = 'NONE';
            else encStr = Buffer.from([encFlag&0xFF, (encFlag>>8)&0xFF, (encFlag>>16)&0xFF, (encFlag>>24)&0xFF]).toString('ascii');
            
            const entriesSize = entryCount * 16;
            const nameTableOffset = searchPos + 16 + entriesSize;
            
            rpfHeaders.push({
                offset: searchPos,
                entryCount,
                namesLength,
                encryption: encStr.trim(),
                nameTableOffset
            });
            
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
            const nameTableEnd = nameTableStart + rpf.namesLength;
            const nameTableSize = rpf.namesLength;

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
                // Preserve empty strings, as they are used by directory entries!
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

            if (!hasChanges) {
                log.push(`  No changes needed for this RPF`);
                continue;
            }

            const newNameTableSize = newNames.reduce((sum, n) => sum + n.newName.length + 1, 0);
            log.push(`  Old name table size: ${nameTableSize}, New: ${newNameTableSize}`);

            if (newNameTableSize > nameTableSize) {
                const dataStart = Math.ceil((rpf.offset + 16 + (rpf.entryCount * 16) + rpf.namesLength) / 512) * 512;
                const paddingAvailable = dataStart - nameTableEnd;
                const extraNeeded = newNameTableSize - nameTableSize;

                log.push(`  Need ${extraNeeded} extra bytes, padding available: ${paddingAvailable}`);

                if (extraNeeded <= paddingAvailable) {
                    const newNamesLength = rpf.namesLength + extraNeeded;
                    output.writeUInt32LE(newNamesLength, rpf.offset + 8);
                    log.push(`  Updated NamesLength: ${rpf.namesLength} -> ${newNamesLength}`);
                } else {
                    log.push(`  WARNING: Not enough padding, skipping expansion for safety`);
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

            while (writePos < nameTableEnd) {
                output[writePos] = 0;
                writePos++;
            }

            for (let i = 0; i < rpf.entryCount; i++) {
                const entryOffset = rpf.offset + 16 + (i * 16);
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
            return res.status(400).send(
                `No replacements made. Source "${sourceId}" not found in any RPF name table. ` +
                `Log: ${log.join(' | ')}`
            );
        }

        // Search the rest of the file for binary replacements (e.g. inside .ydr files)
        // But only if target <= source length to avoid expanding
        let binaryReplacements = 0;
        if (targetId.length <= sourceId.length) {
            const srcBuf = Buffer.from(sourceId, 'ascii');
            const dstBuf = Buffer.from(targetId, 'ascii');
            let offset = 0;
            while ((offset = output.indexOf(srcBuf, offset)) !== -1) {
                // Ignore if it's inside a name table we just rebuilt
                let inNameTable = false;
                for (const rpf of rpfHeaders) {
                    if (offset >= rpf.nameTableOffset && offset < rpf.nameTableOffset + rpf.namesLength) {
                        inNameTable = true;
                        break;
                    }
                }
                
                if (!inNameTable) {
                    dstBuf.copy(output, offset);
                    for (let p = dstBuf.length; p < srcBuf.length; p++) {
                        output[offset + p] = 0x00;
                    }
                    binaryReplacements++;
                    log.push(`  Binary patch at 0x${offset.toString(16)}`);
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
        console.error('[v17] Error:', e, '\nLog:', log.join('\n'));
        res.status(500).send('Converter error v17.0: ' + e.message);
    }
});

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

app.listen(port, '0.0.0.0', () => {
    console.log(`[v17] RPF7 Nested Rebuild Engine listening on port ${port}`);
});
