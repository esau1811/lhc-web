const fs = require('fs');

// The name table IS encrypted (AES-256). Only OpenIV can decrypt it.
// But we know from the GTA5 modding community what suppressor files exist.
// Let me use a different approach: look for the weapon files that are known.
// 
// The weapon attachment files live inside: 
// x64e.rpf -> models/cdimages/weapons.rpf
// Let's find offset of an inner 'weapons.rpf'

const fd = fs.openSync('D:/juegos pc/GTAV/x64e.rpf', 'r');
const stat = fs.fstatSync(fd);
const fileSize = stat.size;

console.log('Scanning x64e.rpf for nested RPF name tables...');

// Search in chunks for readable strings matching weapon names
// Weapon data files are often stored unencrypted after the RPF header
// Let's scan for the string 'weapons' in the archive
const CHUNK = 4 * 1024 * 1024;
const buf = Buffer.alloc(CHUNK);
let found = [];
let offset = 0;

while (offset < Math.min(fileSize, 100 * 1024 * 1024)) { // first 100MB
    const toRead = Math.min(CHUNK, fileSize - offset);
    fs.readSync(fd, buf, 0, toRead, offset);
    
    for (let i = 0; i < toRead - 8; i++) {
        // Look for 'weapons' ASCII
        if (buf[i] === 0x77 && buf[i+1] === 0x65 && buf[i+2] === 0x61 && buf[i+3] === 0x70) {
            let s = '';
            for (let j = i; j < Math.min(i+20, toRead); j++) {
                if (buf[j] < 32 || buf[j] > 126) break;
                s += String.fromCharCode(buf[j]);
            }
            if (s.length > 5) found.push({ off: offset + i, s });
        }
    }
    offset += CHUNK;
}

fs.closeSync(fd);
console.log('Found', found.length, 'matches:');
found.slice(0, 20).forEach(f => console.log('  offset=' + f.off + ' "' + f.s + '"'));