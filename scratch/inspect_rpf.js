const fs = require('fs');
const path = 'C:/Users/esau2/.gemini/antigravity/scratch/LHC/arma/MK2_911_LHC.rpf';
const fd = fs.openSync(path, 'r');
const buffer = Buffer.alloc(128);
fs.readSync(fd, buffer, 0, 128, 0);
fs.closeSync(fd);

console.log('--- RPF HEADER ANALYSIS ---');
const magic = buffer.slice(0, 4).toString();
console.log('Magic:', magic);

const tocSize = buffer.readUInt32LE(4);
console.log('TOC Size:', tocSize);

const entryCount = buffer.readUInt32LE(8);
console.log('Entry Count:', entryCount);

const flags = buffer.readUInt32LE(12);
console.log('Flags:', flags.toString(16));
console.log('Encrypted:', (flags !== 0 && flags !== 0x00FFFFFF && flags !== 0xFFFFFFFF) ? 'YES' : 'NO');

console.log('\n--- FIRST ENTRIES ---');
for (let i = 0; i < Math.min(entryCount, 5); i++) {
    const offset = 0x10 + (i * 16);
    const nameOffset = buffer.readUInt32LE(offset) & 0xFFFF;
    const hash = buffer.readUInt32LE(offset + 4);
    console.log(`Entry ${i}: NameOffset=${nameOffset}, Hash=${hash.toString(16)}`);
}

const namesOffset = 0x10 + (entryCount * 16);
console.log('\nCalculated Names Table Offset:', namesOffset);
