// Verify: decrypt lmg_combat.awc with key[62] (joaat hash method)
const fs = require('fs');
const KEYS_DIR = '/opt/lhc-keys';
const ngKeyRaw = fs.readFileSync(KEYS_DIR + '/gtav_ng_key.dat');
const GTA5_NG_KEYS = [];
for (let i = 0; i < 101; i++) GTA5_NG_KEYS.push(ngKeyRaw.slice(i * 272, (i + 1) * 272));
const ngTabRaw = fs.readFileSync(KEYS_DIR + '/gtav_ng_decrypt_tables.dat');
const GTA5_NG_TABLES = []; let off = 0;
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
    const rdA = (d, s, t) => { const r = Buffer.allocUnsafe(16); r.writeUInt32LE((t[0][d[0]]^t[1][d[1]]^t[2][d[2]]^t[3][d[3]]^s[0])>>>0,0); r.writeUInt32LE((t[4][d[4]]^t[5][d[5]]^t[6][d[6]]^t[7][d[7]]^s[1])>>>0,4); r.writeUInt32LE((t[8][d[8]]^t[9][d[9]]^t[10][d[10]]^t[11][d[11]]^s[2])>>>0,8); r.writeUInt32LE((t[12][d[12]]^t[13][d[13]]^t[14][d[14]]^t[15][d[15]]^s[3])>>>0,12); return r; };
    const rdB = (d, s, t) => { const r = Buffer.allocUnsafe(16); r.writeUInt32LE((t[0][d[0]]^t[7][d[7]]^t[10][d[10]]^t[13][d[13]]^s[0])>>>0,0); r.writeUInt32LE((t[1][d[1]]^t[4][d[4]]^t[11][d[11]]^t[14][d[14]]^s[1])>>>0,4); r.writeUInt32LE((t[2][d[2]]^t[5][d[5]]^t[8][d[8]]^t[15][d[15]]^s[2])>>>0,8); r.writeUInt32LE((t[3][d[3]]^t[6][d[6]]^t[9][d[9]]^t[12][d[12]]^s[3])>>>0,12); return r; };
    let b = block; b = rdA(b, sk[0], GTA5_NG_TABLES[0]); b = rdA(b, sk[1], GTA5_NG_TABLES[1]);
    for (let k = 2; k <= 15; k++) b = rdB(b, sk[k], GTA5_NG_TABLES[k]);
    return rdA(b, sk[16], GTA5_NG_TABLES[16]);
}

function joaat(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash += str.charCodeAt(i);
        hash += hash << 10;
        hash ^= hash >>> 6;
    }
    hash += hash << 3;
    hash ^= hash >>> 11;
    hash += hash << 15;
    return hash >>> 0;
}

const rpf = fs.readFileSync('/tmp/uploaded_user.rpf');

const files = [
    { name: 'lmg_combat.awc', page: 2, us: 55496 },
    { name: 'ptl_pistol.awc', page: 1874, us: 64352 },
    { name: 'smg_micro.awc', page: 3226, us: 193048 },
];

for (const f of files) {
    const keyIdx = joaat(f.name.toLowerCase()) % 101;
    const KEY = GTA5_NG_KEYS[keyIdx];
    const rawFirst = rpf.slice(f.page * 512, f.page * 512 + 16);
    const dec = ngDecryptBlock(rawFirst, KEY);
    const flags = dec.readUInt32LE(0);
    const streams = flags & 0xFFF;
    const streaming = (flags >>> 31) !== 0;
    console.log(`${f.name} key[${keyIdx}]: flags=0x${flags.toString(16)} streams=${streams} streaming=${streaming}`);
    console.log(`  hex: ${dec.toString('hex')}`);
    if (streams > 0 && streams <= 16) {
        // Try to read stream TOC
        // Decrypt more bytes
        const rawMore = rpf.slice(f.page * 512, f.page * 512 + 512);
        const decMore = Buffer.alloc(512);
        for (let i = 0; i < 32; i++) {
            ngDecryptBlock(rawMore.slice(i*16, i*16+16), KEY).copy(decMore, i*16);
        }
        // In AWC non-streaming: after flags, there's usually padding then stream headers
        // Stream header: nameHash(4) + offset(4) + numChunks(4) + chunkOffsets...
        // Let's look at bytes 4-32
        console.log(`  bytes 4-32: ${decMore.slice(4, 32).toString('hex')}`);
        const u32_4 = decMore.readUInt32LE(4);
        const u32_8 = decMore.readUInt32LE(8);
        const u32_12 = decMore.readUInt32LE(12);
        console.log(`  uint32s: [4]=0x${u32_4.toString(16)} [8]=0x${u32_8.toString(16)} [12]=0x${u32_12.toString(16)}`);
    }
    console.log('');
}
