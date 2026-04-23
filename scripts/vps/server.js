const express = require('express');
const multer = require('multer');
const cors = require('cors');

const app = express();
const port = 5000;
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

app.get('/ping', (req, res) => res.send('pong v15'));

function jenkinsHash(str) {
    let hash = 0;
    const s = str.toLowerCase();
    for (let i = 0; i < s.length; i++) {
        hash += s.charCodeAt(i);
        hash += (hash << 10);
        hash ^= (hash >>> 6);
    }
    hash += (hash << 3);
    hash ^= (hash >>> 11);
    hash += (hash << 15);
    return (hash >>> 0);
}

/**
 * v15 - Direct Binary Modification Engine
 * 
 * Instead of trying to parse the encrypted RPF7 TOC or extract/rebuild,
 * we modify the ORIGINAL file bytes directly:
 * 1. Scan the entire buffer for ASCII occurrences of the source weapon name
 * 2. Replace each occurrence with the target weapon name
 * 3. Handle length differences by padding or expanding
 * 4. Return the modified original file
 */
app.post('/api/WeaponConverter/convert', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');

    const targetId = (req.body.targetWeapon || '').toLowerCase().trim();
    const sourceId = (req.body.sourceWeapon || '').toLowerCase().trim();
    if (!targetId) return res.status(400).send('Missing target weapon ID.');

    const original = req.file.buffer;
    const log = [];

    try {
        // Log header bytes for diagnostics (don't block on format)
        const headerHex = original.slice(0, 8).toString('hex');
        const magic = original.toString('ascii', 0, 4);
        log.push(`Header: ${headerHex} (${magic}), Size: ${original.length} bytes`);

        // --- STEP 1: Detect source weapon name from file contents ---
        // Scan the file for weapon name patterns (w_pi_*, w_ar_*, etc.)
        const detectedNames = new Set();
        let ascii = '';
        const scanLimit = Math.min(original.length, 4 * 1024 * 1024);
        for (let i = 0; i < scanLimit; i++) {
            const b = original[i];
            if (b >= 0x20 && b <= 0x7E) {
                ascii += String.fromCharCode(b);
            } else {
                if (ascii.length >= 8) {
                    const lower = ascii.toLowerCase();
                    if (lower.match(/w_(pi|sb|ar|sg|mg|sr|lr|me|ex)_\w+/)) {
                        // Extract the base weapon ID (without extension)
                        const match = lower.match(/(w_(?:pi|sb|ar|sg|mg|sr|lr|me|ex)_[a-z0-9_]+?)(?:\.(?:ydr|ytd|yft|ydd)|_hi|_mag|$)/);
                        if (match) detectedNames.add(match[1]);
                    }
                }
                ascii = '';
            }
        }

        let sourceBase = sourceId || '';
        if (!sourceBase && detectedNames.size > 0) {
            // Pick the most common/longest detected name
            sourceBase = [...detectedNames].sort((a, b) => b.length - a.length)[0];
        }
        log.push(`Detected names: ${[...detectedNames].join(', ')}`);
        log.push(`Source base: "${sourceBase}", Target: "${targetId}"`);

        if (!sourceBase) {
            return res.status(400).send('Could not detect source weapon name in file. Names found: ' + [...detectedNames].join(', '));
        }

        // --- STEP 2: Build replacement map ---
        // We need to replace all variations of the source name with target equivalents
        // Sort by longest first to avoid partial matches
        const replacements = [];

        // Full file names with extensions
        const extensions = ['.ydr', '.ytd', '.yft', '.ydd'];
        const suffixes = ['_hi', '_mag', '_mag1', '_clip', '_scope', '_supp', '_flash', ''];

        for (const suffix of suffixes) {
            for (const ext of extensions) {
                const src = sourceBase + suffix + ext;
                const dst = targetId + suffix + ext;
                replacements.push({ src, dst });
            }
            // Also without extension (for hash references, etc.)
            replacements.push({ src: sourceBase + suffix, dst: targetId + suffix });
        }

        // Sort by source length descending (replace longer strings first)
        replacements.sort((a, b) => b.src.length - a.src.length);
        // Remove duplicates
        const seen = new Set();
        const uniqueReplacements = replacements.filter(r => {
            if (seen.has(r.src)) return false;
            seen.add(r.src);
            return true;
        });

        log.push(`Replacement pairs: ${uniqueReplacements.length}`);

        // --- STEP 3: Perform binary replacement ---
        // We work on a copy of the original buffer
        // Strategy: find each occurrence and replace in-place
        // If target is shorter: pad with 0x00
        // If target is longer: we need to handle this carefully
        
        let output = Buffer.from(original); // clone
        let totalReplacements = 0;

        for (const { src, dst } of uniqueReplacements) {
            const srcBuf = Buffer.from(src, 'ascii');
            const dstBuf = Buffer.from(dst, 'ascii');

            let offset = 0;
            while ((offset = output.indexOf(srcBuf, offset)) !== -1) {
                if (dstBuf.length <= srcBuf.length) {
                    // Target is shorter or equal: overwrite + null-pad remainder
                    dstBuf.copy(output, offset);
                    for (let p = dstBuf.length; p < srcBuf.length; p++) {
                        output[offset + p] = 0x00;
                    }
                } else {
                    // Target is LONGER: need to expand the buffer
                    // Create new buffer with extra space
                    const diff = dstBuf.length - srcBuf.length;
                    const newBuf = Buffer.alloc(output.length + diff, 0);
                    // Copy everything before the match
                    output.copy(newBuf, 0, 0, offset);
                    // Write the new (longer) name
                    dstBuf.copy(newBuf, offset);
                    // Copy everything after the old name
                    output.copy(newBuf, offset + dstBuf.length, offset + srcBuf.length);
                    output = newBuf;
                }

                log.push(`  Replaced "${src}" at offset 0x${offset.toString(16)}`);
                totalReplacements++;
                offset += dstBuf.length;
            }
        }

        log.push(`Total replacements: ${totalReplacements}`);

        // --- STEP 4: Update RPF7 header if size changed ---
        if (output.length !== original.length) {
            // Update TOC size in header (bytes 4-7)
            const oldTocSize = original.readUInt32LE(4);
            const sizeDiff = output.length - original.length;
            output.writeUInt32LE(oldTocSize + sizeDiff, 4);
            log.push(`Buffer expanded by ${sizeDiff} bytes. TOC size updated.`);
        }

        // --- STEP 5: Verification - check no source name remains ---
        const verification = output.indexOf(Buffer.from(sourceBase, 'ascii'));
        if (verification !== -1) {
            log.push(`WARNING: Source name "${sourceBase}" still found at offset 0x${verification.toString(16)}`);
        } else {
            log.push(`VERIFIED: No remaining references to "${sourceBase}"`);
        }

        // --- STEP 6: Verify target name IS present ---
        const targetCheck = output.indexOf(Buffer.from(targetId, 'ascii'));
        if (targetCheck !== -1) {
            log.push(`CONFIRMED: Target "${targetId}" found at offset 0x${targetCheck.toString(16)}`);
        } else {
            log.push(`WARNING: Target "${targetId}" NOT found in output!`);
        }

        console.log('[v15] ' + log.join('\n[v15] '));

        if (totalReplacements === 0) {
            return res.status(400).send(
                `No replacements made. Source "${sourceBase}" not found as ASCII in file. ` +
                `The TOC may be AES-encrypted. Detected strings: ${[...detectedNames].join(', ')}. ` +
                `Try extracting .ydr/.ytd files with OpenIV first and uploading them as loose files.`
            );
        }

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${targetId}.rpf"`);
        res.setHeader('X-Replacement-Count', String(totalReplacements));
        res.setHeader('X-Engine-Version', 'v15.0-binary');
        res.setHeader('Access-Control-Expose-Headers', 'X-Replacement-Count, X-Engine-Version');
        res.send(output);

    } catch (e) {
        console.error('[v15] Error:', e, '\nLog:', log.join('\n'));
        res.status(500).send('Converter error v15.0: ' + e.message);
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`[v15] Weapon converter listening on port ${port}`);
});
