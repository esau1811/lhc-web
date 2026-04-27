'use strict';
// VPS: node /tmp/debug_full_entry.js
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const KEYS = '/opt/lhc-keys';
const RPF  = '/tmp/dbg_rpf.bin';

const rpf      = fs.readFileSync(RPF);
const ngKeyRaw = fs.readFileSync(path.join(KEYS, 'gtav_ng_key.dat'));
const ngTabRaw = fs.readFileSync(path.join(KEYS, 'gtav_ng_decrypt_tables.dat'));
const hashLut  = fs.readFileSync(path.join(KEYS, 'gtav_hash_lut.dat'));
const aesKey   = fs.readFileSync(path.join(KEYS, 'gtav_aes_key.dat'));

// NG tables
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
    let b=blk;b=rA(b,sk[0],NG_TABLES[0]);b=rA(b,sk[1],NG_TABLES[1]);
    for(let k=2;k<=15;k++)b=rB(b,sk[k],NG_TABLES[k]);
    b=rA(b,sk[16],NG_TABLES[16]);return b;
}
function ngDecrypt(data,kb){
    const out=Buffer.from(data);
    for(let b=0;b<Math.floor(data.length/16);b++)decBlock(data.slice(b*16,(b+1)*16),kb).copy(out,b*16);
    return out;
}
function hash(text){
    let r=0;
    for(let i=0;i<text.length;i++){
        const c=hashLut[text.charCodeAt(i)&0xFF];
        const s=(c+r)>>>0,t=Math.imul(1025,s)>>>0;r=((t>>>6)^t)>>>0;
    }
    const r9=Math.imul(9,r)>>>0;return Math.imul(32769,((r9>>>11)^r9)>>>0)>>>0;
}

// Decrypt header with key[26]
const entryCount = rpf.readUInt32LE(4);
const namesLen   = rpf.readUInt32LE(8);
const encBlock   = rpf.slice(16, 16+entryCount*16+namesLen);
const dec        = ngDecrypt(encBlock, ngKeyRaw.slice(26*272, 27*272));
const open       = Buffer.from(rpf);
open.writeUInt32LE(0x4E45504F, 12);
dec.copy(open, 16, 0, encBlock.length);

// Parse names
const ntStart=16+entryCount*16, ntEnd=ntStart+namesLen;
const names=new Map();
let p=ntStart;
while(p<ntEnd){const s=p-ntStart;let n='';while(p<ntEnd&&open[p]!==0)n+=String.fromCharCode(open[p++]);names.set(s,n.toLowerCase());p++;}

// Print FULL entry bytes for first 5 file entries
console.log('=== FULL ENTRY BYTES (after header decryption) ===');
for(let i=0;i<Math.min(entryCount,6);i++){
    const eOff=16+i*16;
    const raw=open.slice(eOff,eOff+16).toString('hex');
    const nameOff=open.readUInt16LE(eOff);
    const w2=open.readUInt16LE(eOff+2);
    const w4=open.readUInt32LE(eOff+4);
    const w8=open.readUInt32LE(eOff+8);
    const w12=open.readUInt32LE(eOff+12);
    const page=open[eOff+5]|(open[eOff+6]<<8)|(open[eOff+7]<<16);
    const name=names.get(nameOff)||'(dir or unknown)';
    if(w4===0x7FFFFF00){console.log(`Entry ${i}: DIR  | raw=${raw}`);continue;}
    // Treat bytes[2-4] as 3-byte compressed size (LE)
    const compSize = w2 | ((w4&0xFF)<<16);
    console.log(`Entry ${i}: "${name}"`);
    console.log(`  raw=${raw}`);
    console.log(`  nameOff=${nameOff} w2(bytes2-3)=0x${w2.toString(16)} w4(bytes4-7)=0x${w4.toString(16).padStart(8,'0')} w8(bytes8-11)=${w8} w12(bytes12-15)=0x${w12.toString(16)}`);
    console.log(`  page(bytes5-7)=${page} off=${page*512} compSize(bytes2-4 as 3-byte LE)=${compSize} uncompSize(bytes8-11)=${w8}`);
}

// Focus on lmg_combat.awc (entry 1)
const eOff=16+1*16;
const nameOff=open.readUInt16LE(eOff);
const w2=open.readUInt16LE(eOff+2);
const w4=open.readUInt32LE(eOff+4);
const page=open[eOff+5]|(open[eOff+6]<<8)|(open[eOff+7]<<16);
const uncompSz=open.readUInt32LE(eOff+8);
const compSz3 = w2 | ((w4&0xFF)<<16);  // bytes[2-4] as 3-byte LE
const name='lmg_combat.awc';

console.log(`\n=== TESTING lmg_combat.awc ===`);
console.log(`page=${page} off=${page*512} compSz3=${compSz3} uncompSz=${uncompSz}`);

// Read the on-disk data using compSz3 (bytes[2-4]) as size
const awcOffDisk = page * 512;
const awcDataComp = open.slice(awcOffDisk, awcOffDisk + compSz3);
const awcDataUncomp = open.slice(awcOffDisk, awcOffDisk + uncompSz);

console.log(`compSz3 bytes at offset ${awcOffDisk}:`, awcDataComp.slice(0,8).toString('hex'));
console.log(`uncompSz bytes at offset ${awcOffDisk}:`, awcDataUncomp.slice(0,8).toString('hex'));

const keyIdx = ((hash(name) + uncompSz + 61)>>>0) % 101;
const keyIdxComp = ((hash(name) + compSz3 + 61)>>>0) % 101;
console.log(`keyIdx (uncompSz=${uncompSz}): ${keyIdx}`);
console.log(`keyIdx (compSz3=${compSz3}): ${keyIdxComp}`);

// Try NG decryption with both sizes as key formula
const dec1 = ngDecrypt(awcDataUncomp.slice(0,16), ngKeyRaw.slice(keyIdx*272,(keyIdx+1)*272));
const dec2 = ngDecrypt(awcDataComp.slice(0,16), ngKeyRaw.slice(keyIdxComp*272,(keyIdxComp+1)*272));
console.log(`NG dec (keyIdx=${keyIdx}): ${dec1.toString('hex')} | AWCV? ${dec1.readUInt32LE(0)===0x56435741}`);
console.log(`NG dec (keyIdxComp=${keyIdxComp}): ${dec2.toString('hex')} | AWCV? ${dec2.readUInt32LE(0)===0x56435741}`);

// Try AES-ECB decryption
try{
    const decipher = crypto.createDecipheriv('aes-256-ecb', aesKey, null);
    decipher.setAutoPadding(false);
    const block = awcDataUncomp.slice(0,16);
    const aesDecBlock = Buffer.concat([decipher.update(block), decipher.final()]);
    console.log(`AES-ECB dec first block: ${aesDecBlock.toString('hex')} | AWCV? ${aesDecBlock.readUInt32LE(0)===0x56435741}`);
}catch(e){console.log('AES error:', e.message);}

// Brute-force NG with ALL keys + try INFLATE after
console.log('\nBrute-forcing: find AWCV or zlib header after NG decryption...');
let awcFound=false, zlibFound=false;
for(let k=0;k<101;k++){
    const d=ngDecrypt(awcDataUncomp.slice(0,16),ngKeyRaw.slice(k*272,(k+1)*272));
    const m=d.readUInt32LE(0);
    if(m===0x56435741){console.log(`AWCV at key[${k}]! ${d.toString('hex')}`);awcFound=true;}
    if(d[0]===0x78){
        // Possible zlib header
        try{
            const fullDec=ngDecrypt(awcDataUncomp,ngKeyRaw.slice(k*272,(k+1)*272));
            const inflated=require('zlib').inflateSync(fullDec.slice(0,compSz3||uncompSz));
            if(inflated.readUInt32LE(0)===0x56435741){
                console.log(`AWCV after zlib inflate using key[${k}]! inflated sz=${inflated.length}`);awcFound=true;
            }
        }catch(e){}
        console.log(`zlib-like start at key[${k}]: ${d.toString('hex')}`);zlibFound=true;
    }
}
if(!awcFound) console.log('No AWCV found with any NG key.');
if(!zlibFound) console.log('No zlib-like result found.');

// Check if raw data might just be unencrypted (AWC or OGG anywhere in first 256 bytes)
const oggMagic=Buffer.from([0x4F,0x67,0x67,0x53]);
const awcMagicBuf=Buffer.from([0x41,0x57,0x43,0x56]);
console.log('\nRaw data scan (first 256 bytes):');
console.log('  OGG magic:', awcDataUncomp.slice(0,256).indexOf(oggMagic));
console.log('  AWC magic:', awcDataUncomp.slice(0,256).indexOf(awcMagicBuf));
console.log('  First 64 bytes:', awcDataUncomp.slice(0,64).toString('hex'));
