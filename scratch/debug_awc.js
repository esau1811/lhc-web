// Debug: check if lmg_combat.awc data needs per-file NG decryption
const { Client } = require('ssh2');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const SSH = { host: '187.33.157.103', port: 22, username: 'root', password: 'diScordLhcds032.w' };

// Upload first 2MB of WEAPONS_PLAYER.rpf for debugging
const rpfBuf = fs.readFileSync('LHC Sound boost/WEAPONS_PLAYER.rpf');

// We'll send the full RPF for proper debugging
const tmpRpf = path.join(os.tmpdir(), 'debug_full_rpf.bin');
// Just send a reasonably sized chunk — header + some data (first 256KB)
fs.writeFileSync(tmpRpf, rpfBuf.slice(0, Math.min(rpfBuf.length, 1024*1024)));

const debugScript = `
const fs = require('fs');
const path = require('path');
const KEYS_DIR = '/opt/lhc-keys';

const rpfBuf   = fs.readFileSync('/tmp/debug_full_rpf.bin');
const ngKeyRaw = fs.readFileSync(path.join(KEYS_DIR, 'gtav_ng_key.dat'));
const ngTabRaw = fs.readFileSync(path.join(KEYS_DIR, 'gtav_ng_decrypt_tables.dat'));
const hashLut  = fs.readFileSync(path.join(KEYS_DIR, 'gtav_hash_lut.dat'));

// Load NG tables
const NG_TABLES = [];
let off = 0;
for (let r = 0; r < 17; r++) {
    NG_TABLES[r] = [];
    for (let t = 0; t < 16; t++) {
        const table = new Uint32Array(256);
        for (let e2 = 0; e2 < 256; e2++) { table[e2] = ngTabRaw.readUInt32LE(off); off += 4; }
        NG_TABLES[r].push(table);
    }
}

function roundA(d,sk,tbl){
    const x1=(tbl[0][d[0]]^tbl[1][d[1]]^tbl[2][d[2]]^tbl[3][d[3]]^sk[0])>>>0;
    const x2=(tbl[4][d[4]]^tbl[5][d[5]]^tbl[6][d[6]]^tbl[7][d[7]]^sk[1])>>>0;
    const x3=(tbl[8][d[8]]^tbl[9][d[9]]^tbl[10][d[10]]^tbl[11][d[11]]^sk[2])>>>0;
    const x4=(tbl[12][d[12]]^tbl[13][d[13]]^tbl[14][d[14]]^tbl[15][d[15]]^sk[3])>>>0;
    const r=Buffer.allocUnsafe(16);
    r.writeUInt32LE(x1,0);r.writeUInt32LE(x2,4);r.writeUInt32LE(x3,8);r.writeUInt32LE(x4,12);return r;
}
function roundB(d,sk,tbl){
    const x1=(tbl[0][d[0]]^tbl[7][d[7]]^tbl[10][d[10]]^tbl[13][d[13]]^sk[0])>>>0;
    const x2=(tbl[1][d[1]]^tbl[4][d[4]]^tbl[11][d[11]]^tbl[14][d[14]]^sk[1])>>>0;
    const x3=(tbl[2][d[2]]^tbl[5][d[5]]^tbl[8][d[8]]^tbl[15][d[15]]^sk[2])>>>0;
    const x4=(tbl[3][d[3]]^tbl[6][d[6]]^tbl[9][d[9]]^tbl[12][d[12]]^sk[3])>>>0;
    const r=Buffer.allocUnsafe(16);
    r.writeUInt32LE(x1,0);r.writeUInt32LE(x2,4);r.writeUInt32LE(x3,8);r.writeUInt32LE(x4,12);return r;
}
function decryptBlock(block,keyBuf){
    const sk=[];
    for(let i=0;i<17;i++) sk.push([keyBuf.readUInt32LE(i*16),keyBuf.readUInt32LE(i*16+4),keyBuf.readUInt32LE(i*16+8),keyBuf.readUInt32LE(i*16+12)]);
    let b=block;
    b=roundA(b,sk[0],NG_TABLES[0]);b=roundA(b,sk[1],NG_TABLES[1]);
    for(let k=2;k<=15;k++) b=roundB(b,sk[k],NG_TABLES[k]);
    b=roundA(b,sk[16],NG_TABLES[16]);return b;
}
function ngDecrypt(data,keyBuf){
    const out=Buffer.from(data);
    for(let b=0;b<Math.floor(data.length/16);b++){
        decryptBlock(data.slice(b*16,(b+1)*16),keyBuf).copy(out,b*16);
    }
    return out;
}

function gta5Hash(text){
    let r=0;
    for(let i=0;i<text.length;i++){
        const c=hashLut[text.charCodeAt(i)&0xFF];
        const s=(c+r)>>>0;
        const t=Math.imul(1025,s)>>>0;
        r=((t>>>6)^t)>>>0;
    }
    const r9=Math.imul(9,r)>>>0;
    return Math.imul(32769,((r9>>>11)^r9)>>>0)>>>0;
}

// 1. Decrypt RPF header with key[26]
const entryCount = rpfBuf.readUInt32LE(4);
const namesLen   = rpfBuf.readUInt32LE(8);
const blockSize  = entryCount*16 + namesLen;
const encBlock   = rpfBuf.slice(16, 16+blockSize);
const keyBuf26   = ngKeyRaw.slice(26*272, 27*272);
const decBlock   = ngDecrypt(encBlock, keyBuf26);

// 2. Parse entries
const openRpf = Buffer.from(rpfBuf);
decBlock.copy(openRpf, 16, 0, blockSize);
openRpf.writeUInt32LE(0x4E45504F, 12);

const nameTableStart = 16 + entryCount*16;
const nameTableEnd   = nameTableStart + namesLen;
const namesMap = new Map();
let p = nameTableStart;
while(p < nameTableEnd){
    const s=p-nameTableStart; let n='';
    while(p<nameTableEnd && openRpf[p]!==0) n+=String.fromCharCode(openRpf[p++]);
    namesMap.set(s,n.toLowerCase()); p++;
}

console.log('Names found:', [...namesMap.values()].join(', '));

// Find AWC entry
let awcEntry = null;
for(let i=0;i<entryCount;i++){
    const eOff=16+i*16;
    const nameOff=openRpf.readUInt16LE(eOff);
    const w4=openRpf.readUInt32LE(eOff+4);
    if(w4===0x7FFFFF00) continue;
    const name=namesMap.get(nameOff)||'';
    const uncompSize=openRpf.readUInt32LE(eOff+8);
    const w12=openRpf.readUInt32LE(eOff+12);
    // Parse the page offset from bytes 5-7 of the entry
    // Actually byte layout from v19: w4 has page in lower 23 bits
    const dataPage=(w4&0x7FFFFF);
    const dataOffset=dataPage*512;
    console.log('Entry',i,'name:',name,'w4:'+w4.toString(16),'page:'+dataPage.toString(16),'offset:'+dataOffset,'size:'+uncompSize,'w12:'+w12.toString(16));
    if(name.endsWith('.awc')) {
        awcEntry={i,name,dataOffset,uncompSize,w12,dataPage};
    }
}

if(!awcEntry){console.log('No AWC entry found!');process.exit(1);}
console.log('\\nAWC entry:', awcEntry);

// Read AWC data
const awcData = openRpf.slice(awcEntry.dataOffset, awcEntry.dataOffset + awcEntry.uncompSize);
console.log('AWC data size:', awcData.length);
console.log('AWC first 32 bytes:', awcData.slice(0,32).toString('hex'));

// Check for AWC magic (AWCV = 56 43 57 41)
const awcMagic = awcData.slice(0,4).toString('hex');
console.log('AWC magic (expected 56434741 for AWCV):', awcMagic);

// Check for OGG magic
const oggMagic = Buffer.from([0x4F,0x67,0x67,0x53]);
const oggPos = awcData.indexOf(oggMagic);
console.log('OGG in raw AWC:', oggPos >= 0 ? 'at '+oggPos : 'NOT FOUND');

if(oggPos < 0){
    console.log('\\nAWC data looks encrypted. Trying per-file NG decryption...');
    // Try with the awc filename + uncompressedSize
    const keyIdx = ((gta5Hash(awcEntry.name) + awcEntry.uncompSize + 61)>>>0) % 101;
    console.log('Hash of "'+awcEntry.name+'":', gta5Hash(awcEntry.name).toString(16));
    console.log('Per-file key index:', keyIdx);
    const fileKey = ngKeyRaw.slice(keyIdx*272,(keyIdx+1)*272);
    const decAwc  = ngDecrypt(awcData, fileKey);
    console.log('Decrypted AWC first 32:', decAwc.slice(0,32).toString('hex'));
    const oggPos2 = decAwc.indexOf(oggMagic);
    console.log('OGG after per-file decrypt:', oggPos2 >= 0 ? 'at '+oggPos2 : 'NOT FOUND');
    const awcMagic2 = decAwc.slice(0,4).toString('hex');
    console.log('AWC magic after decrypt:', awcMagic2);
}
`;

function runCmd(conn, cmd) {
    return new Promise((res,rej)=>{
        conn.exec(cmd,(e,s)=>{
            if(e) return rej(e);
            let out='';
            s.on('data',d=>{out+=d;process.stdout.write(d.toString());});
            s.stderr.on('data',d=>{out+=d;process.stderr.write(d.toString());});
            s.on('close',c=>c?rej(new Error('exit '+c)):res(out));
        });
    });
}
function uploadBuf(conn,buf,remote){
    const tmp=path.join(os.tmpdir(),'upload_'+Date.now());
    fs.writeFileSync(tmp,buf);
    return new Promise((res,rej)=>{
        conn.sftp((e,sftp)=>{
            if(e)return rej(e);
            sftp.fastPut(tmp,remote,e2=>{sftp.end();fs.unlinkSync(tmp);e2?rej(e2):res();});
        });
    });
}

async function main(){
    const conn = new Client();
    await new Promise((res,rej)=>conn.on('ready',res).on('error',rej).connect(SSH));

    console.log('Uploading RPF chunk (1MB)...');
    await uploadBuf(conn, rpfBuf.slice(0, Math.min(rpfBuf.length, 1024*1024)), '/tmp/debug_full_rpf.bin');
    await uploadBuf(conn, Buffer.from(debugScript), '/tmp/debug_awc.js');

    console.log('Running debug...\n');
    await runCmd(conn, 'node /tmp/debug_awc.js');
    conn.end();
}

main().catch(e=>{console.error(e.message);process.exit(1);});
