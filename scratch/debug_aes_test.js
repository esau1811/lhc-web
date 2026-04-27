'use strict';
// VPS: node /tmp/debug_aes_test.js
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const KEYS = '/opt/lhc-keys', RPF = '/tmp/dbg_rpf.bin';
const rpf = fs.readFileSync(RPF);
const ngKeyRaw = fs.readFileSync(path.join(KEYS,'gtav_ng_key.dat'));
const ngTabRaw = fs.readFileSync(path.join(KEYS,'gtav_ng_decrypt_tables.dat'));
const hashLut  = fs.readFileSync(path.join(KEYS,'gtav_hash_lut.dat'));
const aesKey   = fs.readFileSync(path.join(KEYS,'gtav_aes_key.dat'));

// Load NG tables
const T = [];
let off = 0;
for(let r=0;r<17;r++){T[r]=[];for(let t=0;t<16;t++){const tb=new Uint32Array(256);for(let e=0;e<256;e++){tb[e]=ngTabRaw.readUInt32LE(off);off+=4;}T[r].push(tb);}}
function rA(d,sk,tb){
    const x1=(tb[0][d[0]]^tb[1][d[1]]^tb[2][d[2]]^tb[3][d[3]]^sk[0])>>>0,x2=(tb[4][d[4]]^tb[5][d[5]]^tb[6][d[6]]^tb[7][d[7]]^sk[1])>>>0;
    const x3=(tb[8][d[8]]^tb[9][d[9]]^tb[10][d[10]]^tb[11][d[11]]^sk[2])>>>0,x4=(tb[12][d[12]]^tb[13][d[13]]^tb[14][d[14]]^tb[15][d[15]]^sk[3])>>>0;
    const r=Buffer.allocUnsafe(16);r.writeUInt32LE(x1,0);r.writeUInt32LE(x2,4);r.writeUInt32LE(x3,8);r.writeUInt32LE(x4,12);return r;
}
function rB(d,sk,tb){
    const x1=(tb[0][d[0]]^tb[7][d[7]]^tb[10][d[10]]^tb[13][d[13]]^sk[0])>>>0,x2=(tb[1][d[1]]^tb[4][d[4]]^tb[11][d[11]]^tb[14][d[14]]^sk[1])>>>0;
    const x3=(tb[2][d[2]]^tb[5][d[5]]^tb[8][d[8]]^tb[15][d[15]]^sk[2])>>>0,x4=(tb[3][d[3]]^tb[6][d[6]]^tb[9][d[9]]^tb[12][d[12]]^sk[3])>>>0;
    const r=Buffer.allocUnsafe(16);r.writeUInt32LE(x1,0);r.writeUInt32LE(x2,4);r.writeUInt32LE(x3,8);r.writeUInt32LE(x4,12);return r;
}
function decBlock(blk,kb){
    const sk=[];for(let i=0;i<17;i++)sk.push([kb.readUInt32LE(i*16),kb.readUInt32LE(i*16+4),kb.readUInt32LE(i*16+8),kb.readUInt32LE(i*16+12)]);
    let b=blk;b=rA(b,sk[0],T[0]);b=rA(b,sk[1],T[1]);for(let k=2;k<=15;k++)b=rB(b,sk[k],T[k]);b=rA(b,sk[16],T[16]);return b;
}
function ngDecrypt(data,kb){
    const out=Buffer.from(data);
    for(let b=0;b<Math.floor(data.length/16);b++)decBlock(data.slice(b*16,(b+1)*16),kb).copy(out,b*16);
    return out;
}
function gta5Hash(text){
    let r=0;
    for(let i=0;i<text.length;i++){const c=hashLut[text.charCodeAt(i)&0xFF],s=(c+r)>>>0,t=Math.imul(1025,s)>>>0;r=((t>>>6)^t)>>>0;}
    const r9=Math.imul(9,r)>>>0;return Math.imul(32769,((r9>>>11)^r9)>>>0)>>>0;
}

// Decrypt header
const entryCount=rpf.readUInt32LE(4),namesLen=rpf.readUInt32LE(8);
const decHdr=ngDecrypt(rpf.slice(16,16+entryCount*16+namesLen),ngKeyRaw.slice(26*272,27*272));
const open=Buffer.from(rpf);open.writeUInt32LE(0x4E45504F,12);decHdr.copy(open,16);

// lmg_combat.awc at page 2, size 55496
const awcOff=1024, awcSz=55496;
const awcData=open.slice(awcOff,awcOff+awcSz);
const AWCV=Buffer.from([0x41,0x57,0x43,0x56]);
const OGG=Buffer.from([0x4F,0x67,0x67,0x53]);

console.log('=== lmg_combat.awc analysis ===');
console.log('Raw first 32:', awcData.slice(0,32).toString('hex'));

// AES-ECB full decrypt
function aesDecrypt(data){
    const ci=crypto.createDecipheriv('aes-256-ecb',aesKey,null);ci.setAutoPadding(false);
    const aligned=data.slice(0,Math.floor(data.length/16)*16);
    return Buffer.concat([ci.update(aligned),ci.final()]);
}
const aesDec = aesDecrypt(awcData);
console.log('AES dec first 32:', aesDec.slice(0,32).toString('hex'));
console.log('AES AWCV pos:', aesDec.indexOf(AWCV), '| OGG pos:', aesDec.indexOf(OGG));

// NG decrypt with correct key (hash+uncompSz)
const keyIdxUncomp = ((gta5Hash('lmg_combat.awc') + awcSz + 61)>>>0) % 101;
console.log('NG key index (sz='+awcSz+'):', keyIdxUncomp);
const ngDec = ngDecrypt(awcData, ngKeyRaw.slice(keyIdxUncomp*272,(keyIdxUncomp+1)*272));
console.log('NG dec first 32:', ngDec.slice(0,32).toString('hex'));
console.log('NG AWCV pos:', ngDec.indexOf(AWCV), '| OGG pos:', ngDec.indexOf(OGG));

// AES + zlib inflate?
console.log('\nAES first byte:', aesDec[0].toString(16));
if(aesDec[0] === 0x78) {
    try { const infl=zlib.inflateSync(aesDec); console.log('AES+inflate AWCV:', infl.indexOf(AWCV)); }
    catch(e) { console.log('inflate fail:', e.message.slice(0,80)); }
}

// Also: brute force all 101 NG keys looking for AWCV OR OGG in full decrypt
console.log('\nBrute force all 101 keys (full file):');
let found = false;
for(let k=0;k<101;k++){
    const d=ngDecrypt(awcData,ngKeyRaw.slice(k*272,(k+1)*272));
    if(d.indexOf(AWCV)>=0){console.log('  NG key['+k+'] AWCV found!');found=true;}
    if(d.indexOf(OGG)>=0){console.log('  NG key['+k+'] OGG found at',d.indexOf(OGG));found=true;}
}
if(!found) console.log('  No NG key gives AWCV or OGG in lmg_combat.awc');

// Check if the AWC might be for a different area (maybe offset is wrong?)
// Let's also look at the file at the FIRST page (offset 512)
console.log('\nBytes at offset 512:', open.slice(512,544).toString('hex'));
console.log('Bytes at offset 0:', open.slice(0,32).toString('hex'));
