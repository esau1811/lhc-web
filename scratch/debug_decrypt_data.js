'use strict';
// Debug script: test multiple decryption strategies for WEAPONS_PLAYER.rpf file data
// Upload this script + a small chunk of the RPF to the VPS and run it there.
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const SSH = { host: '187.33.157.103', port: 22, username: 'root', password: 'diScordLhcds032.w' };
const rpfPath = path.join(__dirname, '..', 'LHC Sound boost', 'WEAPONS_PLAYER.rpf');
const rpf = fs.readFileSync(rpfPath);

// We'll upload the script to run on VPS + the first 128KB of the RPF (enough for header + first few AWC entries)
const chunk = rpf.slice(0, 128 * 1024);

const vpsScript = `
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const KEYS = '/opt/lhc-keys';
const rpf = fs.readFileSync('/tmp/rpf_chunk.bin');

const ngKeyRaw = fs.readFileSync(path.join(KEYS, 'gtav_ng_key.dat'));
const ngTabRaw = fs.readFileSync(path.join(KEYS, 'gtav_ng_decrypt_tables.dat'));
const hashLut  = fs.readFileSync(path.join(KEYS, 'gtav_hash_lut.dat'));
const aesKey   = fs.readFileSync(path.join(KEYS, 'gtav_aes_key.dat'));

// Load NG tables
const T = [];
let off = 0;
for (let r = 0; r < 17; r++) {
    T[r] = [];
    for (let t = 0; t < 16; t++) {
        const tb = new Uint32Array(256);
        for (let e = 0; e < 256; e++) { tb[e] = ngTabRaw.readUInt32LE(off); off += 4; }
        T[r].push(tb);
    }
}

function rA(d,sk,tb){
    const x1=(tb[0][d[0]]^tb[1][d[1]]^tb[2][d[2]]^tb[3][d[3]]^sk[0])>>>0;
    const x2=(tb[4][d[4]]^tb[5][d[5]]^tb[6][d[6]]^tb[7][d[7]]^sk[1])>>>0;
    const x3=(tb[8][d[8]]^tb[9][d[9]]^tb[10][d[10]]^tb[11][d[11]]^sk[2])>>>0;
    const x4=(tb[12][d[12]]^tb[13][d[13]]^tb[14][d[14]]^tb[15][d[15]]^sk[3])>>>0;
    const r=Buffer.allocUnsafe(16);r.writeUInt32LE(x1,0);r.writeUInt32LE(x2,4);r.writeUInt32LE(x3,8);r.writeUInt32LE(x4,12);return r;
}
function rB(d,sk,tb){
    const x1=(tb[0][d[0]]^tb[7][d[7]]^tb[10][d[10]]^tb[13][d[13]]^sk[0])>>>0;
    const x2=(tb[1][d[1]]^tb[4][d[4]]^tb[11][d[11]]^tb[14][d[14]]^sk[1])>>>0;
    const x3=(tb[2][d[2]]^tb[5][d[5]]^tb[8][d[8]]^tb[15][d[15]]^sk[2])>>>0;
    const x4=(tb[3][d[3]]^tb[6][d[6]]^tb[9][d[9]]^tb[12][d[12]]^sk[3])>>>0;
    const r=Buffer.allocUnsafe(16);r.writeUInt32LE(x1,0);r.writeUInt32LE(x2,4);r.writeUInt32LE(x3,8);r.writeUInt32LE(x4,12);return r;
}
function decBlock(blk,kb){
    const sk=[];for(let i=0;i<17;i++)sk.push([kb.readUInt32LE(i*16),kb.readUInt32LE(i*16+4),kb.readUInt32LE(i*16+8),kb.readUInt32LE(i*16+12)]);
    let b=blk;b=rA(b,sk[0],T[0]);b=rA(b,sk[1],T[1]);
    for(let k=2;k<=15;k++)b=rB(b,sk[k],T[k]);
    b=rA(b,sk[16],T[16]);return b;
}
function ngDecrypt(data,kb){
    const out=Buffer.from(data);
    for(let b=0;b<Math.floor(data.length/16);b++)decBlock(data.slice(b*16,b*16+16),kb).copy(out,b*16);
    return out;
}

// Step 1: Decrypt header with key[26]
const entryCount = rpf.readUInt32LE(4);
const namesLen = rpf.readUInt32LE(8);
const headerBlock = rpf.slice(16, 16 + entryCount*16 + namesLen);
const key26 = ngKeyRaw.slice(26*272, 27*272);
const decHeader = ngDecrypt(headerBlock, key26);

// Verify: first entry should be root dir
console.log('=== HEADER DECRYPTION ===');
console.log('First entry dec:', decHeader.slice(0, 16).toString('hex'));
console.log('Root dir check: nameOff=0, w4=7fffff00?', 
    decHeader.readUInt16LE(0) === 0 && decHeader.readUInt32LE(4) === 0x7FFFFF00);

// Parse names from decrypted header
const ntStart = entryCount * 16;
const namesData = decHeader.slice(ntStart, ntStart + namesLen);
const names = new Map();
let p = 0;
while (p < namesLen) {
    const s = p; let n = '';
    while (p < namesLen && namesData[p] !== 0) n += String.fromCharCode(namesData[p++]);
    names.set(s, n.toLowerCase()); p++;
}
console.log('Names found:', [...names.values()].filter(n=>n.length>0).join(', '));

// Get entry 1 (lmg_combat.awc) - first file entry
const e1 = decHeader.slice(16, 32); // entry index 1
const e1Name = names.get(e1.readUInt16LE(0)) || '';
const e1Page = e1[5] | (e1[6]<<8) | (e1[7]<<16);
const e1Size = e1.readUInt32LE(8);
const e1Off = e1Page * 512;
console.log('\\n=== ENTRY 1:', e1Name, '===');
console.log('Page:', e1Page, 'Offset:', e1Off, 'Size:', e1Size);

if (e1Off + 64 > rpf.length) {
    console.log('Data offset beyond chunk, skipping');
    process.exit(0);
}

const rawData = rpf.slice(e1Off, Math.min(e1Off + e1Size, rpf.length));
console.log('Raw first 32:', rawData.slice(0, 32).toString('hex'));

// TEST 1: Decrypt data with SAME key as header (key[26])
console.log('\\n--- TEST 1: Same NG key as header (key[26]) ---');
const dec1 = ngDecrypt(rawData.slice(0, 64), key26);
console.log('Dec first 32:', dec1.slice(0, 32).toString('hex'));
console.log('Looks like AWC (0x54414441 DATA)?', dec1.readUInt32LE(0).toString(16));

// TEST 2: AES-ECB decrypt
console.log('\\n--- TEST 2: AES-256-ECB ---');
try {
    const ci = crypto.createDecipheriv('aes-256-ecb', aesKey, null);
    ci.setAutoPadding(false);
    const dec2 = Buffer.concat([ci.update(rawData.slice(0, 64)), ci.final()]);
    console.log('Dec first 32:', dec2.slice(0, 32).toString('hex'));
    console.log('Looks like AWC?', dec2.readUInt32LE(0).toString(16));
} catch(e) { console.log('AES error:', e.message); }

// TEST 3: Try ALL 101 NG keys on first block
console.log('\\n--- TEST 3: Brute force all 101 NG keys (first 16 bytes) ---');
const AWC_MAGICS = [0x54414441, 0x41574356, 0x44415441]; // DATA, AWCV, DATA
let found = false;
for (let k = 0; k < 101; k++) {
    const kb = ngKeyRaw.slice(k*272, (k+1)*272);
    const dec = decBlock(rawData.slice(0, 16), kb);
    const magic = dec.readUInt32LE(0);
    if (AWC_MAGICS.includes(magic) || magic === 0x4F676753) { // also check OGG
        console.log('MATCH key[' + k + ']:', dec.toString('hex'), 'magic:', magic.toString(16));
        found = true;
    }
}
if (!found) {
    // Check what first uint32 looks like for each key
    console.log('No AWC/OGG magic found. Showing first 5 keys:');
    for (let k = 0; k < 5; k++) {
        const kb = ngKeyRaw.slice(k*272, (k+1)*272);
        const dec = decBlock(rawData.slice(0, 16), kb);
        console.log('  key[' + k + ']:', dec.slice(0,8).toString('hex'));
    }
}

// TEST 4: What if the data is NOT encrypted at all but is raw AWC (compressed audio)?
// AWC can use ADPCM which has no clear magic. Check for common patterns.
console.log('\\n--- TEST 4: Check if raw data IS valid AWC ---');
// AWC files from CodeWalker-created RPFs might use a different magic
// Some AWC files start with just raw audio data (no container header)
// Let's check byte patterns
const b0 = rawData[0], b1 = rawData[1], b2 = rawData[2], b3 = rawData[3];
console.log('First 4 bytes:', b0.toString(16), b1.toString(16), b2.toString(16), b3.toString(16));
// Check for RIFF header
if (b0 === 0x52 && b1 === 0x49) console.log('Looks like RIFF/WAV!');
// Check for fLaC
if (b0 === 0x66 && b1 === 0x4C) console.log('Looks like FLAC!');

// TEST 5: Decrypt ENTIRE RPF from byte 16 onward with key[26], then check data area
console.log('\\n--- TEST 5: Decrypt ALL bytes from 16 onward with key[26] ---');
const fullDec = ngDecrypt(rpf.slice(16, Math.min(rpf.length, 128*1024)), key26);
// Now check what's at the data offset (relative to byte 16)
const dataRelOff = e1Off - 16;
if (dataRelOff >= 0 && dataRelOff + 32 <= fullDec.length) {
    console.log('Full-decrypt data at entry1 offset:', fullDec.slice(dataRelOff, dataRelOff+32).toString('hex'));
    console.log('Magic:', fullDec.readUInt32LE(dataRelOff).toString(16));
}
`;

const conn = new Client();
conn.on('ready', async () => {
    console.log('Connected. Uploading chunk + script...');
    
    // Upload RPF chunk
    await new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            const ws = sftp.createWriteStream('/tmp/rpf_chunk.bin');
            ws.on('close', () => { sftp.end(); resolve(); });
            ws.on('error', reject);
            ws.end(chunk);
        });
    });

    // Upload script
    await new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            const ws = sftp.createWriteStream('/tmp/debug_decrypt.js');
            ws.on('close', () => { sftp.end(); resolve(); });
            ws.on('error', reject);
            ws.end(Buffer.from(vpsScript));
        });
    });

    console.log('Running debug...');
    await new Promise((resolve, reject) => {
        conn.exec('node /tmp/debug_decrypt.js', (err, stream) => {
            if (err) return reject(err);
            stream.on('data', d => process.stdout.write(d.toString()));
            stream.stderr.on('data', d => process.stderr.write(d.toString()));
            stream.on('close', code => code ? reject(new Error('exit ' + code)) : resolve());
        });
    });

    conn.end();
}).on('error', e => { console.error(e.message); process.exit(1); }).connect(SSH);
