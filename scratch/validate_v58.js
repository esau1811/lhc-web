// Validate the output RPF from v58
const { Client } = require('ssh2');
const fs = require('fs');

const c = new Client();
c.on('ready', () => {
    c.sftp((err, sftp) => {
        if (err) { console.error(err); c.end(); return; }
        
        // Upload RPF
        const rpf = fs.readFileSync('arma/WEAPONS_PLAYER.rpf');
        sftp.writeFile('/tmp/test_wpf.rpf', rpf, () => {
            // Generate tone, call API, then validate result
            const script = `
cd /tmp
ffmpeg -y -f lavfi -i "sine=frequency=440:duration=1" -ac 1 -ar 32000 -c:a pcm_s16le test_tone.wav 2>/dev/null
curl -s -o /tmp/result.zip -F "files=@/tmp/test_wpf.rpf" -F "files=@/tmp/test_tone.wav" http://localhost:5000/api/Sound/inject

# Extract and validate
cd /tmp && unzip -o result.zip 2>/dev/null
echo "=== EXTRACTED FILES ==="
ls -la "LHC Sound boost/" 2>/dev/null

# Validate RPF structure
node -e "
const fs = require('fs');
const buf = fs.readFileSync('/tmp/LHC Sound boost/test_wpf.rpf');
const magic = buf.slice(0,4).toString('ascii');
const ec = buf.readUInt32LE(4);
const nl = buf.readUInt32LE(8);
const et = buf.readUInt32LE(12);
const encName = et === 0x4E45504F ? 'OPEN' : et === 0 ? 'NONE' : et === 0x0FFFFFF9 ? 'AES' : 'OTHER';
console.log('Magic:', magic);
console.log('Entries:', ec);
console.log('NamesLen:', nl);
console.log('Encryption:', encName, '(0x' + et.toString(16) + ')');
console.log('File size:', buf.length);

// Read first AWC entry data and check for ADAT
const dh = buf.slice(16, 16 + ec * 16 + nl);
const nts = ec * 16;
for (let i = 1; i < Math.min(4, ec); i++) {
    const eo = i * 16;
    const nameOff = dh.readUInt16LE(eo);
    let name = '', p = nts + nameOff;
    while (p < nts + nl && dh[p] !== 0) name += String.fromCharCode(dh[p++]);
    const page = dh[eo+5] | (dh[eo+6]<<8) | (dh[eo+7]<<16);
    const us = dh.readUInt32LE(eo + 8);
    const off = page * 512;
    console.log('E' + i + ':', name, 'page=' + page, 'us=' + us, 'off=' + off);
    if (off + 16 <= buf.length) {
        const firstBytes = buf.slice(off, off + 16);
        const magic4 = firstBytes.slice(0, 4).toString('ascii');
        console.log('  Data[0:16]:', firstBytes.toString('hex'), '(\"' + magic4 + '\")');
        console.log('  HAS ADAT:', magic4 === 'ADAT');
    }
}
"

rm -rf "/tmp/LHC Sound boost" /tmp/test_wpf.rpf /tmp/test_tone.wav /tmp/result.zip
`;
            c.exec(script, (e, s) => {
                s.on('data', d => process.stdout.write(d));
                s.stderr.on('data', d => process.stderr.write(d));
                s.on('close', () => c.end());
            });
        });
    });
}).connect({
    host: '187.33.157.103',
    port: 22,
    username: 'root',
    password: 'diScordLhcds032.w'
});
