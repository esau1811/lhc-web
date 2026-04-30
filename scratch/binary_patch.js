const fs = require('fs');
const buffer = fs.readFileSync('/var/www/lhc-node/ArchiveFix.exe');

// Search for the CIL pattern: 18 8D ?? ?? ?? ?? 18 28 ?? ?? ?? ?? 17 FE 05 2A
// Which is: ldc.i4.2, newarr, ldc.i4.2, call, ldc.i4.1, cgt.un, ret
const pattern = Buffer.from([0x18, 0x8D]);
let found = -1;

for (let i = 0; i < buffer.length - 16; i++) {
    if (buffer[i] === 0x18 && buffer[i+1] === 0x8D && buffer[i+6] === 0x18 && buffer[i+7] === 0x28 && buffer[i+12] === 0x17 && buffer[i+13] === 0xFE && buffer[i+14] === 0x05 && buffer[i+15] === 0x2A) {
        found = i;
        break;
    }
}

if (found !== -1) {
    console.log(`Pattern found at offset ${found}. Patching...`);
    // Replace with: 17 2A (ldc.i4.1, ret) and fill the rest with 00 (nop)
    buffer[found] = 0x17;
    buffer[found + 1] = 0x2A;
    for (let j = 2; j < 16; j++) {
        buffer[found + j] = 0x00;
    }
    fs.writeFileSync('/var/www/lhc-node/ArchiveFix_Patched.exe', buffer);
    console.log('Patch saved to ArchiveFix_Patched.exe');
} else {
    console.log('Pattern not found.');
}
