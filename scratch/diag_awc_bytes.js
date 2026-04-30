const fs = require('fs');
const b = fs.readFileSync('/tmp/uploaded_user.rpf');
// lmg_combat.awc is at page 2 (page 2 * 512 = offset 1024)
// but we need to NG-decrypt it first
const crypto = require('crypto');
const KEYS_DIR = '/opt/lhc-keys';
const ngKeyRaw = fs.readFileSync(KEYS_DIR + '/gtav_ng_key.dat');
const GTA5_NG_KEYS = [];
for (let i = 0; i < 101; i++) GTA5_NG_KEYS.push(ngKeyRaw.slice(i * 272, (i + 1) * 272));
const ngTabRaw = fs.readFileSync(KEYS_DIR + '/gtav_ng_decrypt_tables.dat');
const GTA5_NG_TABLES = [];
let off = 0;
for (let r = 0; r < 17; r++) {
    GTA5_NG_TABLES[r] = [];
    for (let t = 0; t < 16; t++) {
        const table = new Uint32Array(256);
        for (let e = 0; e < 256; e++) { table[e] = ngTabRaw.readUInt32LE(off); off += 4; }
        GTA5_NG_TABLES[r].push(table);
    }
}

function ngDecryptBlock(block, keyBuf) {
    const sk = [];
    for (let i = 0; i < 17; i++) sk.push([keyBuf.readUInt32LE(i*16), keyBuf.readUInt32LE(i*16+4), keyBuf.readUInt32LE(i*16+8), keyBuf.readUInt32LE(i*16+12)]);
    const rdA = (d, s, t) => {
        const r = Buffer.allocUnsafe(16);
        r.writeUInt32LE((t[0][d[0]]^t[1][d[1]]^t[2][d[2]]^t[3][d[3]]^s[0])>>>0, 0);
        r.writeUInt32LE((t[4][d[4]]^t[5][d[5]]^t[6][d[6]]^t[7][d[7]]^s[1])>>>0, 4);
        r.writeUInt32LE((t[8][d[8]]^t[9][d[9]]^t[10][d[10]]^t[11][d[11]]^s[2])>>>0, 8);
        r.writeUInt32LE((t[12][d[12]]^t[13][d[13]]^t[14][d[14]]^t[15][d[15]]^s[3])>>>0, 12);
        return r;
    };
    const rdB = (d, s, t) => {
        const r = Buffer.allocUnsafe(16);
        r.writeUInt32LE((t[0][d[0]]^t[7][d[7]]^t[10][d[10]]^t[13][d[13]]^s[0])>>>0, 0);
        r.writeUInt32LE((t[1][d[1]]^t[4][d[4]]^t[11][d[11]]^t[14][d[14]]^s[1])>>>0, 4);
        r.writeUInt32LE((t[2][d[2]]^t[5][d[5]]^t[8][d[8]]^t[15][d[15]]^s[2])>>>0, 8);
        r.writeUInt32LE((t[3][d[3]]^t[6][d[6]]^t[9][d[9]]^t[12][d[12]]^s[3])>>>0, 12);
        return r;
    };
    let blk = block;
    blk = rdA(blk, sk[0], GTA5_NG_TABLES[0]);
    blk = rdA(blk, sk[1], GTA5_NG_TABLES[1]);
    for (let k = 2; k <= 15; k++) blk = rdB(blk, sk[k], GTA5_NG_TABLES[k]);
    return rdA(blk, sk[16], GTA5_NG_TABLES[16]);
}

// lmg_combat.awc: page=2, us=55496 -- let's read first 128 bytes and decrypt
const PAGE_SIZE = 512;
const awcPage = 2;
const awcSize = 55496;
const awcOff = awcPage * PAGE_SIZE;
const rawAwc = b.slice(awcOff, awcOff + Math.min(awcSize, 512));

// NG decrypt the first 512 bytes (block by block)
const KEY = GTA5_NG_KEYS[1]; // Key index 1 found from diagnostic
const decAwc = Buffer.from(rawAwc);
for (let blk = 0; blk < Math.floor(rawAwc.length / 16); blk++) {
    ngDecryptBlock(rawAwc.slice(blk*16, blk*16+16), KEY).copy(decAwc, blk*16);
}

console.log('First 128 bytes of lmg_combat.awc (after NG decrypt):');
for (let row = 0; row < 8; row++) {
    const rowData = decAwc.slice(row*16, row*16+16);
    const hex = Array.from(rowData).map(x => x.toString(16).padStart(2,'0')).join(' ');
    const asc = Array.from(rowData).map(x => x >= 32 && x < 127 ? String.fromCharCode(x) : '.').join('');
    console.log(row.toString(16).padStart(2,'0') + '0: ' + hex + '  ' + asc);
}
fs.writeFileSync('/tmp/lmg_combat_decrypted.bin', decAwc);
console.log('Saved to /tmp/lmg_combat_decrypted.bin');
