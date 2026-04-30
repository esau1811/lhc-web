const fs = require('fs');

const v63 = fs.readFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v63.js', 'utf8');

let v64 = v63.replace(/\[v63\]/g, '[v64]');

// Key fix for buildOpenRpf: Decrypt every file copied from original
const decryptFileCode = `
                // DECRYPT ORIGINAL DATA
                let finalData = Buffer.alloc(dataSize);
                originalBuf.copy(finalData, 0, origOff, origOff + dataSize);
                
                if (et === ENC_AES) {
                    const d = crypto.createDecipheriv('aes-256-ecb', GTA5_AES_KEY, null);
                    d.setAutoPadding(false);
                    const dec = Buffer.concat([d.update(finalData.slice(0, Math.floor(finalData.length/16)*16)), d.final()]);
                    finalData = finalData.length % 16 ? Buffer.concat([dec, finalData.slice(dec.length)]) : dec;
                }
                
                const origData = Buffer.alloc(paddedLen, 0);
                finalData.copy(origData);
`;

v64 = v64.replace('const origData = Buffer.alloc(paddedLen, 0);\n                originalBuf.copy(origData, 0, origOff, origOff + dataSize);', decryptFileCode);

// Also fix the RPF_MAGIC check in buildOpenRpf (it might be "RPF7")
v64 = v64.replace('RPF_MAGIC.copy(result, 0);', 'Buffer.from([0x52, 0x50, 0x46, 0x37]).copy(result, 0); // "RPF7"');

fs.writeFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v64.js', v64);
console.log('vps_server_v64.js generated.');
