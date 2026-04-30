"""
Dump all 23 RPF7 entries and verify what's at each file's offset.
This reveals the correct entry format and whether page offsets point to real data.
"""
import paramiko, sys, os
sys.stdout.reconfigure(encoding='utf-8')

LOCAL_RPF = os.path.join(os.path.dirname(__file__), '..', 'arma', 'WEAPONS_PLAYER.rpf')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=30)

sftp = client.open_sftp()
print('Uploading RPF...')
sftp.put(LOCAL_RPF, '/tmp/wp_diag.rpf')
sftp.close()
print('Done.')

diag_js = r"""
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const KEYS_DIR = '/opt/lhc-keys';

const rpfBuf = fs.readFileSync('/tmp/wp_diag.rpf');
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
    const sk = []; for (let i = 0; i < 17; i++) sk.push([keyBuf.readUInt32LE(i*16), keyBuf.readUInt32LE(i*16+4), keyBuf.readUInt32LE(i*16+8), keyBuf.readUInt32LE(i*16+12)]);
    const rdA = (d,s,t) => { const r=Buffer.allocUnsafe(16); r.writeUInt32LE((t[0][d[0]]^t[1][d[1]]^t[2][d[2]]^t[3][d[3]]^s[0])>>>0,0); r.writeUInt32LE((t[4][d[4]]^t[5][d[5]]^t[6][d[6]]^t[7][d[7]]^s[1])>>>0,4); r.writeUInt32LE((t[8][d[8]]^t[9][d[9]]^t[10][d[10]]^t[11][d[11]]^s[2])>>>0,8); r.writeUInt32LE((t[12][d[12]]^t[13][d[13]]^t[14][d[14]]^t[15][d[15]]^s[3])>>>0,12); return r; };
    const rdB = (d,s,t) => { const r=Buffer.allocUnsafe(16); r.writeUInt32LE((t[0][d[0]]^t[7][d[7]]^t[10][d[10]]^t[13][d[13]]^s[0])>>>0,0); r.writeUInt32LE((t[1][d[1]]^t[4][d[4]]^t[11][d[11]]^t[14][d[14]]^s[1])>>>0,4); r.writeUInt32LE((t[2][d[2]]^t[5][d[5]]^t[8][d[8]]^t[15][d[15]]^s[2])>>>0,8); r.writeUInt32LE((t[3][d[3]]^t[6][d[6]]^t[9][d[9]]^t[12][d[12]]^s[3])>>>0,12); return r; };
    let b = block; b = rdA(b, sk[0], GTA5_NG_TABLES[0]); b = rdA(b, sk[1], GTA5_NG_TABLES[1]);
    for (let k = 2; k <= 15; k++) b = rdB(b, sk[k], GTA5_NG_TABLES[k]);
    return rdA(b, sk[16], GTA5_NG_TABLES[16]);
}
function ngDecrypt(data, keyBuf) {
    const out = Buffer.from(data);
    for (let i = 0; i < Math.floor(data.length / 16); i++) ngDecryptBlock(data.slice(i*16, i*16+16), keyBuf).copy(out, i*16);
    return out;
}

const ec = rpfBuf.readUInt32LE(4);
const nl = rpfBuf.readUInt32LE(8);
const hl = ec * 16 + nl;
const encBlock = rpfBuf.slice(16, 16 + hl);
// Decrypt header with key ki=1 (we know this works)
const dh = ngDecrypt(encBlock, GTA5_NG_KEYS[1]);

console.log('ec=' + ec + ' nl=' + nl + ' hl=' + hl);
console.log('filesize=' + rpfBuf.length);
console.log('');

// Dump raw entry bytes AND parse using TWO different interpretations
const nts = ec * 16; // name table starts here within dh
console.log('=== ALL ENTRIES (raw hex + parsed) ===');
for (let i = 0; i < ec; i++) {
    const eo = i * 16;
    const raw = dh.slice(eo, eo + 16).toString('hex');

    // Read name
    const nameOff = dh.readUInt16LE(eo);
    let name = '';
    let p = nts + nameOff;
    while (p < dh.length && dh[p] !== 0) name += String.fromCharCode(dh[p++]);

    const typeField = dh.readUInt32LE(eo + 4);
    const isDir = typeField === 0x7FFFFF00;

    if (isDir) {
        const ds = dh.readUInt32LE(eo + 8);
        const dc = dh.readUInt32LE(eo + 12);
        console.log('E' + i + ' DIR  "' + name + '" start=' + ds + ' count=' + dc + ' | raw:' + raw);
    } else {
        // Interpretation A: page at bytes 5,6,7 (current code)
        const pageA = dh[eo+5] | (dh[eo+6]<<8) | (dh[eo+7]<<16);
        const usA   = dh.readUInt32LE(eo+8);
        const csA   = dh[eo+2] | (dh[eo+3]<<8) | (dh[eo+4]<<16);

        // Interpretation B: page at bytes 4,5,6 (standard RPF7)
        const pageB = dh[eo+4] | (dh[eo+5]<<8) | (dh[eo+6]<<16);
        const usB   = dh.readUInt32LE(eo+12);
        const csB   = dh.readUInt32LE(eo+8);

        const offA = pageA * 512;
        const offB = pageB * 512;

        // Check what's at each offset
        let rawA = 'OOB', rawB = 'OOB';
        if (offA + 4 <= rpfBuf.length) rawA = rpfBuf.slice(offA, offA+4).toString('hex') + '=' + rpfBuf.slice(offA, offA+4).toString('ascii').replace(/[^\x20-\x7e]/g,'?');
        if (offB + 4 <= rpfBuf.length) rawB = rpfBuf.slice(offB, offB+4).toString('hex') + '=' + rpfBuf.slice(offB, offB+4).toString('ascii').replace(/[^\x20-\x7e]/g,'?');

        console.log('E' + i + ' FILE "' + name + '"');
        console.log('      raw:' + raw);
        console.log('      InterpA: page=' + pageA + ' us=' + usA + ' cs=' + csA + ' off=' + offA + ' -> [' + rawA + ']');
        console.log('      InterpB: page=' + pageB + ' us=' + usB + ' cs=' + csB + ' off=' + offB + ' -> [' + rawB + ']');
    }
}

// Now check bytes 0-4 of each entry to understand byte 4 role
console.log('\n=== ENTRY BYTE LAYOUT DETAIL (bytes 0-7) ===');
for (let i = 0; i < ec; i++) {
    const eo = i * 16;
    const b = dh;
    console.log('E' + i + ': [' + b[eo].toString(16).padStart(2,'0') + ' ' + b[eo+1].toString(16).padStart(2,'0') + ' ' + b[eo+2].toString(16).padStart(2,'0') + ' ' + b[eo+3].toString(16).padStart(2,'0') + '] [' + b[eo+4].toString(16).padStart(2,'0') + ' ' + b[eo+5].toString(16).padStart(2,'0') + ' ' + b[eo+6].toString(16).padStart(2,'0') + ' ' + b[eo+7].toString(16).padStart(2,'0') + '] [' + b[eo+8].toString(16).padStart(2,'0') + ' ' + b[eo+9].toString(16).padStart(2,'0') + ' ' + b[eo+10].toString(16).padStart(2,'0') + ' ' + b[eo+11].toString(16).padStart(2,'0') + '] [' + b[eo+12].toString(16).padStart(2,'0') + ' ' + b[eo+13].toString(16).padStart(2,'0') + ' ' + b[eo+14].toString(16).padStart(2,'0') + ' ' + b[eo+15].toString(16).padStart(2,'0') + ']');
}
"""

with client.open_sftp() as sftp2:
    with sftp2.open('/tmp/vps_diag_entries.js', 'w') as f:
        f.write(diag_js)

print('Running entries diagnostic...')
_, out, err = client.exec_command('node /tmp/vps_diag_entries.js 2>&1', timeout=60)
output = out.read().decode(errors='replace')
print(output)

client.exec_command('rm /tmp/wp_diag.rpf /tmp/vps_diag_entries.js')
client.close()
print('\nDone.')
