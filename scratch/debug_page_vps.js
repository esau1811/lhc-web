'use strict';
// Runs ON VPS: node /tmp/debug_page_vps.js
const fs   = require('fs');
const path = require('path');
const KEYS = '/opt/lhc-keys';
const RPF  = '/tmp/dbg_rpf.bin';

const rpf      = fs.readFileSync(RPF);
const ngKeyRaw = fs.readFileSync(path.join(KEYS, 'gtav_ng_key.dat'));
const ngTabRaw = fs.readFileSync(path.join(KEYS, 'gtav_ng_decrypt_tables.dat'));
const hashLut  = fs.readFileSync(path.join(KEYS, 'gtav_hash_lut.dat'));

// Load NG tables
const NG_TABLES = [];
let off = 0;
for (let r = 0; r < 17; r++) {
    NG_TABLES[r] = [];
    for (let t = 0; t < 16; t++) {
        const tb = new Uint32Array(256);
        for (let e = 0; e < 256; e++) { tb[e] = ngTabRaw.readUInt32LE(off); off += 4; }
        NG_TABLES[r].push(tb);
    }
}

function rA(d, sk, tb) {
    const x1 = (tb[0][d[0]]^tb[1][d[1]]^tb[2][d[2]]^tb[3][d[3]]^sk[0])>>>0;
    const x2 = (tb[4][d[4]]^tb[5][d[5]]^tb[6][d[6]]^tb[7][d[7]]^sk[1])>>>0;
    const x3 = (tb[8][d[8]]^tb[9][d[9]]^tb[10][d[10]]^tb[11][d[11]]^sk[2])>>>0;
    const x4 = (tb[12][d[12]]^tb[13][d[13]]^tb[14][d[14]]^tb[15][d[15]]^sk[3])>>>0;
    const r = Buffer.allocUnsafe(16);
    r.writeUInt32LE(x1,0); r.writeUInt32LE(x2,4); r.writeUInt32LE(x3,8); r.writeUInt32LE(x4,12); return r;
}
function rB(d, sk, tb) {
    const x1 = (tb[0][d[0]]^tb[7][d[7]]^tb[10][d[10]]^tb[13][d[13]]^sk[0])>>>0;
    const x2 = (tb[1][d[1]]^tb[4][d[4]]^tb[11][d[11]]^tb[14][d[14]]^sk[1])>>>0;
    const x3 = (tb[2][d[2]]^tb[5][d[5]]^tb[8][d[8]]^tb[15][d[15]]^sk[2])>>>0;
    const x4 = (tb[3][d[3]]^tb[6][d[6]]^tb[9][d[9]]^tb[12][d[12]]^sk[3])>>>0;
    const r = Buffer.allocUnsafe(16);
    r.writeUInt32LE(x1,0); r.writeUInt32LE(x2,4); r.writeUInt32LE(x3,8); r.writeUInt32LE(x4,12); return r;
}
function decBlock(blk, kb) {
    const sk = [];
    for (let i = 0; i < 17; i++) sk.push([kb.readUInt32LE(i*16), kb.readUInt32LE(i*16+4), kb.readUInt32LE(i*16+8), kb.readUInt32LE(i*16+12)]);
    let b = blk;
    b = rA(b,sk[0],NG_TABLES[0]); b = rA(b,sk[1],NG_TABLES[1]);
    for (let k = 2; k <= 15; k++) b = rB(b,sk[k],NG_TABLES[k]);
    b = rA(b,sk[16],NG_TABLES[16]); return b;
}
function ngDecrypt(data, kb) {
    const out = Buffer.from(data);
    for (let b = 0; b < Math.floor(data.length / 16); b++) decBlock(data.slice(b*16,(b+1)*16), kb).copy(out, b*16);
    return out;
}
function hash(text) {
    let r = 0;
    for (let i = 0; i < text.length; i++) {
        const c = hashLut[text.charCodeAt(i) & 0xFF];
        const s = (c + r) >>> 0, t = Math.imul(1025, s) >>> 0; r = ((t >>> 6) ^ t) >>> 0;
    }
    const r9 = Math.imul(9, r) >>> 0;
    return Math.imul(32769, ((r9 >>> 11) ^ r9) >>> 0) >>> 0;
}

// 1. Decrypt header with key[26] (known correct for WEAPONS_PLAYER.rpf)
const entryCount = rpf.readUInt32LE(4);
const namesLen   = rpf.readUInt32LE(8);
const encBlock   = rpf.slice(16, 16 + entryCount*16 + namesLen);
const key26      = ngKeyRaw.slice(26*272, 27*272);
const dec        = ngDecrypt(encBlock, key26);

const open = Buffer.from(rpf);
open.writeUInt32LE(0x4E45504F, 12);
dec.copy(open, 16, 0, encBlock.length);

// 2. Parse names
const ntStart = 16 + entryCount*16;
const ntEnd   = ntStart + namesLen;
const names   = new Map();
let p = ntStart;
while (p < ntEnd) {
    const s = p - ntStart; let n = '';
    while (p < ntEnd && open[p] !== 0) n += String.fromCharCode(open[p++]);
    names.set(s, n.toLowerCase()); p++;
}

console.log('Total entries:', entryCount);

// 3. Show entries, compare old vs new page offset formula
let awcEntry = null;
for (let i = 0; i < Math.min(entryCount, 30); i++) {
    const eOff   = 16 + i * 16;
    const nameOff = open.readUInt16LE(eOff);
    const w4      = open.readUInt32LE(eOff + 4);
    if (w4 === 0x7FFFFF00) { console.log('Entry', i, ': DIR'); continue; }
    const name    = names.get(nameOff) || '';
    const pageOld = (w4 & 0x7FFFFF);
    const pageNew = open[eOff+5] | (open[eOff+6]<<8) | (open[eOff+7]<<16);
    const sz      = open.readUInt32LE(eOff + 8);
    console.log(`Entry ${i} "${name}" | bytes[4-7]=0x${w4.toString(16).padStart(8,'0')} | pageOld=${pageOld}(off=${pageOld*512}) | pageNew=${pageNew}(off=${pageNew*512}) | sz=${sz}`);
    if (!awcEntry && name.endsWith('.awc')) awcEntry = { i, name, page: pageNew, sz };
}

if (!awcEntry) { console.log('No AWC found!'); process.exit(1); }

const awcOff = awcEntry.page * 512;
console.log(`\nAWC: "${awcEntry.name}" page=${awcEntry.page} off=${awcOff} sz=${awcEntry.sz}`);

const awcRaw = open.slice(awcOff, awcOff + awcEntry.sz);
console.log('Raw first 32:', awcRaw.slice(0, 32).toString('hex'));

const keyIdx = ((hash(awcEntry.name) + awcEntry.sz + 61) >>> 0) % 101;
console.log(`hash("${awcEntry.name}") = 0x${hash(awcEntry.name).toString(16)}, keyIdx = ${keyIdx}`);

const awcDec = ngDecrypt(awcRaw, ngKeyRaw.slice(keyIdx*272, (keyIdx+1)*272));
console.log('Dec  first 32:', awcDec.slice(0, 32).toString('hex'));

const oggMagic = Buffer.from([0x4F, 0x67, 0x67, 0x53]);
const rawOgg   = awcRaw.indexOf(oggMagic);
const decOgg   = awcDec.indexOf(oggMagic);
console.log('OGG in raw:', rawOgg >= 0 ? 'YES at 0x' + rawOgg.toString(16) : 'NO');
console.log('OGG in dec:', decOgg >= 0 ? 'YES at 0x' + decOgg.toString(16) : 'NO');

// AWC magic = "AWCV" = bytes 41 57 43 56, readUInt32LE = 0x56435741
console.log('dec readUInt32LE(0) = 0x' + awcDec.readUInt32LE(0).toString(16),
    '(AWC magic would be 0x56435741)');

// Brute-force: find which key gives AWC magic in first block
console.log('\nBrute-forcing AWC magic (first 16 bytes)...');
let found = false;
for (let k = 0; k < 101; k++) {
    const d = ngDecrypt(awcRaw.slice(0, 16), ngKeyRaw.slice(k*272, (k+1)*272));
    const m = d.readUInt32LE(0);
    if (m === 0x56435741) { console.log(`AWC magic MATCH at key[${k}]! dec: ${d.toString('hex')}`); found = true; }
}
if (!found) console.log('No key gives AWC magic 0x56435741 for first block');

// Also try the "w4 & 0x7FFFFF" (old) offset just to see what it reads
const awcOffOld = (awcEntry.i > 0 ? ((open.readUInt32LE(16 + awcEntry.i*16 + 4)) & 0x7FFFFF) : 0) * 512;
console.log('\nFor comparison, old page formula would give offset:', awcOffOld);
if (awcOffOld < open.length) console.log('Data at old offset first 16:', open.slice(awcOffOld, awcOffOld+16).toString('hex'));
