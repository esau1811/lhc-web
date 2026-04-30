const fs = require('fs');
const crypto = require('crypto');

const KEYS_DIR = '/opt/lhc-keys';

function gta5Hash(text) {
    const lut = fs.readFileSync(`${KEYS_DIR}/gtav_hash_lut.dat`);
    let result = 0;
    for (let i = 0; i < text.length; i++) {
        const c = lut[text.charCodeAt(i) & 0xFF];
        result = ((Math.imul(1025, (c + result) >>> 0) >>> 0) >>> 6 ^ Math.imul(1025, (c + result) >>> 0) >>> 0) >>> 0;
    }
    const r9 = Math.imul(9, result) >>> 0;
    return Math.imul(32769, ((r9 >>> 11) ^ r9) >>> 0) >>> 0;
}

function ngDecryptBlock(block, keyBuf, tables) {
    const sk = []; for (let i = 0; i < 17; i++) sk.push([keyBuf.readUInt32LE(i*16), keyBuf.readUInt32LE(i*16+4), keyBuf.readUInt32LE(i*16+8), keyBuf.readUInt32LE(i*16+12)]);
    const rdA = (d,s,t) => { const r=Buffer.allocUnsafe(16); r.writeUInt32LE((t[0][d[0]]^t[1][d[1]]^t[2][d[2]]^t[3][d[3]]^s[0])>>>0,0); r.writeUInt32LE((t[4][d[4]]^t[5][d[5]]^t[6][d[6]]^t[7][d[7]]^s[1])>>>0,4); r.writeUInt32LE((t[8][d[8]]^t[9][d[9]]^t[10][d[10]]^t[11][d[11]]^s[2])>>>0,8); r.writeUInt32LE((t[12][d[12]]^t[13][d[13]]^t[14][d[14]]^t[15][d[15]]^s[3])>>>0,12); return r; };
    const rdB = (d,s,t) => { const r=Buffer.allocUnsafe(16); r.writeUInt32LE((t[0][d[0]]^t[7][d[7]]^t[10][d[10]]^t[13][d[13]]^s[0])>>>0,0); r.writeUInt32LE((t[1][d[1]]^t[4][d[4]]^t[11][d[11]]^t[14][d[14]]^s[1])>>>0,4); r.writeUInt32LE((t[2][d[2]]^t[5][d[5]]^t[8][d[8]]^t[15][d[15]]^s[2])>>>0,8); r.writeUInt32LE((t[3][d[3]]^t[6][d[6]]^t[9][d[9]]^t[12][d[12]]^s[3])>>>0,12); return r; };
    let b = block;
    b = rdA(b, sk[0], tables[0]); b = rdA(b, sk[1], tables[1]);
    for (let k = 2; k <= 15; k++) b = rdB(b, sk[k], tables[k]);
    return rdA(b, sk[16], tables[16]);
}

function ngDecrypt(data, keyBuf, tables) {
    const out = Buffer.from(data);
    for (let i = 0; i < Math.floor(data.length / 16); i++) ngDecryptBlock(data.slice(i*16, i*16+16), keyBuf, tables).copy(out, i*16);
    return out;
}

async function main() {
    const ngKeyRaw = fs.readFileSync(`${KEYS_DIR}/gtav_ng_key.dat`);
    const ngKeys = []; for (let i = 0; i < 101; i++) ngKeys.push(ngKeyRaw.slice(i * 272, (i + 1) * 272));
    const ngTabRaw = fs.readFileSync(`${KEYS_DIR}/gtav_ng_decrypt_tables.dat`);
    const tables = []; let off = 0;
    for (let r = 0; r < 17; r++) {
        tables[r] = [];
        for (let t = 0; t < 16; t++) {
            const table = new Uint32Array(256);
            for (let e = 0; e < 256; e++) { table[e] = ngTabRaw.readUInt32LE(off); off += 4; }
            tables[r].push(table);
        }
    }

    // List all rpf files in /var/www/lhc-node to find the one uploaded
    const files = fs.readdirSync('/var/www/lhc-node');
    const rpfFile = files.find(f => f.toLowerCase().endsWith('.rpf'));
    if (!rpfFile) throw new Error('No RPF file found in /var/www/lhc-node');
    
    console.log(`Checking RPF: ${rpfFile}`);
    const rpfBuf = fs.readFileSync(`/var/www/lhc-node/${rpfFile}`);
    const entryCount = rpfBuf.readUInt32LE(4);
    const namesLength = rpfBuf.readUInt32LE(8);
    const headerLen = entryCount * 16 + namesLength;
    
    const idx = ((gta5Hash(rpfFile.toLowerCase()) + rpfBuf.length + 61) >>> 0) % 101;
    const headerDec = ngDecrypt(rpfBuf.slice(16, 16 + headerLen), ngKeys[idx], tables);
    
    const nameTableStart = entryCount * 16;
    for (let i = 0; i < 5; i++) {
        const eOff = i * 16;
        const nameOff = headerDec.readUInt16LE(eOff);
        let name = ''; let p = nameTableStart + nameOff;
        while (p < nameTableStart + namesLength && headerDec[p] !== 0) name += String.fromCharCode(headerDec[p++]);
        
        console.log(`Entry ${i}: ${name}`);
        const size24 = headerDec[eOff+2] | (headerDec[eOff+3]<<8) | (headerDec[eOff+4]<<16);
        const page24 = headerDec[eOff+5] | (headerDec[eOff+6]<<8) | (headerDec[eOff+7]<<16);
        const val8_11 = headerDec.readUInt32LE(eOff + 8);
        
        console.log(`  Size24: ${size24}, Page24: ${page24}, val8-11: ${val8_11}`);
        
        if (name.endsWith('.awc')) {
            const offset = page24 * 512;
            const raw = rpfBuf.slice(offset, offset + 16);
            console.log(`  RAW hex: ${raw.toString('hex')}`);
            // Try decrypting with size24 and val8_11
            for (let s of [size24, val8_11]) {
                const kIdx = ((gta5Hash(name.toLowerCase()) + s + 61) >>> 0) % 101;
                const data = ngDecrypt(raw, ngKeys[kIdx], tables);
                console.log(`  Decrypted (s=${s}): ${data.slice(0, 4).toString('hex')} (${data.slice(0, 4).toString('utf8')})`);
            }
        }
    }
}

main().catch(console.error);
