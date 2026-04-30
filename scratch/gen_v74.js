const fs = require('fs');

const v72 = fs.readFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v72.js', 'utf8');

let v74 = v72.replace(/\[v72\]/g, '[v74]');

// ZLIB COMPRESSION + DYNAMIC OFFSET Support
const ultimateCode = `
function buildOpenRpf(originalBuf, adpcmData, fname) {
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
            const us = dh.readUInt32LE(eo + 8);
            const cs = dh[eo+2] | (dh[eo+3]<<8) | (dh[eo+4]<<16);
            const page = dh[eo+5] | (dh[eo+6]<<8) | (dh[eo+7]<<16);
            
            const origOff = page * PAGE_SIZE;
            const dataSize = cs > 0 ? cs : us;
            let fileData = Buffer.alloc(dataSize);
            originalBuf.copy(fileData, 0, origOff, origOff + dataSize);
            
            // 1. DECRYPT
            if (et === 0x0FFFFFF9) {
                const d = require('crypto').createDecipheriv('aes-256-ecb', Buffer.from([
                    0x22, 0x7E, 0x14, 0x2C, 0x45, 0x5F, 0x1F, 0x18, 0x2E, 0x3E, 0x19, 0x6D, 0x32, 0x36, 0x53, 0x28,
                    0x2D, 0x73, 0x3A, 0x01, 0x60, 0x14, 0x6E, 0x56, 0x31, 0x72, 0x08, 0x46, 0x3E, 0x31, 0x5D, 0x41
                ]), null);
                d.setAutoPadding(false);
                const dec = Buffer.concat([d.update(fileData.slice(0, Math.floor(fileData.length/16)*16)), d.final()]);
                fileData = fileData.length % 16 ? Buffer.concat([dec, fileData.slice(dec.length)]) : dec;
            }
            
            // 2. DECOMPRESS
            let awcRaw = fileData;
            if (cs > 0) {
                try {
                    awcRaw = require('zlib').inflateRawSync(fileData);
                } catch (e) {
                    console.error('[v74] Decompression failed for ' + name);
                }
            }
            
            // 3. PARSE AWC TOC DYNAMICALLY
            let dataOffset = 0;
            try {
                if (awcRaw.toString('utf8', 0, 4) === 'AWC ') {
                    const streamCount = awcRaw.readUInt32LE(8);
                    const tocOffset = awcRaw.readUInt32LE(12);
                    if (streamCount > 0) {
                        dataOffset = awcRaw.readUInt32LE(tocOffset + 4);
                    }
                }
            } catch (e) {}
            if (dataOffset === 0 || dataOffset >= awcRaw.length) dataOffset = 32;
            
            console.log('[v74] Patching ' + name + ' at offset ' + dataOffset + ' (Compressed: ' + (cs>0) + ')');
            
            // 4. PATCH
            let patchedAwc = Buffer.from(awcRaw);
            if (patchedAwc.length > dataOffset + adpcmData.length) {
                adpcmData.copy(patchedAwc, dataOffset);
            } else {
                adpcmData.copy(patchedAwc, dataOffset, 0, patchedAwc.length - dataOffset);
            }
            
            // 5. RE-COMPRESS
            let finalFileData = patchedAwc;
            if (cs > 0) {
                try {
                    finalFileData = require('zlib').deflateRawSync(patchedAwc, { level: 9 });
                    if (finalFileData.length > cs) finalFileData = finalFileData.slice(0, cs);
                    else if (finalFileData.length < cs) {
                        const padded = Buffer.alloc(cs, 0);
                        finalFileData.copy(padded);
                        finalFileData = padded;
                    }
                } catch (e) {}
            } else {
                if (finalFileData.length > us) finalFileData = finalFileData.slice(0, us);
                else if (finalFileData.length < us) {
                    const padded = Buffer.alloc(us, 0);
                    finalFileData.copy(padded);
                    finalFileData = padded;
                }
            }
            
            // 6. RE-ENCRYPT
            if (et === 0x0FFFFFF9) {
                const c = require('crypto').createCipheriv('aes-256-ecb', Buffer.from([
                    0x22, 0x7E, 0x14, 0x2C, 0x45, 0x5F, 0x1F, 0x18, 0x2E, 0x3E, 0x19, 0x6D, 0x32, 0x36, 0x53, 0x28,
                    0x2D, 0x73, 0x3A, 0x01, 0x60, 0x14, 0x6E, 0x56, 0x31, 0x72, 0x08, 0x46, 0x3E, 0x31, 0x5D, 0x41
                ]), null);
                c.setAutoPadding(false);
                const enc = Buffer.concat([c.update(finalFileData.slice(0, Math.floor(finalFileData.length/16)*16)), c.final()]);
                finalFileData = finalFileData.length % 16 ? Buffer.concat([enc, finalFileData.slice(enc.length)]) : enc;
            }
            
            finalFileData.copy(result, page * PAGE_SIZE);
            patchCount++;
        }
    }
    return result;
}
`;

v74 = v74.replace(/function buildOpenRpf[\s\S]+?\n}/, ultimateCode);

fs.writeFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v74.js', v74);
console.log('v74 generated.');
