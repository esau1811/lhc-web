// Test all 101 NG keys on first 16 bytes of lmg_combat.awc
// Also test AES. One should give recognizable AWC header.
const fs = require('fs');
const crypto = require('crypto');
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
const AES_KEY = fs.readFileSync(KEYS_DIR + '/gtav_aes_key.dat');

function ngDecryptBlock(block, keyBuf) {
    const sk = [];
    for (let i = 0; i < 17; i++) sk.push([keyBuf.readUInt32LE(i*16), keyBuf.readUInt32LE(i*16+4), keyBuf.readUInt32LE(i*16+8), keyBuf.readUInt32LE(i*16+12)]);
    const rdA = (d, s, t) => { const r = Buffer.allocUnsafe(16); r.writeUInt32LE((t[0][d[0]]^t[1][d[1]]^t[2][d[2]]^t[3][d[3]]^s[0])>>>0,0); r.writeUInt32LE((t[4][d[4]]^t[5][d[5]]^t[6][d[6]]^t[7][d[7]]^s[1])>>>0,4); r.writeUInt32LE((t[8][d[8]]^t[9][d[9]]^t[10][d[10]]^t[11][d[11]]^s[2])>>>0,8); r.writeUInt32LE((t[12][d[12]]^t[13][d[13]]^t[14][d[14]]^t[15][d[15]]^s[3])>>>0,12); return r; };
    const rdB = (d, s, t) => { const r = Buffer.allocUnsafe(16); r.writeUInt32LE((t[0][d[0]]^t[7][d[7]]^t[10][d[10]]^t[13][d[13]]^s[0])>>>0,0); r.writeUInt32LE((t[1][d[1]]^t[4][d[4]]^t[11][d[11]]^t[14][d[14]]^s[1])>>>0,4); r.writeUInt32LE((t[2][d[2]]^t[5][d[5]]^t[8][d[8]]^t[15][d[15]]^s[2])>>>0,8); r.writeUInt32LE((t[3][d[3]]^t[6][d[6]]^t[9][d[9]]^t[12][d[12]]^s[3])>>>0,12); return r; };
    let b = block; b = rdA(b, sk[0], GTA5_NG_TABLES[0]); b = rdA(b, sk[1], GTA5_NG_TABLES[1]);
    for (let k = 2; k <= 15; k++) b = rdB(b, sk[k], GTA5_NG_TABLES[k]);
    return rdA(b, sk[16], GTA5_NG_TABLES[16]);
}

// lmg_combat.awc: page=2
const rpf = fs.readFileSync('/tmp/uploaded_user.rpf');
const awcRaw = rpf.slice(2 * 512, 2 * 512 + 16);
console.log('Raw first 16 bytes of lmg_combat.awc:', awcRaw.toString('hex'));

// Try raw (unencrypted)
console.log('\nRaw (no decrypt):', awcRaw.toString('hex'), '| uint32:', awcRaw.readUInt32LE(0).toString(16));

// Try AES
try {
    const d = crypto.createDecipheriv('aes-256-ecb', AES_KEY, null);
    d.setAutoPadding(false);
    const dec = Buffer.concat([d.update(awcRaw), d.final()]);
    console.log('AES decrypt:', dec.toString('hex'), '| uint32:', dec.readUInt32LE(0).toString(16));
} catch(e) { console.log('AES failed:', e.message); }

// Try all 101 NG keys
console.log('\nTrying all 101 NG keys:');
for (let i = 0; i < 101; i++) {
    const dec = ngDecryptBlock(awcRaw, GTA5_NG_KEYS[i]);
    const v = dec.readUInt32LE(0);
    // AWC flags: low 12 bits = stream count (1-8 typical), bit 31 = streaming
    const streams = v & 0xFFF;
    const streaming = (v >>> 31) !== 0;
    // A valid AWC would have 1-8 streams
    if (streams > 0 && streams <= 16) {
        console.log(`Key[${i}]: ${dec.toString('hex')} streams=${streams} streaming=${streaming} <-- POSSIBLE MATCH`);
    }
}
console.log('Done.');
