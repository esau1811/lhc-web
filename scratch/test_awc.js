const fs = require('fs');
const crypto = require('crypto');

const KEYS_DIR = '/opt/lhc-keys';
let GTA5_AES_KEY = null, GTA5_NG_KEYS = null, GTA5_NG_TABLES = null, GTA5_HASH_LUT = null;

function loadKeys() {
    GTA5_AES_KEY = fs.readFileSync(`${KEYS_DIR}/gtav_aes_key.dat`);
    const ngKeyRaw = fs.readFileSync(`${KEYS_DIR}/gtav_ng_key.dat`);
    GTA5_NG_KEYS = []; for (let i = 0; i < 101; i++) GTA5_NG_KEYS.push(ngKeyRaw.slice(i * 272, (i + 1) * 272));
    const ngTabRaw = fs.readFileSync(`${KEYS_DIR}/gtav_ng_decrypt_tables.dat`);
    GTA5_NG_TABLES = []; let off = 0;
    for (let r = 0; r < 17; r++) {
        GTA5_NG_TABLES[r] = [];
        for (let t = 0; t < 16; t++) {
            const table = new Uint32Array(256);
            for (let e = 0; e < 256; e++) { table[e] = ngTabRaw.readUInt32LE(off); off += 4; }
            GTA5_NG_TABLES[r].push(table);
        }
    }
    GTA5_HASH_LUT = fs.readFileSync(`${KEYS_DIR}/gtav_hash_lut.dat`);
}
loadKeys();

function gta5Hash(text) {
    let result = 0;
    for (let i = 0; i < text.length; i++) {
        const c = GTA5_HASH_LUT ? GTA5_HASH_LUT[text.charCodeAt(i) & 0xFF] : (text.charCodeAt(i) | 0x20) & 0xFF;
        result = ((Math.imul(1025, (c + result) >>> 0) >>> 0) >>> 6 ^ Math.imul(1025, (c + result) >>> 0) >>> 0) >>> 0;
    }
    const r9 = Math.imul(9, result) >>> 0;
    return Math.imul(32769, ((r9 >>> 11) ^ r9) >>> 0) >>> 0;
}

function ngDecryptBlock(block, keyBuf) {
    const sk = []; for (let i = 0; i < 17; i++) sk.push([keyBuf.readUInt32LE(i*16), keyBuf.readUInt32LE(i*16+4), keyBuf.readUInt32LE(i*16+8), keyBuf.readUInt32LE(i*16+12)]);
    const rdA = (d,s,t) => { const r=Buffer.allocUnsafe(16); r.writeUInt32LE((t[0][d[0]]^t[1][d[1]]^t[2][d[2]]^t[3][d[3]]^s[0])>>>0,0); r.writeUInt32LE((t[4][d[4]]^t[5][d[5]]^t[6][d[6]]^t[7][d[7]]^s[1])>>>0,4); r.writeUInt32LE((t[8][d[8]]^t[9][d[9]]^t[10][d[10]]^t[11][d[11]]^s[2])>>>0,8); r.writeUInt32LE((t[12][d[12]]^t[13][d[13]]^t[14][d[14]]^t[15][d[15]]^s[3])>>>0,12); return r; };
    const rdB = (d,s,t) => { const r=Buffer.allocUnsafe(16); r.writeUInt32LE((t[0][d[0]]^t[7][d[7]]^t[10][d[10]]^t[13][d[13]]^s[0])>>>0,0); r.writeUInt32LE((t[1][d[1]]^t[4][d[4]]^t[11][d[11]]^t[14][d[14]]^s[1])>>>0,4); r.writeUInt32LE((t[2][d[2]]^t[5][d[5]]^t[8][d[8]]^t[15][d[15]]^s[2])>>>0,8); r.writeUInt32LE((t[3][d[3]]^t[6][d[6]]^t[9][d[9]]^t[12][d[12]]^s[3])>>>0,12); return r; };
    let b = block;
    b = rdA(b, sk[0], GTA5_NG_TABLES[0]); b = rdA(b, sk[1], GTA5_NG_TABLES[1]);
    for (let k = 2; k <= 15; k++) b = rdB(b, sk[k], GTA5_NG_TABLES[k]);
    return rdA(b, sk[16], GTA5_NG_TABLES[16]);
}

function ngDecrypt(data, keyBuf) {
    const out = Buffer.from(data);
    for (let i = 0; i < Math.floor(data.length / 16); i++) ngDecryptBlock(data.slice(i*16, i*16+16), keyBuf).copy(out, i*16);
    return out;
}

const rpfBuf = fs.readFileSync('/opt/lhc-sound/RESIDENT.rpf');
const encType = rpfBuf.readUInt32LE(12);
console.log('ENC TYPE:', encType.toString(16));

const entryCount = rpfBuf.readUInt32LE(4);
const namesLength = rpfBuf.readUInt32LE(8);
const headerLen = entryCount * 16 + namesLength;
const enc = rpfBuf.slice(16, 16 + headerLen);

const filename = 'RESIDENT.rpf';
const idx = ((gta5Hash(filename) + rpfBuf.length + 61) >>> 0) % 101;
let ngHeaderKey = null;
const test = ngDecryptBlock(enc.slice(0,16), GTA5_NG_KEYS[idx]);
if (test.readUInt16LE(0) === 0 && test.readUInt32LE(4) === 0x7FFFFF00) ngHeaderKey = GTA5_NG_KEYS[idx];
if (!ngHeaderKey) for (let i = 0; i < 101; i++) { const t = ngDecryptBlock(enc.slice(0,16), GTA5_NG_KEYS[i]); if (t.readUInt16LE(0)===0 && t.readUInt32LE(4)===0x7FFFFF00) { ngHeaderKey=GTA5_NG_KEYS[i]; break; } }
if (!ngHeaderKey) throw new Error('NG Key not found');

const decHeader = ngDecrypt(enc, ngHeaderKey);

const nameTableStart = entryCount * 16;
for (let i = 0; i < 5; i++) {
    const eOff = i * 16;
    if (decHeader.readUInt32LE(eOff + 4) === 0x7FFFFF00) continue;
    const nameOff = decHeader.readUInt16LE(eOff);
    let name = ''; let p = nameTableStart + nameOff;
    while (p < nameTableStart + namesLength && decHeader[p] !== 0) name += String.fromCharCode(decHeader[p++]);
    
    const page = decHeader[eOff+5] | (decHeader[eOff+6]<<8) | (decHeader[eOff+7]<<16);
    const size = decHeader.readUInt32LE(eOff + 8);
    
    console.log('FILE:', name, 'page:', page, 'size:', size);
    console.log('  ENTRY RAW:', decHeader.slice(eOff, eOff+16).toString('hex'));
    
    if (page > 0 && size > 20) {
        const kIdx = ((gta5Hash(name.toLowerCase()) + size + 61) >>> 0) % 101;
        const uncompressedSize = decHeader.readUInt32LE(eOff + 12);
        const kIdx2 = ((gta5Hash(name.toLowerCase()) + uncompressedSize + 61) >>> 0) % 101;
        const raw = rpfBuf.slice(page * 512, page * 512 + Math.min(size, 64));
        const data1 = ngDecrypt(raw, GTA5_NG_KEYS[kIdx]);
        const data2 = ngDecrypt(raw, GTA5_NG_KEYS[kIdx2]);
        console.log('  DATA (sz):', data1.slice(0, 8).toString('hex'));
        console.log('  DATA (usz):', data2.slice(0, 8).toString('hex'));
    }
}
