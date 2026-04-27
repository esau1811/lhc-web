// Debug NG decryption: test all 101 keys against WEAPONS_PLAYER.rpf header
const fs   = require('fs');
const path = require('path');

// Load key files from local cache (downloaded from VPS to inspect)
// Actually load directly from the GitHub URLs or manually downloaded
const KEYS_DIR = 'C:/opt/lhc-keys'; // We'll pull them from VPS via SSH instead

// Let's do this: SSH to VPS and run the debug directly there
const { Client } = require('ssh2');

const SSH = { host: '187.33.157.103', port: 22, username: 'root', password: 'diScordLhcds032.w' };

const rpfBuf = fs.readFileSync('LHC Sound boost/WEAPONS_PLAYER.rpf');
const rpfB64 = rpfBuf.slice(0, 512).toString('base64'); // send just first 512 bytes for debugging

const debugCode = `
const fs = require('fs');
const path = require('path');

const KEYS_DIR = '/opt/lhc-keys';

const rpfHeaderB64 = '${rpfB64}';
const rpfHeader = Buffer.from(rpfHeaderB64, 'base64');

const magic     = rpfHeader.slice(0, 4).toString('hex');
const entryCount = rpfHeader.readUInt32LE(4);
const namesLen   = rpfHeader.readUInt32LE(8);
const encType    = rpfHeader.readUInt32LE(12);
const encName    = encType === 0x0FEFFFFF ? 'NG' : encType === 0x0FFFFFF9 ? 'AES' : '0x' + encType.toString(16);
console.log('Magic:', magic, '| Entries:', entryCount, '| NamesLen:', namesLen, '| Enc:', encName);

// Load keys
const aesKey   = fs.readFileSync(path.join(KEYS_DIR, 'gtav_aes_key.dat'));
const ngKeyRaw = fs.readFileSync(path.join(KEYS_DIR, 'gtav_ng_key.dat'));
const ngTabRaw = fs.readFileSync(path.join(KEYS_DIR, 'gtav_ng_decrypt_tables.dat'));
const hashLut  = fs.readFileSync(path.join(KEYS_DIR, 'gtav_hash_lut.dat'));

console.log('AES key len:', aesKey.length);
console.log('NG key raw len:', ngKeyRaw.length, '-> entries:', ngKeyRaw.length / 272);
console.log('NG tables raw len:', ngTabRaw.length, '-> expected:', 17*16*256*4);

// Show first 16 bytes of key[0] and key[1]
console.log('Key[0] first 32 bytes:', ngKeyRaw.slice(0, 32).toString('hex'));
console.log('Key[1] first 32 bytes:', ngKeyRaw.slice(272, 272+32).toString('hex'));

// Load NG tables
const NG_TABLES = [];
let off = 0;
for (let r = 0; r < 17; r++) {
    NG_TABLES[r] = [];
    for (let t = 0; t < 16; t++) {
        const table = new Uint32Array(256);
        for (let e = 0; e < 256; e++) {
            table[e] = ngTabRaw.readUInt32LE(off);
            off += 4;
        }
        NG_TABLES[r].push(table);
    }
}
console.log('Tables loaded, round0.table0[0]:', NG_TABLES[0][0][0].toString(16));

function ngDecryptRoundA(data, subKey, table) {
    const x1 = (table[0][data[0]] ^ table[1][data[1]]  ^ table[2][data[2]]   ^ table[3][data[3]]   ^ subKey[0]) >>> 0;
    const x2 = (table[4][data[4]] ^ table[5][data[5]]  ^ table[6][data[6]]   ^ table[7][data[7]]   ^ subKey[1]) >>> 0;
    const x3 = (table[8][data[8]] ^ table[9][data[9]]  ^ table[10][data[10]] ^ table[11][data[11]] ^ subKey[2]) >>> 0;
    const x4 = (table[12][data[12]]^ table[13][data[13]]^ table[14][data[14]]^ table[15][data[15]] ^ subKey[3]) >>> 0;
    const r  = Buffer.allocUnsafe(16);
    r.writeUInt32LE(x1, 0); r.writeUInt32LE(x2, 4);
    r.writeUInt32LE(x3, 8); r.writeUInt32LE(x4, 12);
    return r;
}

function ngDecryptRoundB(data, subKey, table) {
    const x1 = (table[0][data[0]]  ^ table[7][data[7]]  ^ table[10][data[10]] ^ table[13][data[13]] ^ subKey[0]) >>> 0;
    const x2 = (table[1][data[1]]  ^ table[4][data[4]]  ^ table[11][data[11]] ^ table[14][data[14]] ^ subKey[1]) >>> 0;
    const x3 = (table[2][data[2]]  ^ table[5][data[5]]  ^ table[8][data[8]]   ^ table[15][data[15]] ^ subKey[2]) >>> 0;
    const x4 = (table[3][data[3]]  ^ table[6][data[6]]  ^ table[9][data[9]]   ^ table[12][data[12]] ^ subKey[3]) >>> 0;
    const r  = Buffer.allocUnsafe(16);
    r.writeUInt32LE(x1, 0); r.writeUInt32LE(x2, 4);
    r.writeUInt32LE(x3, 8); r.writeUInt32LE(x4, 12);
    return r;
}

function ngDecryptBlock(block, keyBuf) {
    const subKeys = [];
    for (let i = 0; i < 17; i++) {
        subKeys.push([
            keyBuf.readUInt32LE(i * 16),
            keyBuf.readUInt32LE(i * 16 + 4),
            keyBuf.readUInt32LE(i * 16 + 8),
            keyBuf.readUInt32LE(i * 16 + 12),
        ]);
    }
    let buf = block;
    buf = ngDecryptRoundA(buf, subKeys[0],  NG_TABLES[0]);
    buf = ngDecryptRoundA(buf, subKeys[1],  NG_TABLES[1]);
    for (let k = 2; k <= 15; k++) buf = ngDecryptRoundB(buf, subKeys[k], NG_TABLES[k]);
    buf = ngDecryptRoundA(buf, subKeys[16], NG_TABLES[16]);
    return buf;
}

// The entries block starts at offset 16 in the RPF
// First 16 bytes (first entry) should be root directory after decryption
const firstEntry = rpfHeader.slice(16, 32); // first 16 bytes of entries block
console.log('\\nFirst entry (encrypted):', firstEntry.toString('hex'));

let foundKey = false;
for (let i = 0; i < 101; i++) {
    const keyBuf = ngKeyRaw.slice(i * 272, (i + 1) * 272);
    const dec    = ngDecryptBlock(firstEntry, keyBuf);
    const w4     = dec.readUInt32LE(4);
    const page   = w4 & 0x7FFFFF;

    if (i < 3) {
        console.log('Key[' + i + '] decrypted:', dec.toString('hex'), '| w4:', w4.toString(16), '| page:', page.toString(16));
    }

    if (page === 0x7FFFFF) {
        console.log('\\n>>> MATCH! Key index:', i);
        console.log('    Decrypted entry:', dec.toString('hex'));
        foundKey = true;
    }
}

if (!foundKey) {
    console.log('\\nNo key matched directory check (page=0x7FFFFF)');
    // Try alternative check: nameOff should be 0 for root directory
    for (let i = 0; i < 101; i++) {
        const keyBuf = ngKeyRaw.slice(i * 272, (i + 1) * 272);
        const dec    = ngDecryptBlock(firstEntry, keyBuf);
        const nameOff = dec.readUInt16LE(0);
        if (nameOff === 0 && i < 10) {
            console.log('Key[' + i + '] has nameOff=0:', dec.toString('hex'));
        }
    }
}

console.log('Done.');
`;

const conn = new Client();
conn.on('ready', () => {
    conn.exec(`node -e ${JSON.stringify(debugCode)}`, (err, stream) => {
        if (err) { console.error(err); conn.end(); return; }
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => conn.end());
    });
}).on('error', e => console.error('SSH error:', e)).connect(SSH);
