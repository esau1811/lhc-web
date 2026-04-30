"""
Deep NG diagnostic: runs ON the VPS to test NG decryption of data sectors.
Sends the original RPF, then checks:
  1. Which NG key decrypts the HEADER correctly (proves NG impl works)
  2. Which NG key (if any) decrypts the DATA sector to show ADAT
  3. Whether AES decryption reveals ADAT in the data sector
"""
import paramiko, sys, os
sys.stdout.reconfigure(encoding='utf-8')

LOCAL_RPF = os.path.join(os.path.dirname(__file__), '..', 'arma', 'WEAPONS_PLAYER.rpf')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=30)

sftp = client.open_sftp()

# Upload original RPF to /tmp on VPS
print('Uploading WEAPONS_PLAYER.rpf to VPS /tmp...')
sftp.put(LOCAL_RPF, '/tmp/wp_orig.rpf')
print('Done.')

# Node.js diagnostic script to run on VPS
diag_js = r"""
'use strict';
const fs = require('fs');
const crypto = require('crypto');

const KEYS_DIR = '/opt/lhc-keys';
const rpfBuf = fs.readFileSync('/tmp/wp_orig.rpf');

// Load NG keys and tables
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

const GTA5_AES_KEY = fs.readFileSync(KEYS_DIR + '/gtav_aes_key.dat');
console.log('Keys loaded: NG=' + GTA5_NG_KEYS.length + ' AES=' + GTA5_AES_KEY.length + ' bytes');

function ngDecryptBlock(block, keyBuf) {
    const sk = []; for (let i = 0; i < 17; i++) sk.push([keyBuf.readUInt32LE(i*16), keyBuf.readUInt32LE(i*16+4), keyBuf.readUInt32LE(i*16+8), keyBuf.readUInt32LE(i*16+12)]);
    const rdA = (d,s,t) => { const r=Buffer.allocUnsafe(16); r.writeUInt32LE((t[0][d[0]]^t[1][d[1]]^t[2][d[2]]^t[3][d[3]]^s[0])>>>0,0); r.writeUInt32LE((t[4][d[4]]^t[5][d[5]]^t[6][d[6]]^t[7][d[7]]^s[1])>>>0,4); r.writeUInt32LE((t[8][d[8]]^t[9][d[9]]^t[10][d[10]]^t[11][d[11]]^s[2])>>>0,8); r.writeUInt32LE((t[12][d[12]]^t[13][d[13]]^t[14][d[14]]^t[15][d[15]]^s[3])>>>0,12); return r; };
    const rdB = (d,s,t) => { const r=Buffer.allocUnsafe(16); r.writeUInt32LE((t[0][d[0]]^t[7][d[7]]^t[10][d[10]]^t[13][d[13]]^s[0])>>>0,0); r.writeUInt32LE((t[1][d[1]]^t[4][d[4]]^t[11][d[11]]^t[14][d[14]]^s[1])>>>0,4); r.writeUInt32LE((t[2][d[2]]^t[5][d[5]]^t[8][d[8]]^t[15][d[15]]^s[2])>>>0,8); r.writeUInt32LE((t[3][d[3]]^t[6][d[6]]^t[9][d[9]]^t[12][d[12]]^s[3])>>>0,12); return r; };
    let b = block; b = rdA(b, sk[0], GTA5_NG_TABLES[0]); b = rdA(b, sk[1], GTA5_NG_TABLES[1]);
    for (let k = 2; k <= 15; k++) b = rdB(b, sk[k], GTA5_NG_TABLES[k]);
    return rdA(b, sk[16], GTA5_NG_TABLES[16]);
}

// --- 1. TEST HEADER DECRYPTION ---
console.log('\n=== HEADER BLOCK TEST ===');
const hdrBlock = rpfBuf.slice(16, 32); // first 16 bytes of encrypted header
console.log('Encrypted header block[0]: ' + hdrBlock.toString('hex'));
let hdrKeyFound = -1;
for (let ki = 0; ki < 101; ki++) {
    const dec = ngDecryptBlock(hdrBlock, GTA5_NG_KEYS[ki]);
    // Valid root dir entry: bytes 0-1 = 0x0000, bytes 4-7 = 0x7FFFFF00
    if (dec.readUInt16LE(0) === 0 && dec.readUInt32LE(4) === 0x7FFFFF00) {
        console.log('HEADER KEY FOUND: ki=' + ki + ' decrypted=' + dec.toString('hex'));
        hdrKeyFound = ki;
        break;
    }
}
if (hdrKeyFound === -1) {
    console.log('WARNING: No NG key decrypts header to valid root dir entry!');
    // Show first few decryption results for debugging
    for (let ki = 0; ki < 5; ki++) {
        const dec = ngDecryptBlock(hdrBlock, GTA5_NG_KEYS[ki]);
        console.log('  key[' + ki + ']: ' + dec.toString('hex'));
    }
}

// --- 2. TEST DATA SECTOR (page 1089 * 512 = 557568) ---
const DATA_OFF = 1089 * 512;
console.log('\n=== DATA SECTOR TEST (offset ' + DATA_OFF + ') ===');
const dataBlock0 = rpfBuf.slice(DATA_OFF, DATA_OFF + 16);
console.log('Raw data block[0]: ' + dataBlock0.toString('hex'));

// Check for ADAT plaintext
if (dataBlock0.slice(0,4).toString('ascii') === 'ADAT') {
    console.log('DATA IS PLAINTEXT - ADAT found at start!');
}

// Try all 101 NG keys on block 0
console.log('Trying all 101 NG keys on data block[0]...');
let dataKeyFound = -1;
for (let ki = 0; ki < 101; ki++) {
    const dec = ngDecryptBlock(dataBlock0, GTA5_NG_KEYS[ki]);
    if (dec.slice(0,4).toString('ascii') === 'ADAT') {
        console.log('DATA NG KEY FOUND (block 0): ki=' + ki + ' dec=' + dec.toString('hex'));
        dataKeyFound = ki;
    }
}

// Try all 101 NG keys on blocks 0..7
if (dataKeyFound === -1) {
    console.log('No NG key found ADAT in block 0. Trying blocks 0-7...');
    for (let b = 0; b < 8; b++) {
        const blk = rpfBuf.slice(DATA_OFF + b*16, DATA_OFF + (b+1)*16);
        for (let ki = 0; ki < 101; ki++) {
            const dec = ngDecryptBlock(blk, GTA5_NG_KEYS[ki]);
            if (dec.indexOf(Buffer.from('ADAT')) !== -1) {
                console.log('DATA NG KEY FOUND (block ' + b + '): ki=' + ki + ' dec=' + dec.toString('hex'));
            }
        }
    }
}

// Try AES decryption on first 32 bytes of data sector
console.log('Trying AES decryption on data sector...');
try {
    const d = crypto.createDecipheriv('aes-256-ecb', GTA5_AES_KEY, null);
    d.setAutoPadding(false);
    const dec32 = Buffer.concat([d.update(rpfBuf.slice(DATA_OFF, DATA_OFF+32)), d.final()]);
    console.log('AES decrypted first 32 bytes: ' + dec32.toString('hex'));
    if (dec32.indexOf(Buffer.from('ADAT')) !== -1) {
        console.log('AES DECRYPTION REVEALS ADAT!');
    }
} catch(e) { console.log('AES decrypt error: ' + e.message); }

// --- 3. SHOW FIRST 32 BYTES OF EACH KEY'S BLOCK-0 DECRYPTION ---
console.log('\n=== FIRST 4 BYTES OF ALL 101 KEY DECRYPTIONS (data block 0) ===');
for (let ki = 0; ki < 101; ki++) {
    const dec = ngDecryptBlock(dataBlock0, GTA5_NG_KEYS[ki]);
    console.log('ki=' + String(ki).padStart(3) + ': ' + dec.slice(0,8).toString('hex'));
}
"""

# Write diagnostic script to VPS
with client.open_sftp() as sftp2:
    with sftp2.open('/tmp/vps_diag_ng.js', 'w') as f:
        f.write(diag_js)

print('\nRunning diagnostic on VPS...')
_, out, err = client.exec_command('node /tmp/vps_diag_ng.js 2>&1', timeout=60)
output = out.read().decode(errors='replace')
errout = err.read().decode(errors='replace')
print(output)
if errout.strip():
    print('STDERR:', errout)

# Cleanup
client.exec_command('rm /tmp/wp_orig.rpf /tmp/vps_diag_ng.js')
client.close()
print('\nDone.')
