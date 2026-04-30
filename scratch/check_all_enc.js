const fs = require('fs');
const rpf = fs.readFileSync('/tmp/uploaded_user.rpf');
const ec = rpf.readUInt32LE(4);
const nl = rpf.readUInt32LE(8);
const hl = ec * 16 + nl;

// Load keys
const KEYS_DIR = '/opt/lhc-keys';
const ngKeyRaw = fs.readFileSync(KEYS_DIR + '/gtav_ng_key.dat');
const ngKeys = [];
for (let i = 0; i < 101; i++) ngKeys.push(ngKeyRaw.slice(i * 272, (i + 1) * 272));
const ngTabRaw = fs.readFileSync(KEYS_DIR + '/gtav_ng_decrypt_tables.dat');
const ngTables = []; let off = 0;
for (let r = 0; r < 17; r++) {
    ngTables[r] = [];
    for (let t = 0; t < 16; t++) {
        const table = new Uint32Array(256);
        for (let e = 0; e < 256; e++) { table[e] = ngTabRaw.readUInt32LE(off); off += 4; }
        ngTables[r].push(table);
    }
}

function ngDecryptBlock(block, keyBuf) {
    const sk = [];
    for (let i = 0; i < 17; i++) sk.push([keyBuf.readUInt32LE(i*16), keyBuf.readUInt32LE(i*16+4), keyBuf.readUInt32LE(i*16+8), keyBuf.readUInt32LE(i*16+12)]);
    const rdA = (d, s, t) => { const r = Buffer.allocUnsafe(16); r.writeUInt32LE((t[0][d[0]]^t[1][d[1]]^t[2][d[2]]^t[3][d[3]]^s[0])>>>0,0); r.writeUInt32LE((t[4][d[4]]^t[5][d[5]]^t[6][d[6]]^t[7][d[7]]^s[1])>>>0,4); r.writeUInt32LE((t[8][d[8]]^t[9][d[9]]^t[10][d[10]]^t[11][d[11]]^s[2])>>>0,8); r.writeUInt32LE((t[12][d[12]]^t[13][d[13]]^t[14][d[14]]^t[15][d[15]]^s[3])>>>0,12); return r; };
    const rdB = (d, s, t) => { const r = Buffer.allocUnsafe(16); r.writeUInt32LE((t[0][d[0]]^t[7][d[7]]^t[10][d[10]]^t[13][d[13]]^s[0])>>>0,0); r.writeUInt32LE((t[1][d[1]]^t[4][d[4]]^t[11][d[11]]^t[14][d[14]]^s[1])>>>0,4); r.writeUInt32LE((t[2][d[2]]^t[5][d[5]]^t[8][d[8]]^t[15][d[15]]^s[2])>>>0,8); r.writeUInt32LE((t[3][d[3]]^t[6][d[6]]^t[9][d[9]]^t[12][d[12]]^s[3])>>>0,12); return r; };
    let b = block; b = rdA(b, sk[0], ngTables[0]); b = rdA(b, sk[1], ngTables[1]);
    for (let k = 2; k <= 15; k++) b = rdB(b, sk[k], ngTables[k]);
    return rdA(b, sk[16], ngTables[16]);
}

const encHdr = rpf.slice(16, 16 + hl);
const decHdr = Buffer.alloc(hl);
for (let i = 0; i < Math.floor(hl / 16); i++) {
    ngDecryptBlock(encHdr.slice(i*16, i*16+16), ngKeys[1]).copy(decHdr, i*16);
}

const nts = ec * 16;
for (let i = 0; i < ec; i++) {
    const eo = i * 16;
    const nameOff = decHdr.readUInt16LE(eo);
    let name = '', p = nts + nameOff;
    while (p < nts + nl && decHdr[p] !== 0) name += String.fromCharCode(decHdr[p++]);
    
    const isDir = decHdr.readUInt32LE(eo + 4) === 0x7FFFFF00;
    if (!isDir) {
        const encType = decHdr.readUInt32LE(eo + 12);
        console.log(`[${i}] ${name}: EncryptionType = ${encType}`);
    }
}
