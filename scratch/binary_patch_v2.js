const fs = require('fs');
const buffer = fs.readFileSync('/var/www/lhc-node/ArchiveFix.exe');

// Pattern for: call bool class ArchiveFix.Program::get_IsInvokedFromConsole()
// Which is: 28 08 00 00 06 (token 0x06000008)
const pattern = Buffer.from([0x28, 0x08, 0x00, 0x00, 0x06]);
let foundCount = 0;

for (let i = 0; i < buffer.length - 5; i++) {
    if (buffer[i] === 0x28 && buffer[i+1] === 0x08 && buffer[i+2] === 0x00 && buffer[i+3] === 0x00 && buffer[i+4] === 0x06) {
        console.log(`Pattern found at offset ${i}. Patching...`);
        // Replace with: ldc.i4.1, ret, nop, nop, nop
        // wait, this is in Main, we want to skip the "if"
        // Original:
        // IL_01d4: call get_IsInvokedFromConsole
        // IL_01d9: brtrue.s IL_01f0
        // We want to just NOP everything or make it always true.
        // Let's replace the call with ldc.i4.1 and ret? No, we are in Main!
        // We should replace with NOPs (0x00)
        for (let j = 0; j < 5; j++) {
            buffer[i + j] = 0x00; // nop
        }
        foundCount++;
    }
}

if (foundCount > 0) {
    fs.writeFileSync('/var/www/lhc-node/ArchiveFix_Fixed.exe', buffer);
    console.log(`Patched ${foundCount} occurrences.`);
} else {
    console.log('Pattern not found.');
}
