const fs = require('fs');
const zlib = require('zlib');

const data = fs.readFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\arma\\MKII_LEOPARDO_LHC.rpf');
const offset = 0xc00 + 16;
const compressed = data.slice(offset, 0x2f000);

try {
    const uncompressed = zlib.inflateRawSync(compressed);
    console.log('Uncompressed size:', uncompressed.length);
    
    // Search for the hash
    const hash1 = Buffer.from([0x6f, 0xa2, 0x4f, 0x3b]); // pistolmk2
    const hash2 = Buffer.from([0x3c, 0x6a, 0x00, 0xbd]); // vintage
    
    let count = 0;
    let idx = 0;
    while ((idx = uncompressed.indexOf(hash1, idx)) !== -1) {
        hash2.copy(uncompressed, idx);
        count++;
        idx += 4;
    }
    
    console.log(`Replaced ${count} hashes.`);
    
    // Recompress
    const recompressed = zlib.deflateRawSync(uncompressed, { level: 9 });
    console.log(`Original compressed size: ${compressed.length}`);
    console.log(`New compressed size: ${recompressed.length}`);
    console.log(`Difference: ${recompressed.length - compressed.length} bytes`);
    
} catch (e) {
    console.error('Failed:', e);
}
