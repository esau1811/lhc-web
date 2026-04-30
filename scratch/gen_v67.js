const fs = require('fs');

const v66 = fs.readFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v66.js', 'utf8');

let v67 = v66.replace(/\[v66\]/g, '[v67]');

// FULL DECRYPTOR Logic for buildOpenRpf
const fullDecryptCode = `
function buildOpenRpf(originalBuf, pcm, fname) {
    const et = originalBuf.readUInt32LE(12);
    const ec = originalBuf.readUInt32LE(4);
    const nl = originalBuf.readUInt32LE(8);
    
    const dh = decryptHeader(originalBuf, et, fname);
    if (!dh) throw new Error('Header decrypt failed');
    
    const nts = ec * 16;
    const PAGE_SIZE = 512;
    
    const dataBlocks = [];
    const newDh = Buffer.from(dh);
    
    // Header pages
    let currentPage = Math.ceil((16 + nts + nl) / PAGE_SIZE);
    
    for (let i = 0; i < ec; i++) {
        const eo = i * 16;
        const type = dh.readUInt32LE(eo + 4);
        if (type === 0x7FFFFF00) continue; // Dir
        
        const nameOff = dh.readUInt16LE(eo);
        let name = '', p = nts + nameOff;
        while (p < nts + nl && dh[p] !== 0) name += String.fromCharCode(dh[p++]);
        
        const isTargetAwc = name.toLowerCase().endsWith('.awc');
        const us = dh.readUInt32LE(eo + 8);
        const cs = dh[eo+2] | (dh[eo+3]<<8) | (dh[eo+4]<<16);
        const page = dh[eo+5] | (dh[eo+6]<<8) | (dh[eo+7]<<16);
        
        let fileData;
        if (isTargetAwc) {
            fileData = buildMinimalAwc(pcm);
        } else if (page > 0 && us > 0) {
            const dataSize = cs > 0 ? cs : us;
            const origOff = page * PAGE_SIZE;
            fileData = Buffer.alloc(dataSize);
            originalBuf.copy(fileData, 0, origOff, origOff + dataSize);
            
            // DECRYPT if necessary
            if (et === ENC_AES) {
                const d = crypto.createDecipheriv('aes-256-ecb', GTA5_AES_KEY, null);
                d.setAutoPadding(false);
                const dec = Buffer.concat([d.update(fileData.slice(0, Math.floor(fileData.length/16)*16)), d.final()]);
                fileData = fileData.length % 16 ? Buffer.concat([dec, fileData.slice(dec.length)]) : dec;
            }
        } else {
            continue;
        }
        
        const paddedLen = Math.ceil(fileData.length / PAGE_SIZE) * PAGE_SIZE;
        const paddedData = Buffer.alloc(paddedLen, 0);
        fileData.copy(paddedData);
        
        dataBlocks.push({ page: currentPage, data: paddedData });
        
        // Update TOC entry for the new RPF
        newDh[eo + 2] = 0; newDh[eo + 3] = 0; newDh[eo + 4] = 0; // cs = 0
        newDh[eo + 5] = currentPage & 0xFF;
        newDh[eo + 6] = (currentPage >> 8) & 0xFF;
        newDh[eo + 7] = (currentPage >> 16) & 0xFF;
        newDh.writeUInt32LE(fileData.length, eo + 8); // us
        newDh.writeUInt32LE(0, eo + 12); // EncryptionType = 0
        
        currentPage += paddedLen / PAGE_SIZE;
    }
    
    const result = Buffer.alloc(currentPage * PAGE_SIZE, 0);
    Buffer.from([0x52, 0x50, 0x46, 0x37]).copy(result, 0);
    result.writeUInt32LE(ec, 4);
    result.writeUInt32LE(nl, 8);
    result.writeUInt32LE(0, 12); // GLOBAL OPEN
    
    newDh.copy(result, 16);
    for (const b of dataBlocks) b.data.copy(result, b.page * PAGE_SIZE);
    
    return result;
}
`;

v67 = v67.replace(/function buildOpenRpf[\s\S]+?\n}/, fullDecryptCode);

fs.writeFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v67.js', v67);
console.log('vps_server_v67.js generated.');
