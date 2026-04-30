// CRITICAL TEST: Verify our NG decrypt is correct by checking header
// Then try decrypting AWC data block with ALL possible variations
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

const rpf = fs.readFileSync('/tmp/uploaded_user.rpf');

// STEP 1: Verify header decryption works (we know key[1] gives directory entry)
console.log('=== STEP 1: Verify header decrypt with key[1] ===');
const headerBlock0 = rpf.slice(16, 32); // First TOC entry
const decHeader = ngDecryptBlock(headerBlock0, GTA5_NG_KEYS[1]);
console.log('Header block[0] decrypted:', decHeader.toString('hex'));
const nameOff = decHeader.readUInt16LE(0);
const entType = decHeader.readUInt32LE(4);
console.log('nameOff=' + nameOff + ' entryType=0x' + entType.toString(16) + ' (expect 0x7fffff00 for dir)');

// STEP 2: Read the full decrypted header to get ALL entry info
console.log('\n=== STEP 2: Full header decrypt ===');
const ec = rpf.readUInt32LE(4);
const nl = rpf.readUInt32LE(8);
const hl = ec * 16 + nl;
const encHdr = rpf.slice(16, 16 + hl);
const decHdr = Buffer.alloc(hl);
for (let i = 0; i < Math.floor(hl / 16); i++) {
    ngDecryptBlock(encHdr.slice(i*16, i*16+16), GTA5_NG_KEYS[1]).copy(decHdr, i*16);
}
if (hl % 16) encHdr.slice(Math.floor(hl/16)*16).copy(decHdr, Math.floor(hl/16)*16);

const nts = ec * 16;
// Find lmg_combat.awc entry
for (let i = 0; i < ec; i++) {
    const eo = i * 16;
    const nameOff2 = decHdr.readUInt16LE(eo);
    let name = '', p = nts + nameOff2;
    while (p < nts + nl && decHdr[p] !== 0) name += String.fromCharCode(decHdr[p++]);
    if (name !== 'lmg_combat.awc') continue;
    
    const us = decHdr.readUInt32LE(eo + 8);
    const page = decHdr[eo+5] | (decHdr[eo+6]<<8) | (decHdr[eo+7]<<16);
    
    // SHOW ALL 16 BYTES of this entry
    console.log('lmg_combat.awc entry raw bytes:', decHdr.slice(eo, eo+16).toString('hex'));
    console.log('  nameOff=' + nameOff2 + ' page=' + page + ' us=' + us);
    console.log('  bytes[2-4] (cs?):', decHdr[eo+2] + ',' + decHdr[eo+3] + ',' + decHdr[eo+4]);
    console.log('  bytes[12-15]:', decHdr[eo+12] + ',' + decHdr[eo+13] + ',' + decHdr[eo+14] + ',' + decHdr[eo+15]);
    
    // STEP 3: Try decrypting AWC data with ALL 101 keys and look for valid stream count (1-4)
    console.log('\n=== STEP 3: Try ALL 101 keys on lmg_combat.awc ===');
    const awcFirst16 = rpf.slice(page * 512, page * 512 + 16);
    console.log('Raw AWC first 16 bytes:', awcFirst16.toString('hex'));
    
    let found = false;
    for (let ki = 0; ki < 101; ki++) {
        const dec = ngDecryptBlock(awcFirst16, GTA5_NG_KEYS[ki]);
        const flags = dec.readUInt32LE(0);
        const streams = flags & 0xFFF;
        const streaming = (flags >>> 31) !== 0;
        if (streams >= 1 && streams <= 4 && !streaming) {
            console.log('KEY[' + ki + ']: flags=0x' + flags.toString(16) + ' streams=' + streams + ' streaming=' + streaming + ' hex=' + dec.toString('hex') + ' << VALID!');
            found = true;
        }
    }
    if (!found) console.log('NO valid key found with simple block decrypt!');
    
    // STEP 4: Maybe data is NOT encrypted? Check raw bytes
    console.log('\n=== STEP 4: Check if AWC is UNENCRYPTED ===');
    const awcRaw512 = rpf.slice(page * 512, page * 512 + 512);
    const flags0 = awcRaw512.readUInt32LE(0);
    const streams0 = flags0 & 0xFFF;
    console.log('Raw flags=0x' + flags0.toString(16) + ' streams=' + streams0);
    // Check if it looks like valid data
    let nonZero = 0;
    for(let b=0;b<16;b++) if(awcRaw512[b]!==0) nonZero++;
    console.log('Non-zero bytes in first 16:', nonZero);
    
    break;
}
