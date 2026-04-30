const fs = require('fs');

const v69 = fs.readFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v69.js', 'utf8');

let v70 = v69.replace(/\[v69\]/g, '[v70]');

// BEEP GENERATOR and LOGGING
const beepCode = `
function buildOpenRpf(originalBuf, pcm, fname) {
    const et = originalBuf.readUInt32LE(12);
    const ec = originalBuf.readUInt32LE(4);
    const nl = originalBuf.readUInt32LE(8);
    
    const dh = decryptHeader(originalBuf, et, fname);
    if (!dh) throw new Error('Header decrypt failed');
    
    const nts = ec * 16;
    const PAGE_SIZE = 512;
    
    // GENERATE BEEP PCM (1000Hz sine wave, 1 sec, 32000Hz)
    const beepPcm = Buffer.alloc(64000); // 1 sec of 16-bit PCM
    for (let i = 0; i < 32000; i++) {
        const v = Math.sin(2 * Math.PI * 1000 * i / 32000) * 32767;
        beepPcm.writeInt16LE(v, i * 2);
    }
    
    let result = Buffer.from(originalBuf);
    let patchCount = 0;
    const allNames = [];
    
    for (let i = 0; i < ec; i++) {
        const eo = i * 16;
        const type = dh.readUInt32LE(eo + 4);
        if (type === 0x7FFFFF00) continue; // Dir
        
        const nameOff = dh.readUInt16LE(eo);
        let name = '', p = nts + nameOff;
        while (p < nts + nl && dh[p] !== 0) name += String.fromCharCode(dh[p++]);
        allNames.push(name);
        
        if (name.toLowerCase().endsWith('.awc')) {
            const us = dh.readUInt32LE(eo + 8);
            const page = dh[eo+5] | (dh[eo+6]<<8) | (dh[eo+7]<<16);
            
            let awcData = buildMinimalAwc(beepPcm);
            
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
    
    console.log('[v70] RPF Files: ' + allNames.join(', '));
    console.log('[v70] Total patched AWCs: ' + patchCount);
    if (patchCount === 0) throw new Error('No .awc found');
    return result;
}
`;

v70 = v70.replace(/function buildOpenRpf[\s\S]+?\n}/, beepCode);

fs.writeFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v70.js', v70);
console.log('vps_server_v70.js generated.');
