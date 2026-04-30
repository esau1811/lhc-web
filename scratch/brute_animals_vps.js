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

    const rpfBuf = fs.readFileSync('/opt/lhc-sound/RESIDENT.rpf');
    const offset = 8799 * 512; // animals_footsteps.awc
    const raw = rpfBuf.slice(offset, offset + 16);
    
    for (let i = 0; i < 101; i++) {
        const data = ngDecrypt(raw, ngKeys[i], tables);
        if (data.toString('utf8', 0, 4) === 'ADAT') {
            console.log(`FOUND! Index ${i} gives ADAT for animals_footsteps.awc`);
            return;
        }
    }
    console.log('No index gives ADAT for animals_footsteps.awc');
}

main().catch(console.error);
