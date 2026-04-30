const fs = require('fs');
const b = fs.readFileSync('/tmp/uploaded_user.rpf');
console.log('Size:', b.length);
console.log('Magic:', b.toString('hex', 0, 4));
console.log('Header bytes 0-16:', b.slice(0, 16).toString('hex'));
const ec = b.readUInt32LE(4);
const nl = b.readUInt32LE(8);
const et = b.readUInt32LE(12);
console.log('EC:', ec, 'NL:', nl, 'ET:', et.toString(16));
console.log('First 5 raw TOC entries (unencrypted, as-is):');
for (let i = 0; i < Math.min(ec, 5); i++) {
    const eo = 16 + i * 16;
    console.log('Entry', i, ':', b.slice(eo, eo + 16).toString('hex'));
}
// Also show the name table area
console.log('Name table start (at 16+ec*16):');
const nameStart = 16 + ec * 16;
console.log(b.slice(nameStart, nameStart + 200).toString('utf8').replace(/\0/g, '|'));
