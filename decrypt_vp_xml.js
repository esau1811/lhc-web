// Decrypt NG-encrypted XML files from the Vintage Pistol RPF
// Uses keys/gtav_ng_key.dat + keys/gtav_ng_decrypt_tables.dat

const fs = require('fs');
const path = require('path');

const KEYS_DIR = path.join(__dirname, 'keys');

// ---- Load keys ----
const keyBytes   = fs.readFileSync(path.join(KEYS_DIR, 'gtav_ng_key.dat'));
const tableBytes = fs.readFileSync(path.join(KEYS_DIR, 'gtav_ng_decrypt_tables.dat'));

const KEY_SIZE  = 272;
const KEY_COUNT = 101;

// Each key = 272 bytes = 68 uint32s
const ngKeys = [];
for (let i = 0; i < KEY_COUNT; i++) {
    const k = new Uint32Array(KEY_SIZE / 4);
    for (let j = 0; j < KEY_SIZE / 4; j++)
        k[j] = keyBytes.readUInt32LE(i * KEY_SIZE + j * 4);
    ngKeys.push(k);
}

// Decrypt tables: [17][16][256] uint32
const tables = [];
let tOff = 0;
for (let i = 0; i < 17; i++) {
    tables.push([]);
    for (let j = 0; j < 16; j++) {
        const sub = new Uint32Array(256);
        for (let k = 0; k < 256; k++, tOff += 4)
            sub[k] = tableBytes.readUInt32LE(tOff);
        tables[i].push(sub);
    }
}

// ---- NG cipher ----
function jenkinsHash(name) {
    let h = 0;
    for (const c of name.toLowerCase()) {
        h = (h + c.charCodeAt(0)) >>> 0;
        h = (h + (h << 10)) >>> 0;
        h ^= (h >>> 6);
    }
    h = (h + (h << 3)) >>> 0;
    h ^= (h >>> 11);
    h = (h + (h << 15)) >>> 0;
    return h;
}

function getKeyIdx(name, length) {
    return ((jenkinsHash(name) + length + 101 - 40) >>> 0) % 101;
}

function roundA(data, sk, tbl) {
    const x1 = (tbl[0][data[0]] ^ tbl[1][data[1]] ^ tbl[2][data[2]]  ^ tbl[3][data[3]]  ^ sk[0]) >>> 0;
    const x2 = (tbl[4][data[4]] ^ tbl[5][data[5]] ^ tbl[6][data[6]]  ^ tbl[7][data[7]]  ^ sk[1]) >>> 0;
    const x3 = (tbl[8][data[8]] ^ tbl[9][data[9]] ^ tbl[10][data[10]]^ tbl[11][data[11]]^ sk[2]) >>> 0;
    const x4 = (tbl[12][data[12]]^tbl[13][data[13]]^tbl[14][data[14]]^tbl[15][data[15]] ^ sk[3]) >>> 0;
    return Buffer.from([
        x1,x1>>8,x1>>16,x1>>24, x2,x2>>8,x2>>16,x2>>24,
        x3,x3>>8,x3>>16,x3>>24, x4,x4>>8,x4>>16,x4>>24
    ]);
}

function roundB(data, sk, tbl) {
    const x1 = (tbl[0][data[0]] ^tbl[7][data[7]] ^tbl[10][data[10]]^tbl[13][data[13]]^ sk[0]) >>> 0;
    const x2 = (tbl[1][data[1]] ^tbl[4][data[4]] ^tbl[11][data[11]]^tbl[14][data[14]]^ sk[1]) >>> 0;
    const x3 = (tbl[2][data[2]] ^tbl[5][data[5]] ^tbl[8][data[8]] ^tbl[15][data[15]] ^ sk[2]) >>> 0;
    const x4 = (tbl[3][data[3]] ^tbl[6][data[6]] ^tbl[9][data[9]] ^tbl[12][data[12]] ^ sk[3]) >>> 0;
    return Buffer.from([
        x1,x1>>8,x1>>16,x1>>24, x2,x2>>8,x2>>16,x2>>24,
        x3,x3>>8,x3>>16,x3>>24, x4,x4>>8,x4>>16,x4>>24
    ]);
}

function decryptNgBlock(data16, key) {
    const sk = (i) => [key[4*i], key[4*i+1], key[4*i+2], key[4*i+3]];
    let b = Buffer.from(data16);
    b = roundA(b, sk(0),  tables[0]);
    b = roundA(b, sk(1),  tables[1]);
    for (let r = 2; r <= 15; r++) b = roundB(b, sk(r), tables[r]);
    b = roundA(b, sk(16), tables[16]);
    return b;
}

function decryptNg(data, name, length) {
    const idx  = getKeyIdx(name, length);
    const key  = ngKeys[idx];
    const out  = Buffer.from(data);
    const blks = Math.floor(data.length / 16);
    for (let b = 0; b < blks; b++) {
        const dec = decryptNgBlock(data.slice(b*16, b*16+16), key);
        dec.copy(out, b*16);
    }
    return out;
}

// ---- RPF parser ----
function readName(buf, namesBase, namesSize, nameOff) {
    let s = '';
    let i = namesBase + nameOff;
    while (i < namesBase + namesSize && buf[i] !== 0) s += String.fromCharCode(buf[i++]);
    return s;
}

function parseRpf(buf, label) {
    console.log(`\n=== ${label} (${buf.length} bytes) ===`);
    if (buf.readUInt32LE(0) !== 0x52504637) { console.log('  Not RPF7'); return null; }
    const nEntries   = buf.readUInt32LE(4);
    const namesSize  = buf.readUInt32LE(8);
    const namesBase  = 16 + nEntries * 16;
    const metaSize   = namesBase + namesSize;
    const metaPadded = Math.ceil(metaSize / 512) * 512;
    console.log(`  entries=${nEntries}  namesSize=${namesSize}  metaPadded=${metaPadded}`);

    const entries = [];
    for (let i = 0; i < nEntries; i++) {
        const off = 16 + i * 16;
        const f1  = buf.readUInt32LE(off);
        const f2  = buf.readUInt32LE(off + 4);
        const f3  = buf.readUInt32LE(off + 8);
        const f4  = buf.readUInt32LE(off + 12);
        const nameOff = f1 & 0xFFFF;
        const name = readName(buf, namesBase, namesSize, nameOff);

        if (f2 === 0x7FFFFF00) {
            console.log(`  [${i}] DIR  "${name}"  firstChild=${f3}  count=${f4}`);
            entries.push({ type:'dir', name, firstChild:f3, count:f4 });
        } else {
            const isRes   = (f2 >>> 31) === 1;
            const diskSize = (f1 >>> 16 & 0xFF) | ((f1 >>> 24 & 0xFF) << 8) | ((f2 & 0xFF) << 16);
            const sectorOff = (f2 >>> 8) & 0x7FFFFF;
            const dataOff   = metaPadded + sectorOff * 512;
            console.log(`  [${i}] ${isRes?'RES':'BIN'} "${name}"  diskSize=${diskSize}  sector=${sectorOff}  dataOff=${dataOff}  ${isRes?`vFlag=0x${f3.toString(16)} pFlag=0x${f4.toString(16)}`:''}`);
            entries.push({ type: isRes?'res':'bin', name, diskSize, sectorOff, dataOff, f3, f4 });
        }
    }
    return { buf, entries, metaPadded };
}

// ---- Main ----
const vpPath = path.join(__dirname, 'test', 'MK2_SILENCIADA_LHC.rpf');
const vpBuf  = fs.readFileSync(vpPath);

const outer = parseRpf(vpBuf, 'Outer RPF');
if (!outer) process.exit(1);

// Find "assembly.xml" (which contains the inner DLC RPF)
const asmEntry = outer.entries.find(e => e.name === 'assembly.xml');
if (!asmEntry) { console.log('assembly.xml not found'); process.exit(1); }

const innerDlcBuf = vpBuf.slice(asmEntry.dataOff);
const innerDlc = parseRpf(innerDlcBuf, 'Inner DLC RPF (assembly.xml data)');
if (!innerDlc) process.exit(1);

// Brute force NG key index
const asmRaw = vpBuf.slice(asmEntry.dataOff, asmEntry.dataOff + Math.max(asmEntry.diskSize, 512));
const asmSize = asmEntry.diskSize > 0 ? asmEntry.diskSize : asmEntry.f3;
console.log(`\n--- Brute-forcing assembly.xml (length=${asmSize}) ---`);
for (let c = 0; c < 101; c++) {
    const idx = (jenkinsHash('assembly.xml') + asmSize + 101 - c) % 101;
    const dec = decryptNgBlock(asmRaw.slice(0, 16), ngKeys[idx]);
    if (dec.toString().includes('<?xml')) {
        console.log(`FOUND CONSTANT: ${c} (keyIdx=${idx})`);
        const fullDec = decryptNg(asmRaw.slice(0, asmSize), 'assembly.xml', asmSize);
        // Wait, decryptNg uses the internal constant. I'll just do it manually here.
        const out = Buffer.from(asmRaw.slice(0, asmSize));
        for (let b = 0; b < Math.floor(asmSize/16); b++) {
            decryptNgBlock(asmRaw.slice(b*16, b*16+16), ngKeys[idx]).copy(out, b*16);
        }
        console.log(out.toString('utf8').replace(/\0/g, ''));
        break;
    }
}

// Decrypt each XML file found in the inner DLC RPF
for (const e of innerDlc.entries) {
    if (e.type === 'bin' && e.name.endsWith('.xml')) {
        const sizeToUse = e.diskSize > 0 ? e.diskSize : e.f3;
        const rawData = innerDlcBuf.slice(e.dataOff, e.dataOff + Math.max(sizeToUse, 512));
        console.log(`\n--- Decrypting "${e.name}" (keyIdx by name="${e.name}", length=${sizeToUse}) ---`);
        const dec = decryptNg(rawData.slice(0, sizeToUse), e.name, sizeToUse);
        const text = dec.toString('utf8').replace(/\0/g, '');
        console.log(text.slice(0, 500));
    }
    
    // If this is an RPF, parse its entries
    const rawData = innerDlcBuf.slice(e.dataOff, e.dataOff + Math.max(e.diskSize, 512));
    if (rawData.length > 4 && rawData.readUInt32LE(0) === 0x52504637) {
        parseRpf(rawData, `Sub-RPF "${e.name}"`);
    }
}
