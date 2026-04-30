const fs = require('fs');

const v65 = fs.readFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v65.js', 'utf8');

let v66 = v65.replace(/\[v65\]/g, '[v66]');

// Fix: Ensure global encryption type is set to OPEN (0) before ArchiveFix
const headerFix = `
    finalDh.copy(result, 16);
    
    // Set magic to RPF7 and encryption to NONE (0)
    Buffer.from([0x52, 0x50, 0x46, 0x37]).copy(result, 0);
    result.writeUInt32LE(0, 12); // GLOBAL ENCRYPTION = NONE (OPEN)
    
    return result;
}
`;

v66 = v66.replace('finalDh.copy(result, 16);\n    \n    // Set magic to RPF7 if it was changed\n    Buffer.from([0x52, 0x50, 0x46, 0x37]).copy(result, 0);\n    \n    return result;\n}', headerFix);

// Also, let's fix the TOC encryption. If we set GLOBAL to 0, the TOC MUST be decrypted.
v66 = v66.replace('let finalDh = newDh;\n    if (et === ENC_AES) {', 'let finalDh = newDh;\n    if (false && et === ENC_AES) { // FORCE DECRYPTED TOC');

fs.writeFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v66.js', v66);
console.log('vps_server_v66.js generated.');
