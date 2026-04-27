import paramiko, sys

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

# Write a script that reuses the server's own functions to dump an AWC
script = """'use strict';
const fs = require('fs');
const crypto = require('crypto');

const KEYS_DIR = '/opt/lhc-keys';
const RPF_PATH = '/opt/lhc-sound/RESIDENT.rpf';
const ENC_OPEN = 0x4E45504F;
const ENC_AES  = 0x0FFFFFF9;
const ENC_NG   = 0x0FEFFFFF;

let GTA5_AES_KEY, GTA5_NG_KEYS, GTA5_NG_TABLES, GTA5_HASH_LUT;
const aesPath = KEYS_DIR + '/gtav_aes_key.dat';
GTA5_AES_KEY = fs.readFileSync(aesPath);
const ngKeyRaw = fs.readFileSync(KEYS_DIR + '/gtav_ng_key.dat');
GTA5_NG_KEYS = [];
for (let i = 0; i < 101; i++) GTA5_NG_KEYS.push(ngKeyRaw.slice(i * 272, (i + 1) * 272));
const ngTabRaw = fs.readFileSync(KEYS_DIR + '/gtav_ng_decrypt_tables.dat');
GTA5_NG_TABLES = [];
let tabOff = 0;
for (let r = 0; r < 17; r++) {
    GTA5_NG_TABLES[r] = [];
    for (let t = 0; t < 16; t++) {
        const table = new Uint32Array(256);
        for (let e = 0; e < 256; e++) { table[e] = ngTabRaw.readUInt32LE(tabOff); tabOff += 4; }
        GTA5_NG_TABLES[r].push(table);
    }
}
GTA5_HASH_LUT = fs.readFileSync(KEYS_DIR + '/gtav_hash_lut.dat');

function gta5Hash(text) {
    let result = 0;
    for (let i = 0; i < text.length; i++) {
        const c = GTA5_HASH_LUT[text.charCodeAt(i) & 0xFF];
        const sum = (c + result) >>> 0;
        const temp = Math.imul(1025, sum) >>> 0;
        result = ((temp >>> 6) ^ temp) >>> 0;
    }
    const r9 = Math.imul(9, result) >>> 0;
    return Math.imul(32769, ((r9 >>> 11) ^ r9) >>> 0) >>> 0;
}

function ngDecryptBlock(block, keyBuf) {
    const subKeys = [];
    for (let i = 0; i < 17; i++) subKeys.push([keyBuf.readUInt32LE(i*16), keyBuf.readUInt32LE(i*16+4), keyBuf.readUInt32LE(i*16+8), keyBuf.readUInt32LE(i*16+12)]);
    const rdA = (d, sk, t) => {
        const x1=(t[0][d[0]]^t[1][d[1]]^t[2][d[2]]^t[3][d[3]]^sk[0])>>>0;
        const x2=(t[4][d[4]]^t[5][d[5]]^t[6][d[6]]^t[7][d[7]]^sk[1])>>>0;
        const x3=(t[8][d[8]]^t[9][d[9]]^t[10][d[10]]^t[11][d[11]]^sk[2])>>>0;
        const x4=(t[12][d[12]]^t[13][d[13]]^t[14][d[14]]^t[15][d[15]]^sk[3])>>>0;
        const r=Buffer.allocUnsafe(16);r.writeUInt32LE(x1,0);r.writeUInt32LE(x2,4);r.writeUInt32LE(x3,8);r.writeUInt32LE(x4,12);return r;
    };
    const rdB = (d, sk, t) => {
        const x1=(t[0][d[0]]^t[7][d[7]]^t[10][d[10]]^t[13][d[13]]^sk[0])>>>0;
        const x2=(t[1][d[1]]^t[4][d[4]]^t[11][d[11]]^t[14][d[14]]^sk[1])>>>0;
        const x3=(t[2][d[2]]^t[5][d[5]]^t[8][d[8]]^t[15][d[15]]^sk[2])>>>0;
        const x4=(t[3][d[3]]^t[6][d[6]]^t[9][d[9]]^t[12][d[12]]^sk[3])>>>0;
        const r=Buffer.allocUnsafe(16);r.writeUInt32LE(x1,0);r.writeUInt32LE(x2,4);r.writeUInt32LE(x3,8);r.writeUInt32LE(x4,12);return r;
    };
    let buf=block;
    buf=rdA(buf,subKeys[0],GTA5_NG_TABLES[0]);buf=rdA(buf,subKeys[1],GTA5_NG_TABLES[1]);
    for(let k=2;k<=15;k++) buf=rdB(buf,subKeys[k],GTA5_NG_TABLES[k]);
    buf=rdA(buf,subKeys[16],GTA5_NG_TABLES[16]);
    return buf;
}

function ngDecrypt(data, keyBuf) {
    const out = Buffer.from(data);
    for (let b = 0; b < Math.floor(data.length/16); b++) ngDecryptBlock(data.slice(b*16,b*16+16), keyBuf).copy(out, b*16);
    return out;
}

const rpfRaw = fs.readFileSync(RPF_PATH);
const encType = rpfRaw.readUInt32LE(12);
const entryCount = rpfRaw.readUInt32LE(4);
const namesLength = rpfRaw.readUInt32LE(8);
console.log('EncType:', encType.toString(16), 'entries:', entryCount, 'namesLen:', namesLength);

const headerLen = entryCount * 16 + namesLength;
const encBlock = rpfRaw.slice(16, 16 + headerLen);
let decBlock;

if (encType === ENC_AES) {
    console.log('AES encrypted');
    const d = crypto.createDecipheriv('aes-256-ecb', GTA5_AES_KEY, null);
    d.setAutoPadding(false);
    decBlock = Buffer.concat([d.update(encBlock.slice(0, Math.floor(encBlock.length/16)*16)), d.final()]);
    if (encBlock.length % 16) decBlock = Buffer.concat([decBlock, encBlock.slice(decBlock.length)]);
} else if (encType === ENC_NG) {
    console.log('NG encrypted - finding key...');
    const fname = 'RESIDENT.rpf';
    const idx = ((gta5Hash(fname) + rpfRaw.length + 61) >>> 0) % 101;
    const test = ngDecryptBlock(encBlock.slice(0, 16), GTA5_NG_KEYS[idx]);
    let key = null;
    if (test.readUInt16LE(0) === 0 && test.readUInt32LE(4) === 0x7FFFFF00) key = GTA5_NG_KEYS[idx];
    if (!key) {
        for (let i = 0; i < 101; i++) {
            const t = ngDecryptBlock(encBlock.slice(0, 16), GTA5_NG_KEYS[i]);
            if (t.readUInt16LE(0) === 0 && t.readUInt32LE(4) === 0x7FFFFF00) { key = GTA5_NG_KEYS[i]; console.log('Found NG key at index', i); break; }
        }
    }
    if (!key) { console.log('NG key not found!'); process.exit(1); }
    decBlock = ngDecrypt(encBlock, key);
} else if (encType === ENC_OPEN) {
    console.log('OPEN (unencrypted)');
    decBlock = encBlock;
} else {
    console.log('Unknown encType:', encType.toString(16));
    process.exit(1);
}

const rpf = Buffer.from(rpfRaw);
decBlock.copy(rpf, 16);

const nameTableStart = 16 + entryCount * 16;
let awcCount = 0;
for (let i = 0; i < entryCount; i++) {
    const eOff = 16 + i * 16;
    if (rpf.readUInt32LE(eOff + 4) === 0x7FFFFF00) continue;
    const nameOff = rpf.readUInt16LE(eOff);
    let name = '';
    let p = nameTableStart + nameOff;
    while (p < nameTableStart + namesLength && rpf[p] !== 0) name += String.fromCharCode(rpf[p++]);
    if (name.toLowerCase().endsWith('.awc')) {
        const page = rpf[eOff+5] | (rpf[eOff+6]<<8) | (rpf[eOff+7]<<16);
        const size = rpf.readUInt32LE(eOff + 8);
        console.log('AWC:', name, '| page:', page, '| size:', size);
        if (awcCount === 0) {
            // Save first AWC to /tmp for inspection
            const awcData = rpf.slice(page * 512, page * 512 + size);
            fs.writeFileSync('/tmp/first.awc', awcData);
            console.log('HEX(first 128 bytes):', awcData.slice(0, 128).toString('hex'));
        }
        awcCount++;
        if (awcCount >= 5) { console.log('...'); break; }
    }
}
console.log('Total AWC found (first 5 shown):', awcCount);
"""

sftp = client.open_sftp()
with sftp.open('/tmp/dump_awc2.js', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = client.exec_command('node /tmp/dump_awc2.js 2>&1')
out = stdout.read().decode(errors='replace')
print(out if out else "(no output)")

client.close()
