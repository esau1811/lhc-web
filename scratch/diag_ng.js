// DIAGNOSTIC: run on VPS, shows all entries inside the RPF
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const KEYS_DIR = '/opt/lhc-keys';
const RPF_PATH = '/tmp/uploaded_user.rpf';
const ENC_AES = 0x0FFFFFF9;
const ENC_OPEN = 0x4E45504F;

let GTA5_AES_KEY = null, GTA5_NG_KEYS = null, GTA5_NG_TABLES = null;
try {
    GTA5_AES_KEY = fs.readFileSync(path.join(KEYS_DIR, 'gtav_aes_key.dat'));
    const ngKeyRaw = fs.readFileSync(path.join(KEYS_DIR, 'gtav_ng_key.dat'));
    GTA5_NG_KEYS = [];
    for (let i = 0; i < 101; i++) GTA5_NG_KEYS.push(ngKeyRaw.slice(i * 272, (i + 1) * 272));
    const ngTabRaw = fs.readFileSync(path.join(KEYS_DIR, 'gtav_ng_decrypt_tables.dat'));
    GTA5_NG_TABLES = []; let off = 0;
    for (let r = 0; r < 17; r++) {
        GTA5_NG_TABLES[r] = [];
        for (let t = 0; t < 16; t++) {
            const table = new Uint32Array(256);
            for (let e = 0; e < 256; e++) { table[e] = ngTabRaw.readUInt32LE(off); off += 4; }
            GTA5_NG_TABLES[r].push(table);
        }
    }
    console.log('Keys loaded OK');
} catch(e) { console.error('Key load error:', e.message); }

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
    let b = block;
    b = rdA(b, sk[0], GTA5_NG_TABLES[0]);
    b = rdA(b, sk[1], GTA5_NG_TABLES[1]);
    for (let k = 2; k <= 15; k++) b = rdB(b, sk[k], GTA5_NG_TABLES[k]);
    return rdA(b, sk[16], GTA5_NG_TABLES[16]);
}

function ngDecrypt(data, keyBuf) {
    const out = Buffer.from(data);
    for (let i = 0; i < Math.floor(data.length / 16); i++)
        ngDecryptBlock(data.slice(i*16, i*16+16), keyBuf).copy(out, i*16);
    return out;
}

const buf = fs.readFileSync(RPF_PATH);
console.log('RPF size:', buf.length, 'Magic:', buf.toString('ascii', 0, 4));
const ec = buf.readUInt32LE(4);
const nl = buf.readUInt32LE(8);
const et = buf.readUInt32LE(12);
console.log('EC:', ec, 'NL:', nl, 'ET:', '0x' + et.toString(16));

const hl = ec * 16 + nl;
const encHeaderSlice = buf.slice(16, hl + 16);

let header = null;

if (et === ENC_AES) {
    console.log('Type: AES');
    const d = crypto.createDecipheriv('aes-256-ecb', GTA5_AES_KEY, null);
    d.setAutoPadding(false);
    const dec = Buffer.concat([d.update(encHeaderSlice.slice(0, Math.floor(encHeaderSlice.length/16)*16)), d.final()]);
    header = encHeaderSlice.length % 16 ? Buffer.concat([dec, encHeaderSlice.slice(dec.length)]) : dec;
} else if (et === 0 || et === ENC_OPEN) {
    console.log('Type: OPEN (no encryption)');
    header = encHeaderSlice;
} else {
    console.log('Type: NG, trying all 101 keys...');
    for (let i = 0; i < 101; i++) {
        const testDec = ngDecryptBlock(encHeaderSlice.slice(0, 16), GTA5_NG_KEYS[i]);
        // First entry should be a directory with nameOff=0, type=0x7FFFFF00
        const nameOff = testDec.readUInt16LE(0);
        const entryType = testDec.readUInt32LE(4);
        if (nameOff === 0 && entryType === 0x7FFFFF00) {
            console.log('Found NG key at index', i);
            header = ngDecrypt(encHeaderSlice, GTA5_NG_KEYS[i]);
            break;
        }
        // Alternative: check if first byte is 0 (common for first entry name offset)
        if (testDec[0] === 0 && testDec[1] === 0) {
            console.log('Possible NG key at index', i, 'first bytes:', testDec.slice(0,8).toString('hex'));
        }
    }
    if (!header) {
        console.log('NG decryption failed, trying raw (unencrypted check)...');
        // Maybe it's actually unencrypted despite the ET value
        header = encHeaderSlice;
    }
}

const nts = ec * 16;
console.log('\nAll entries:');
for (let i = 0; i < ec; i++) {
    const eo = i * 16;
    const nameOff = header.readUInt16LE(eo);
    const us = header.readUInt32LE(eo + 8);
    const cs = header[eo+2] | (header[eo+3]<<8) | (header[eo+4]<<16);
    const page = header[eo+5] | (header[eo+6]<<8) | (header[eo+7]<<16);
    const entryType = header.readUInt32LE(eo + 4);
    let name = '';
    let p = nts + nameOff;
    while (p < nts + nl && header[p] !== 0) name += String.fromCharCode(header[p++]);
    console.log(`[${i}] "${name}" type=${entryType.toString(16)} page=${page} us=${us} cs=${cs}`);
}
