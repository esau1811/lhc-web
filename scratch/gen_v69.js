const fs = require('fs');

const v68 = fs.readFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v68.js', 'utf8');

let v69 = v68.replace(/\[v68\]/g, '[v69]');

// AGGRESSIVE SURGICAL PATCH
const aggressiveCode = `
function buildOpenRpf(originalBuf, pcm, fname) {
    const et = originalBuf.readUInt32LE(12);
    const ec = originalBuf.readUInt32LE(4);
    const nl = originalBuf.readUInt32LE(8);
    
    const dh = decryptHeader(originalBuf, et, fname);
    if (!dh) throw new Error('Header decrypt failed');
    
    const nts = ec * 16;
    const PAGE_SIZE = 512;
    
    let result = Buffer.from(originalBuf);
    let patchCount = 0;
    
    for (let i = 0; i < ec; i++) {
        const eo = i * 16;
        const type = dh.readUInt32LE(eo + 4);
        if (type === 0x7FFFFF00) continue; // Dir
        
        const nameOff = dh.readUInt16LE(eo);
        let name = '', p = nts + nameOff;
        while (p < nts + nl && dh[p] !== 0) name += String.fromCharCode(dh[p++]);
        
        if (name.toLowerCase().endsWith('.awc')) {
            console.log('[v69] Aggressively patching: ' + name);
            const us = dh.readUInt32LE(eo + 8);
            const page = dh[eo+5] | (dh[eo+6]<<8) | (dh[eo+7]<<16);
            
            let awcData = buildMinimalAwc(pcm);
            
            // Match size
            if (awcData.length > us) {
                awcData = awcData.slice(0, us);
            } else if (awcData.length < us) {
                const padded = Buffer.alloc(us, 0);
                awcData.copy(padded);
                awcData = padded;
            }
            
            let finalData = awcData;
            if (et === 0x0FFFFFF9) {
                const c = require('crypto').createCipheriv('aes-256-ecb', Buffer.from([
                    0x22, 0x7E, 0x14, 0x2C, 0x45, 0x5F, 0x1F, 0x18, 0x2E, 0x3E, 0x19, 0x6D, 0x32, 0x36, 0x53, 0x28,
                    0x2D, 0x73, 0x3A, 0x01, 0x60, 0x14, 0x6E, 0x56, 0x31, 0x72, 0x08, 0x46, 0x3E, 0x31, 0x5D, 0x41
                ]), null);
                c.setAutoPadding(false);
                const enc = Buffer.concat([c.update(finalData.slice(0, Math.floor(finalData.length/16)*16)), c.final()]);
                finalData = finalData.length % 16 ? Buffer.concat([enc, finalData.slice(enc.length)]) : enc;
            }
            
            finalData.copy(result, page * PAGE_SIZE);
            patchCount++;
        }
    }
    
    console.log('[v69] Total patched AWCs: ' + patchCount);
    if (patchCount === 0) throw new Error('No .awc found');
    return result;
}
`;

v69 = v69.replace(/function buildOpenRpf[\s\S]+?\n}/, aggressiveCode);

// Improved buildMinimalAwc to be more "AWC-like"
const improvedAwcCode = `
function buildMinimalAwc(pcm) {
    // AWC Header: Magic, Version, Streams, TOC_Offset
    const header = Buffer.alloc(16, 0);
    header.write('AWC ', 0);
    header.writeUInt32LE(0x01, 4); // Version 1
    header.writeUInt32LE(1, 8); // 1 Stream
    header.writeUInt32LE(16, 12); // TOC starts immediately
    
    // TOC Entry: Hash, Offset, Size
    const toc = Buffer.alloc(12, 0);
    toc.writeUInt32LE(0x12345678, 0); // Dummy Hash
    toc.writeUInt32LE(28, 4); // Data starts at 28
    toc.writeUInt32LE(pcm.length, 8);
    
    return Buffer.concat([header, toc, pcm]);
}
`;

v69 = v69.replace(/function buildMinimalAwc[\s\S]+?\n}/, improvedAwcCode);

fs.writeFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v69.js', v69);
console.log('vps_server_v69.js generated.');
