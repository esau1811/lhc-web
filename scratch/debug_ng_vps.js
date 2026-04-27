// Run on VPS: node /tmp/debug_ng.js
// Debugs NG key matching for WEAPONS_PLAYER.rpf
const fs   = require('fs');
const path = require('path');

const KEYS_DIR  = '/opt/lhc-keys';
const RPF_PATH  = '/tmp/debug_rpf.bin'; // first 512 bytes of WEAPONS_PLAYER.rpf

const rpfHeader  = fs.readFileSync(RPF_PATH);
const magic      = rpfHeader.slice(0, 4).toString('hex');
const entryCount = rpfHeader.readUInt32LE(4);
const namesLen   = rpfHeader.readUInt32LE(8);
const encType    = rpfHeader.readUInt32LE(12);
const encName    = {0x0FEFFFFF:'NG', 0x0FFFFFF9:'AES', 0x4E45504F:'OPEN'}[encType] || '0x'+encType.toString(16);
console.log('Magic:', magic, '| Entries:', entryCount, '| NamesLen:', namesLen, '| Enc:', encName);

const aesKey   = fs.readFileSync(path.join(KEYS_DIR, 'gtav_aes_key.dat'));
const ngKeyRaw = fs.readFileSync(path.join(KEYS_DIR, 'gtav_ng_key.dat'));
const ngTabRaw = fs.readFileSync(path.join(KEYS_DIR, 'gtav_ng_decrypt_tables.dat'));
const hashLut  = fs.readFileSync(path.join(KEYS_DIR, 'gtav_hash_lut.dat'));

console.log('AES key len:', aesKey.length);
console.log('NG key raw len:', ngKeyRaw.length, '-> 272-byte entries:', ngKeyRaw.length / 272);
console.log('NG tables raw len:', ngTabRaw.length, '-> expected:', 17*16*256*4);
console.log('Key[0] first 16:', ngKeyRaw.slice(0, 16).toString('hex'));

const NG_TABLES = [];
let off = 0;
for (let r = 0; r < 17; r++) {
    NG_TABLES[r] = [];
    for (let t = 0; t < 16; t++) {
        const table = new Uint32Array(256);
        for (let e = 0; e < 256; e++) {
            table[e] = ngTabRaw.readUInt32LE(off);
            off += 4;
        }
        NG_TABLES[r].push(table);
    }
}
console.log('Tables loaded. T[0][0][0]:', NG_TABLES[0][0][0].toString(16));

function roundA(data, sk, tbl) {
    const x1 = (tbl[0][data[0]]^tbl[1][data[1]]^tbl[2][data[2]]^tbl[3][data[3]]^sk[0])>>>0;
    const x2 = (tbl[4][data[4]]^tbl[5][data[5]]^tbl[6][data[6]]^tbl[7][data[7]]^sk[1])>>>0;
    const x3 = (tbl[8][data[8]]^tbl[9][data[9]]^tbl[10][data[10]]^tbl[11][data[11]]^sk[2])>>>0;
    const x4 = (tbl[12][data[12]]^tbl[13][data[13]]^tbl[14][data[14]]^tbl[15][data[15]]^sk[3])>>>0;
    const r = Buffer.allocUnsafe(16);
    r.writeUInt32LE(x1,0); r.writeUInt32LE(x2,4); r.writeUInt32LE(x3,8); r.writeUInt32LE(x4,12);
    return r;
}

function roundB(data, sk, tbl) {
    const x1=(tbl[0][data[0]]^tbl[7][data[7]]^tbl[10][data[10]]^tbl[13][data[13]]^sk[0])>>>0;
    const x2=(tbl[1][data[1]]^tbl[4][data[4]]^tbl[11][data[11]]^tbl[14][data[14]]^sk[1])>>>0;
    const x3=(tbl[2][data[2]]^tbl[5][data[5]]^tbl[8][data[8]]^tbl[15][data[15]]^sk[2])>>>0;
    const x4=(tbl[3][data[3]]^tbl[6][data[6]]^tbl[9][data[9]]^tbl[12][data[12]]^sk[3])>>>0;
    const r = Buffer.allocUnsafe(16);
    r.writeUInt32LE(x1,0); r.writeUInt32LE(x2,4); r.writeUInt32LE(x3,8); r.writeUInt32LE(x4,12);
    return r;
}

function decryptBlock(block, keyBuf) {
    const sk = [];
    for (let i = 0; i < 17; i++) {
        sk.push([
            keyBuf.readUInt32LE(i*16),
            keyBuf.readUInt32LE(i*16+4),
            keyBuf.readUInt32LE(i*16+8),
            keyBuf.readUInt32LE(i*16+12),
        ]);
    }
    let b = block;
    b = roundA(b, sk[0], NG_TABLES[0]);
    b = roundA(b, sk[1], NG_TABLES[1]);
    for (let k=2; k<=15; k++) b = roundB(b, sk[k], NG_TABLES[k]);
    b = roundA(b, sk[16], NG_TABLES[16]);
    return b;
}

const firstEntry = rpfHeader.slice(16, 32);
console.log('\nFirst encrypted entry:', firstEntry.toString('hex'));

let found = false;
for (let i = 0; i < 101; i++) {
    const kbuf = ngKeyRaw.slice(i * 272, (i+1) * 272);
    const dec  = decryptBlock(firstEntry, kbuf);
    const w4   = dec.readUInt32LE(4);
    const page = w4 & 0x7FFFFF;

    if (i < 5) {
        console.log('Key['+i+'] dec:', dec.toString('hex'), '| w4:'+w4.toString(16)+' page:'+page.toString(16));
    }

    if (page === 0x7FFFFF) {
        console.log('MATCH at key['+i+']: dec =', dec.toString('hex'));
        found = true;
    }
}

if (!found) {
    console.log('No match for page===0x7FFFFF');
    // Also check: is any key making the output look "structured" (repeated patterns)?
    // A valid directory entry often has bytes at specific positions
    // Let me also check if the entry might use a different format
    // Check for 0xFFFFFF00 pattern (alternative directory marker interpretation)
    for (let i = 0; i < 101; i++) {
        const kbuf = ngKeyRaw.slice(i * 272, (i+1) * 272);
        const dec  = decryptBlock(firstEntry, kbuf);
        const w4   = dec.readUInt32LE(4);
        // Check various patterns
        if ((w4 & 0x800000) && (w4 & 0x7FFFFF) > 0x700000) {
            console.log('Near-match key['+i+']: w4='+w4.toString(16)+' dec='+dec.toString('hex'));
        }
    }
}

console.log('Done.');
