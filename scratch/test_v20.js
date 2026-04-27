// Test v20 NG decryption: send WEAPONS_PLAYER.rpf (NG-encrypted) + test audio
const fs     = require('fs');
const path   = require('path');
const { exec } = require('child_process');
const os     = require('os');

const VPS = 'https://187.33.157.103.nip.io';

async function main() {
    // Generate a short test tone (1 second, 440 Hz sine wave) using ffmpeg
    const testMp3 = path.join(os.tmpdir(), 'test_tone.mp3');
    console.log('Generating test audio...');
    await new Promise((resolve, reject) => {
        exec(
            `ffmpeg -y -f lavfi -i "sine=frequency=440:duration=1" "${testMp3}" 2>&1`,
            (err, out) => err ? reject(new Error(out.slice(-200))) : resolve()
        );
    });
    console.log('Test audio generated:', testMp3);

    // Read files
    const rpfBuf   = fs.readFileSync('LHC Sound boost/WEAPONS_PLAYER.rpf');
    const audioBuf = fs.readFileSync(testMp3);
    const enc = rpfBuf.readUInt32LE(12);
    console.log(`RPF encryption: 0x${enc.toString(16)} (${enc === 0x0FEFFFFF ? 'NG ✓' : 'other'})`);
    console.log(`RPF size: ${rpfBuf.length} bytes`);

    // Build multipart form data manually
    const boundary = '----TestBoundary' + Date.now();
    const parts = [];

    const addFile = (fieldName, filename, mime, data) => {
        parts.push(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
            `Content-Type: ${mime}\r\n\r\n`
        );
        parts.push(data);
        parts.push('\r\n');
    };

    addFile('audio', 'test_tone.mp3', 'audio/mpeg', audioBuf);
    addFile('rpf',   'WEAPONS_PLAYER.rpf', 'application/octet-stream', rpfBuf);
    parts.push(`--${boundary}--\r\n`);

    const body = Buffer.concat(parts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(p)));

    console.log(`\nPOST ${VPS}/api/Sound/inject ...`);
    const start = Date.now();

    const resp = await fetch(`${VPS}/api/Sound/inject`, {
        method: 'POST',
        headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
    });

    const elapsed = Date.now() - start;
    console.log(`Response: ${resp.status} ${resp.statusText} (${elapsed}ms)`);

    if (!resp.ok) {
        const text = await resp.text();
        console.error('ERROR:', text);
        process.exit(1);
    }

    const zipBuf = Buffer.from(await resp.arrayBuffer());
    const outPath = 'scratch/test_v20_output.zip';
    fs.writeFileSync(outPath, zipBuf);
    console.log(`ZIP saved: ${outPath} (${zipBuf.length} bytes)`);

    // Quick inspection
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(outPath);
    const entries = zip.getEntries();
    console.log('\nZIP contents:');
    entries.forEach(e => console.log(`  ${e.entryName} (${e.header.size} bytes)`));

    // Verify the WEAPONS_PLAYER.rpf in the ZIP is OPEN and has modified audio
    const weapEntry = entries.find(e => e.entryName.includes('WEAPONS_PLAYER.rpf'));
    if (weapEntry) {
        const buf = weapEntry.getData();
        const newEnc = buf.readUInt32LE(12);
        const magic  = buf.slice(0, 4).toString('hex');
        console.log(`\nOutput WEAPONS_PLAYER.rpf:`);
        console.log(`  Magic:      ${magic} (expected: 37465052)`);
        console.log(`  Encryption: 0x${newEnc.toString(16)} (expected: 4e45504f = OPEN)`);
        console.log(`  Size:       ${buf.length} bytes`);

        // Verify OGG magic is present in the output
        const oggMagic = Buffer.from([0x4F, 0x67, 0x67, 0x53]);
        const oggPos = buf.indexOf(oggMagic);
        console.log(`  OGG present at offset: ${oggPos >= 0 ? '0x' + oggPos.toString(16) : 'NOT FOUND'}`);

        if (magic === '37465052' && newEnc === 0x4E45504F && oggPos >= 0) {
            console.log('\n✓ SUCCESS: NG RPF decrypted, audio injected, output is OPEN RPF');
        } else {
            console.log('\n✗ FAIL: output validation failed');
        }
    }

    // Cleanup
    try { fs.unlinkSync(testMp3); } catch {}
}

main().catch(err => {
    console.error('Test failed:', err.message);
    process.exit(1);
});
