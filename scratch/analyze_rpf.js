const fs = require('fs');
const orig = fs.readFileSync('arma/MKII_LEOPARDO_LHC.rpf');

const entryCount = orig.readUInt32LE(8);
console.log('Entry count:', entryCount);

const ENTRY_START = 16;
const namesStart = ENTRY_START + (entryCount * 16);
console.log('Names start at offset: 0x' + namesStart.toString(16));

for (let i = 0; i < entryCount; i++) {
    const off = ENTRY_START + (i * 16);
    const w0 = orig.readUInt32LE(off);
    const w1 = orig.readUInt32LE(off + 4);
    const w2 = orig.readUInt32LE(off + 8);
    const w3 = orig.readUInt32LE(off + 12);
    
    const isDir = (w1 === 0x7FFFFF00);
    const nameOff = w0 & 0xFFFF;
    
    let name = '';
    let np = namesStart + nameOff;
    while (np < orig.length && orig[np] !== 0 && name.length < 64) {
        name += String.fromCharCode(orig[np]);
        np++;
    }
    
    if (isDir) {
        console.log('Entry ' + i + ' [DIR] name="' + name + '" childIdx=' + w2 + ' childCount=' + w3);
    } else {
        const fileOffset = (w2 & 0x00FFFFFF) * 512;
        const resType = (w2 >> 24) & 0xFF;
        console.log('Entry ' + i + ' [FILE] name="' + name + '" size=' + w1 + ' offset=0x' + fileOffset.toString(16) + ' resType=' + resType + ' flags=0x' + w3.toString(16));
    }
}
