const fs = require('fs');
const zlib = require('zlib');
const rpf = fs.readFileSync('/tmp/uploaded_user.rpf');
// lmg_combat.awc is at page 2, us=55496
const raw = rpf.slice(2 * 512, 2 * 512 + 55496);

try {
    const unz = zlib.inflateRawSync(raw);
    console.log('inflateRawSync success! first bytes:', unz.slice(0, 16).toString('hex'));
} catch(e) {
    console.log('inflateRawSync failed:', e.message);
}

try {
    const unz = zlib.inflateSync(raw);
    console.log('inflateSync success! first bytes:', unz.slice(0, 16).toString('hex'));
} catch(e) {
    console.log('inflateSync failed:', e.message);
}
