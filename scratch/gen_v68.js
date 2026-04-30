const fs = require('fs');

const v67 = fs.readFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v67.js', 'utf8');

let v68 = v67.replace(/\[v67\]/g, '[v68]');

// SURGICAL OVERWRITE Logic
const surgicalCode = `
function buildOpenRpf(originalBuf, pcm, fname) {
    const et = originalBuf.readUInt32LE(12);
    const ec = originalBuf.readUInt32LE(4);
    const nl = originalBuf.readUInt32LE(8);
    
    const dh = decryptHeader(originalBuf, et, fname);
    if (!dh) throw new Error('Header decrypt failed');
    
    const nts = ec * 16;
    const PAGE_SIZE = 512;
    
    let result = Buffer.from(originalBuf);
    let patched = false;
    
    for (let i = 0; i < ec; i++) {
        const eo = i * 16;
        const type = dh.readUInt32LE(eo + 4);
        if (type === 0x7FFFFF00) continue; // Dir
        
        const nameOff = dh.readUInt16LE(eo);
        let name = '', p = nts + nameOff;
        while (p < nts + nl && dh[p] !== 0) name += String.fromCharCode(dh[p++]);
        
        if (name.toLowerCase().endsWith('.awc')) {
            console.log('[v68] Surgically patching AWC: ' + name);
            const us = dh.readUInt32LE(eo + 8);
            const page = dh[eo+5] | (dh[eo+6]<<8) | (dh[eo+7]<<16);
            
            let awcData = buildMinimalAwc(pcm);
            
            if (awcData.length > us) {
                awcData = awcData.slice(0, us);
            } else if (awcData.length < us) {
                const padded = Buffer.alloc(us, 0);
                awcData.copy(padded);
                awcData = padded;
            }
            
            let finalData = awcData;
            if (et === 0x0FFFFFF9) { // ENC_AES
                const c = require('crypto').createCipheriv('aes-256-ecb', Buffer.from([
                    0x22, 0x7E, 0x14, 0x2C, 0x45, 0x5F, 0x1F, 0x18, 0x2E, 0x3E, 0x19, 0x6D, 0x32, 0x36, 0x53, 0x28,
                    0x2D, 0x73, 0x3A, 0x01, 0x60, 0x14, 0x6E, 0x56, 0x31, 0x72, 0x08, 0x46, 0x3E, 0x31, 0x5D, 0x41
                ]), null);
                c.setAutoPadding(false);
                const enc = Buffer.concat([c.update(finalData.slice(0, Math.floor(finalData.length/16)*16)), c.final()]);
                finalData = finalData.length % 16 ? Buffer.concat([enc, finalData.slice(enc.length)]) : enc;
            }
            
            finalData.copy(result, page * PAGE_SIZE);
            patched = true;
            break;
        }
    }
    
    if (!patched) throw new Error('No .awc found to patch');
    return result;
}
`;

v68 = v68.replace(/function buildOpenRpf[\s\S]+?\n}/, surgicalCode);

// FIX: Correctly comment out or remove the ArchiveFix block to avoid SyntaxError
v68 = v68.replace(/try\s*{\s+const out = execSync[\s\S]+?}\s+catch\s*\(err\)\s*{\s+console\.error[\s\S]+?}/, '// ArchiveFix skipped for surgical patch');

fs.writeFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v68.js', v68);
console.log('vps_server_v68.js generated.');
