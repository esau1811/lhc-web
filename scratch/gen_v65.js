const fs = require('fs');

const v64 = fs.readFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v64.js', 'utf8');

let v65 = v64.replace(/\[v64\]/g, '[v65]');

// REPLACE buildOpenRpf with a PATCHING logic
const patchRpfCode = `
function buildOpenRpf(originalBuf, pcm, fname) {
    const et = originalBuf.readUInt32LE(12);
    const ec = originalBuf.readUInt32LE(4);
    const nl = originalBuf.readUInt32LE(8);
    
    const dh = decryptHeader(originalBuf, et, fname);
    if (!dh) throw new Error('Header decrypt failed');
    
    const nts = ec * 16;
    const PAGE_SIZE = 512;
    
    // We will create a copy of the original buffer to patch it
    // If the new AWC is larger, we'll append it to the end
    let result = Buffer.from(originalBuf);
    const newDh = Buffer.from(dh);
    
    let patched = false;
    const targetAwcName = 'weapon_pistol_mk2_shot.awc'; // Target for weapon sound
    // Actually, we should probably look for ANY .awc if we don't know the exact name
    // or use the one from the user's upload?
    // Let's look for all entries.
    
    for (let i = 0; i < ec; i++) {
        const eo = i * 16;
        const type = dh.readUInt32LE(eo + 4);
        if (type === 0x7FFFFF00) continue; // Dir
        
        const nameOff = dh.readUInt16LE(eo);
        let name = '', p = nts + nameOff;
        while (p < nts + nl && dh[p] !== 0) name += String.fromCharCode(dh[p++]);
        
        if (name.toLowerCase().endsWith('.awc')) {
            console.log('[v65] Found AWC entry: ' + name);
            const awcData = buildMinimalAwc(pcm);
            
            // For now, let's just append the new AWC to the end of the RPF
            // and update this entry to point to it.
            const startPage = Math.ceil(result.length / PAGE_SIZE);
            const paddedLen = Math.ceil(awcData.length / PAGE_SIZE) * PAGE_SIZE;
            const paddedData = Buffer.alloc(paddedLen, 0);
            awcData.copy(paddedData);
            
            result = Buffer.concat([result, paddedData]);
            
            // Update TOC entry
            newDh[eo + 2] = 0; newDh[eo + 3] = 0; newDh[eo + 4] = 0; // cs = 0 (uncompressed)
            newDh[eo + 5] = startPage & 0xFF;
            newDh[eo + 6] = (startPage >> 8) & 0xFF;
            newDh[eo + 7] = (startPage >> 16) & 0xFF;
            newDh.writeUInt32LE(awcData.length, eo + 8); // us
            newDh.writeUInt32LE(0, eo + 12); // EncryptionType = 0 (NONE)
            
            patched = true;
            // We patch ALL AWCs for now to be safe, or just the first one?
            // Usually there is only one relevant AWC in these small RPFs
        }
    }
    
    if (!patched) throw new Error('No .awc file found in RPF to replace');
    
    // Re-encrypt the TOC if the original was encrypted
    let finalDh = newDh;
    if (et === ENC_AES) {
        const d = crypto.createCipheriv('aes-256-ecb', GTA5_AES_KEY, null);
        d.setAutoPadding(false);
        finalDh = Buffer.concat([d.update(newDh.slice(0, Math.floor(newDh.length/16)*16)), d.final()]);
        if (newDh.length % 16) finalDh = Buffer.concat([finalDh, newDh.slice(finalDh.length)]);
    }
    
    finalDh.copy(result, 16);
    
    // Set magic to RPF7 if it was changed
    Buffer.from([0x52, 0x50, 0x46, 0x37]).copy(result, 0);
    
    return result;
}
`;

v65 = v65.replace(/function buildOpenRpf[\s\S]+?\n}/, patchRpfCode);

fs.writeFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v65.js', v65);
console.log('vps_server_v65.js generated.');
