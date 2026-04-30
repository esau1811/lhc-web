const fs = require('fs');
const b = fs.readFileSync('/tmp/test_decrypt.rpf');
const et = b.readUInt32LE(12);
console.log('ET after donotuse_really: 0x' + et.toString(16));
console.log('Size:', b.length);
// Check first AWC (page 2, lmg_combat.awc) - first 16 bytes
// If OPEN, we can read the TOC directly 
const EC = b.readUInt32LE(4);
const NL = b.readUInt32LE(8);
// Try reading TOC as-is (would work if OPEN)
const firstEntry = b.slice(16, 32);
console.log('First TOC entry (raw):', firstEntry.toString('hex'));
// If et is 0 or OPEN, TOC is plaintext
if (et === 0 || et === 0x4E45504F) {
    console.log('IS OPEN! Reading AWC...');
    const page = firstEntry[5] | (firstEntry[6]<<8) | (firstEntry[7]<<16);
    const awcOff = page * 512;
    console.log('First file page:', page, 'offset:', awcOff);
    console.log('AWC first 16 bytes:', b.slice(awcOff, awcOff+16).toString('hex'));
} else {
    console.log('Still encrypted. ET = 0x' + et.toString(16));
}
