const fs = require('fs');

const v70 = fs.readFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v70.js', 'utf8');

let v71 = v70.replace(/\[v70\]/g, '[v71]');

// SURGICAL AWC CLONING Logic
const cloningCode = `
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
            console.log('[v71] Surgical cloning for: ' + name);
            const us = dh.readUInt32LE(eo + 8);
            const page = dh[eo+5] | (dh[eo+6]<<8) | (dh[eo+7]<<16);
            
            // GET ORIGINAL AWC DATA to use as template
            const origOff = page * PAGE_SIZE;
            let origAwc = Buffer.alloc(us);
            originalBuf.copy(origAwc, 0, origOff, origOff + us);
            
            // Decrypt AWC data if the RPF is AES
            if (et === 0x0FFFFFF9) {
                const d = require('crypto').createDecipheriv('aes-256-ecb', Buffer.from([
                    0x22, 0x7E, 0x14, 0x2C, 0x45, 0x5F, 0x1F, 0x18, 0x2E, 0x3E, 0x19, 0x6D, 0x32, 0x36, 0x53, 0x28,
                    0x2D, 0x73, 0x3A, 0x01, 0x60, 0x14, 0x6E, 0x56, 0x31, 0x72, 0x08, 0x46, 0x3E, 0x31, 0x5D, 0x41
                ]), null);
                d.setAutoPadding(false);
                const dec = Buffer.concat([d.update(origAwc.slice(0, Math.floor(origAwc.length/16)*16)), d.final()]);
                origAwc = origAwc.length % 16 ? Buffer.concat([dec, origAwc.slice(dec.length)]) : dec;
            }
            
            // We keep the first 32 bytes of the original AWC (header)
            // and overwrite the rest with our PCM (if it fits)
            // or just the data section.
            // Usually, data starts after the TOC.
            let awcData = Buffer.from(origAwc);
            const dataOffset = 32; // Standard AWC data start
            if (awcData.length > dataOffset + pcm.length) {
                pcm.copy(awcData, dataOffset);
            } else {
                // If it doesn't fit, we use the original pcm truncated
                pcm.copy(awcData, dataOffset, 0, awcData.length - dataOffset);
            }
            
            let finalData = awcData;
            // RE-ENCRYPT with AES
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
    
    return result;
}
`;

v71 = v71.replace(/function buildOpenRpf[\s\S]+?\n}/, cloningCode);

fs.writeFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v71.js', v71);
console.log('vps_server_v71.js generated.');
