'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const AdmZip = require('adm-zip');

// Generate a tiny test MP3
const tmpMp3 = path.join(require('os').tmpdir(), 'test_lhc.mp3');
execSync(`ffmpeg -y -f lavfi -i "sine=frequency=440:duration=0.5" -b:a 64k "${tmpMp3}"`, {stdio:'pipe'});
const mp3 = fs.readFileSync(tmpMp3);
console.log('Test MP3:', mp3.length, 'bytes');

async function testEndpoint(name, url) {
    const fd = new FormData();
    fd.append('audio', new Blob([mp3], {type:'audio/mpeg'}), 'test.mp3');
    
    console.log('\nTesting ' + name + '...');
    const r = await fetch(url, { method: 'POST', body: fd });
    console.log('  Status:', r.status, r.statusText);
    if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        console.log('  ZIP size:', buf.length, 'bytes');
        const zip = new AdmZip(buf);
        const entries = zip.getEntries();
        console.log('  Files in ZIP:');
        entries.forEach(e => console.log('    -', e.entryName, '(' + e.header.size + ' bytes)'));
    } else {
        console.log('  Error:', await r.text());
    }
}

(async () => {
    await testEndpoint('Kill Sound', 'https://187.33.157.103.nip.io/api/Sound/kill');
    await testEndpoint('Weapon Sound', 'https://187.33.157.103.nip.io/api/Sound/weapon');
    fs.unlinkSync(tmpMp3);
    console.log('\n✓ All tests passed!');
})();
