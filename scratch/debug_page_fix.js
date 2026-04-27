'use strict';
// Debug: verify page offset fix + AWC data after per-file NG decrypt
const { Client } = require('ssh2');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const SSH = { host: '187.33.157.103', port: 22, username: 'root', password: 'diScordLhcds032.w' };

const rpfBuf = fs.readFileSync('LHC Sound boost/WEAPONS_PLAYER.rpf');

const script = `
'use strict';
const fs   = require('fs');
const path = require('path');
const KEYS = '/opt/lhc-keys';
const RPF  = '/tmp/dbg_rpf.bin';

const rpf      = fs.readFileSync(RPF);
const ngKeyRaw = fs.readFileSync(path.join(KEYS,'gtav_ng_key.dat'));
const ngTabRaw = fs.readFileSync(path.join(KEYS,'gtav_ng_decrypt_tables.dat'));
const hashLut  = fs.readFileSync(path.join(KEYS,'gtav_hash_lut.dat'));

// Load NG tables
const NG_TABLES = [];
let off = 0;
for(let r=0;r<17;r++){NG_TABLES[r]=[];for(let t=0;t<16;t++){const tb=new Uint32Array(256);for(let e=0;e<256;e++){tb[e]=ngTabRaw.readUInt32LE(off);off+=4;}NG_TABLES[r].push(tb);}}

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
  let b=blk;
  b=rA(b,sk[0],NG_TABLES[0]);b=rA(b,sk[1],NG_TABLES[1]);
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
  const r9=Math.imul(9,r)>>>0;
  return Math.imul(32769,((r9>>>11)^r9)>>>0)>>>0;
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
let p=ntStart;
while(p<ntEnd){const s=p-ntStart;let n='';while(p<ntEnd&&open[p]!==0)n+=String.fromCharCode(open[p++]);names.set(s,n.toLowerCase());p++;}

console.log('Total entries:', entryCount);
console.log('Names:', [...names.values()].slice(0,5).join(', '), '...');

// 3. Show first 5 file entries with page+size
let awcEntry = null;
for(let i=0;i<Math.min(entryCount,25);i++){
  const eOff=16+i*16;
  const nameOff=open.readUInt16LE(eOff);
  const w4=open.readUInt32LE(eOff+4);
  if(w4===0x7FFFFF00){console.log('Entry',i,': DIR');continue;}
  const name=names.get(nameOff)||'';
  const pageV4=(w4&0x7FFFFF);
  const pageFix=open[eOff+5]|(open[eOff+6]<<8)|(open[eOff+7]<<16);
  const sz=open.readUInt32LE(eOff+8);
  console.log('Entry',i,name,'| w4=0x'+w4.toString(16),' pageV4='+pageV4,'(off='+pageV4*512+') pageFix='+pageFix,'(off='+pageFix*512+') sz='+sz);
  if(!awcEntry && name.endsWith('.awc')) awcEntry={i,name,pageFix,sz};
}

if(!awcEntry){console.log('No AWC found!');process.exit(1);}
console.log('\\nTesting AWC entry:', awcEntry.name, 'pageFix='+awcEntry.pageFix, 'off='+(awcEntry.pageFix*512), 'sz='+awcEntry.sz);

const awcRaw=open.slice(awcEntry.pageFix*512, awcEntry.pageFix*512+awcEntry.sz);
console.log('Raw AWC first 32:', awcRaw.slice(0,32).toString('hex'));

const keyIdx=((hash(awcEntry.name)+awcEntry.sz+61)>>>0)%101;
console.log('Key index for '+awcEntry.name+' sz='+awcEntry.sz+':', keyIdx);
const awcDec=ngDecrypt(awcRaw,ngKeyRaw.slice(keyIdx*272,(keyIdx+1)*272));
console.log('Dec AWC first 32:', awcDec.slice(0,32).toString('hex'));

const oggMagic=Buffer.from([0x4F,0x67,0x67,0x53]);
console.log('OGG in raw:', awcRaw.indexOf(oggMagic)>=0?'YES at '+awcRaw.indexOf(oggMagic):'NO');
console.log('OGG in dec:', awcDec.indexOf(oggMagic)>=0?'YES at '+awcDec.indexOf(oggMagic):'NO');

// AWC magic: 56 43 57 41 = "VCWA"  (little-endian "AWCV")
const awcMagicLE=awcDec.readUInt32LE(0);
console.log('AWC magic (dec[0..3]):', awcDec.slice(0,4).toString('hex'), '(AWCV LE = 56435741, want 41574356 as uint32LE... actually: 41574356)');

// Try all 101 keys to see which gives AWC magic
const AWC_MAGIC_LE=0x41574356; // "AWCV" as uint32LE at offset 0
for(let k=0;k<101;k++){
  const d=ngDecrypt(awcRaw.slice(0,16),ngKeyRaw.slice(k*272,(k+1)*272));
  const m=d.readUInt32LE(0);
  if(m===AWC_MAGIC_LE){console.log('AWC magic MATCH at key['+k+']! First block dec:',d.toString('hex'));}
}
`;

async function runOnVps() {
    const conn = new Client();
    await new Promise((r,j)=>conn.on('ready',r).on('error',j).connect(SSH));

    // Upload full RPF
    console.log('Uploading RPF...');
    await new Promise((r,j)=>conn.sftp((e,sftp)=>{
        if(e)return j(e);
        const tmp = path.join(os.tmpdir(),'dbg_rpf.bin');
        fs.writeFileSync(tmp, rpfBuf);
        sftp.fastPut(tmp, '/tmp/dbg_rpf.bin', e2=>{sftp.end();e2?j(e2):r();});
    }));
    console.log('Uploaded. Running debug...\n');

    await new Promise((r,j)=>conn.exec(`node -e ${JSON.stringify(script)}`, (e,s)=>{
        if(e)return j(e);
        s.on('data',d=>process.stdout.write(d.toString()));
        s.stderr.on('data',d=>process.stderr.write(d.toString()));
        s.on('close',c=>c?j(new Error('exit '+c)):r());
    }));
    conn.end();
}

runOnVps().catch(e=>{console.error(e.message);process.exit(1);});
