// Diagnostic: Test if AWC data is encrypted per-file or if it's raw within NG RPF
// CodeWalker only decrypts data if entry.IsEncrypted is true
// For BinaryFileEntry, IsEncrypted is read from the entry flags
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEYS_DIR = '/opt/lhc-keys';
const RPF_PATH = '/tmp/wp_diag.rpf';

const GTA5_AES_KEY = fs.readFileSync(path.join(KEYS_DIR, 'gtav_aes_key.dat'));
const ngKeyRaw = fs.readFileSync(path.join(KEYS_DIR, 'gtav_ng_key.dat'));
const GTA5_NG_KEYS = [];
for (let i = 0; i < 101; i++) GTA5_NG_KEYS.push(ngKeyRaw.slice(i * 272, (i + 1) * 272));
const ngTabRaw = fs.readFileSync(path.join(KEYS_DIR, 'gtav_ng_decrypt_tables.dat'));
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
const GTA5_HASH_LUT = fs.readFileSync(path.join(KEYS_DIR, 'gtav_hash_lut.dat'));

function gta5Hash(text) {
    let result = 0;
    for (let i = 0; i < text.length; i++) {
        const c = GTA5_HASH_LUT[text.charCodeAt(i) & 0xFF];
        result = ((Math.imul(1025, (c + result) >>> 0) >>> 0) >>> 6 ^ Math.imul(1025, (c + result) >>> 0) >>> 0) >>> 0;
    }
    const r9 = Math.imul(9, result) >>> 0;
    return Math.imul(32769, ((r9 >>> 11) ^ r9) >>> 0) >>> 0;
}

function ngDecryptBlock(block, keyBuf) {
    const sk = [];
    for (let i = 0; i < 17; i++) sk.push([keyBuf.readUInt32LE(i * 16), keyBuf.readUInt32LE(i * 16 + 4), keyBuf.readUInt32LE(i * 16 + 8), keyBuf.readUInt32LE(i * 16 + 12)]);
    const rdA = (d, s, t) => {
        const r = Buffer.allocUnsafe(16);
        r.writeUInt32LE((t[0][d[0]] ^ t[1][d[1]] ^ t[2][d[2]] ^ t[3][d[3]] ^ s[0]) >>> 0, 0);
        r.writeUInt32LE((t[4][d[4]] ^ t[5][d[5]] ^ t[6][d[6]] ^ t[7][d[7]] ^ s[1]) >>> 0, 4);
        r.writeUInt32LE((t[8][d[8]] ^ t[9][d[9]] ^ t[10][d[10]] ^ t[11][d[11]] ^ s[2]) >>> 0, 8);
        r.writeUInt32LE((t[12][d[12]] ^ t[13][d[13]] ^ t[14][d[14]] ^ t[15][d[15]] ^ s[3]) >>> 0, 12);
        return r;
    };
    const rdB = (d, s, t) => {
        const r = Buffer.allocUnsafe(16);
        r.writeUInt32LE((t[0][d[0]] ^ t[7][d[7]] ^ t[10][d[10]] ^ t[13][d[13]] ^ s[0]) >>> 0, 0);
        r.writeUInt32LE((t[1][d[1]] ^ t[4][d[4]] ^ t[11][d[11]] ^ t[14][d[14]] ^ s[1]) >>> 0, 4);
        r.writeUInt32LE((t[2][d[2]] ^ t[5][d[5]] ^ t[8][d[8]] ^ t[15][d[15]] ^ s[2]) >>> 0, 8);
        r.writeUInt32LE((t[3][d[3]] ^ t[6][d[6]] ^ t[9][d[9]] ^ t[12][d[12]] ^ s[3]) >>> 0, 12);
        return r;
    };
    let b = block;
    b = rdA(b, sk[0], GTA5_NG_TABLES[0]);
    b = rdA(b, sk[1], GTA5_NG_TABLES[1]);
    for (let k = 2; k <= 15; k++) b = rdB(b, sk[k], GTA5_NG_TABLES[k]);
    return rdA(b, sk[16], GTA5_NG_TABLES[16]);
}

function ngDecrypt(data, keyBuf) {
    const out = Buffer.from(data);
    for (let i = 0; i < Math.floor(data.length / 16); i++)
        ngDecryptBlock(data.slice(i * 16, i * 16 + 16), keyBuf).copy(out, i * 16);
    return out;
}

const buf = fs.readFileSync(RPF_PATH);
const ec = buf.readUInt32LE(4);
const nl = buf.readUInt32LE(8);
const et = buf.readUInt32LE(12);
const hl = ec * 16 + nl;

console.log(`RPF: size=${buf.length} ec=${ec} nl=${nl} enc=0x${et.toString(16)}`);
console.log(`FileSize=${buf.length}`);

// Decrypt header - brute force all 101 keys
let dh = null, headerKeyIdx = -1;
const enc = buf.slice(16, 16 + hl);
for (let i = 0; i < 101; i++) {
    const d = ngDecryptBlock(enc.slice(0, 16), GTA5_NG_KEYS[i]);
    if (d.readUInt16LE(0) === 0 && d.readUInt32LE(4) === 0x7FFFFF00) {
        dh = ngDecrypt(enc, GTA5_NG_KEYS[i]);
        headerKeyIdx = i;
        break;
    }
}
console.log(`Header decrypted with key ${headerKeyIdx}`);

// Also try formula-based: key = (hash(rpfName) + fileSize + 61) % 101
const rpfName = 'weapons_player.rpf';
const formulaIdx = ((gta5Hash(rpfName) + buf.length + 61) >>> 0) % 101;
console.log(`Formula key for "${rpfName}": hash=${gta5Hash(rpfName)} + len=${buf.length} + 61 = key ${formulaIdx}`);

if (!dh) { console.log('HEADER DECRYPT FAILED'); process.exit(1); }

// Parse entries and examine IsEncrypted flag
// RPF7 binary file entry format (from CodeWalker RpfFile.cs):
//   uint H1 (nameOffset + flags)
//   uint H2 (type marker)
//   Then Read() method parses based on entry type
//
// For BinaryFileEntry:
//   NameOffset = H1 & 0xFFFF (16 bits)
//   FileSize = (H2 >> 0) & 0xFFFFFF (lower 24 bits) << NOTE: this is actually the second uint32
//   Let me re-read CodeWalker...
//
// Actually from RpfFile.cs line 190-191:
//   uint y = entriesrdr.ReadUInt32()   // H1
//   uint x = entriesrdr.ReadUInt32()   // H2
//   if (x == 0x7fffff00) -> directory
//   else if ((x & 0x80000000) == 0) -> binary file
//   else -> resource file
//
// So the second uint32 having bit 31 == 0 means binary file
// For BinaryFileEntry.Read():
//   NameOffset: bits 0-15 of first uint32
//   FileUncompressedSize: bits 0-23 of third uint32 (bytes 8-11)  
//   FileSize: upper 8 bits combined somehow
//   FileOffset: from second uint32 somehow
//   IsEncrypted: a flag bit

const nts = ec * 16;
console.log(`\n=== ENTRY ANALYSIS ===`);

for (let i = 0; i < ec; i++) {
    const eo = i * 16;
    const w0 = dh.readUInt32LE(eo);     // H1
    const w1 = dh.readUInt32LE(eo + 4); // H2
    const w2 = dh.readUInt32LE(eo + 8);
    const w3 = dh.readUInt32LE(eo + 12);

    const nameOff = w0 & 0xFFFF;
    let name = '';
    let p = nts + nameOff;
    while (p < nts + nl && dh[p] !== 0) name += String.fromCharCode(dh[p++]);

    if (w1 === 0x7FFFFF00) {
        console.log(`E${i} DIR "${name}" start=${w2} count=${w3}`);
        continue;
    }

    // Binary file entry parsing (from CodeWalker):
    // The entry has 16 bytes total read as 4 uint32s
    // For BinaryFileEntry:
    //   NameOffset = (ushort)(values[0] & 0xFFFF)
    //   FileSize = ((values[0] >> 16) & 0xFF) | ((values[1] & 0xFF) << 8) | ... unclear
    //   Actually from CodeWalker BinaryFileEntry.Read():
    //     NameOffset = (ushort)(entriesrdr.ReadUInt32() & 0xFFFF) -- but this consumes first 4 bytes
    //     Actually the Read consumes 16 bytes:

    // Let me just check the raw bytes and the key bit:
    // Byte layout: [b0 b1 b2 b3] [b4 b5 b6 b7] [b8 b9 bA bB] [bC bD bE bF]
    // From rpf7-docs: 
    //   Name Offset: u16 (bytes 0-1)
    //   Flags/CompressedSize: u24 (bytes 2-4) -- if compressed, this is compressed size
    //   Offset (in 512B units): u24 (bytes 5-7) 
    //   Size (uncompressed): u32 (bytes 8-11)
    //   Last 4 bytes (12-15): unknown/zero

    const rawNameOff = dh.readUInt16LE(eo);
    const flags_or_cs = dh[eo + 2] | (dh[eo + 3] << 8) | (dh[eo + 4] << 16);
    const pageOff = dh[eo + 5] | (dh[eo + 6] << 8) | (dh[eo + 7] << 16);
    const us = dh.readUInt32LE(eo + 8);
    const extra = dh.readUInt32LE(eo + 12);

    // IsEncrypted for binary entry: from CodeWalker, IsEncrypted is set based on:
    // entry.IsEncrypted = (flags & 1) != 0  or similar
    // Actually in CodeWalker BinaryFileEntry:
    //   public bool IsEncrypted { get; set; }
    //   In Read() method:
    //     IsEncrypted = ... from some bit

    // The "flags" field (bytes 2-4) is actually the FileSize when compressed
    // From CodeWalker: FileSize == 0 means not compressed, and data is NOT individually encrypted  
    // IsEncrypted comes from a separate bit

    // Let me check w3 (bytes 12-15) - this might contain encryption flag
    // In CodeWalker's RpfBinaryFileEntry parsing, the encrypted flag might be in the top bits

    const dataOff = pageOff * 512;
    let rawPreview = 'OOB';
    if (dataOff > 0 && dataOff + 16 <= buf.length) {
        rawPreview = buf.slice(dataOff, dataOff + 16).toString('hex');
    }

    // Check if raw data contains ADAT (without any decryption)
    let rawAdatPos = -1;
    if (dataOff > 0 && dataOff + us <= buf.length) {
        const rawData = buf.slice(dataOff, dataOff + us);
        rawAdatPos = rawData.indexOf(Buffer.from('ADAT'));
    }

    console.log(`E${i} FILE "${name}" page=${pageOff} us=${us} cs=${flags_or_cs} extra=0x${extra.toString(16).padStart(8, '0')} off=${dataOff}`);
    console.log(`     raw[0:16]=${rawPreview}`);
    console.log(`     ADAT_in_raw: ${rawAdatPos >= 0 ? 'YES at +' + rawAdatPos : 'NO'}`);

    // Try NG decrypt with formula: (hash(name) + us + 61) % 101
    if (dataOff > 0 && dataOff + 16 <= buf.length) {
        const keyIdx = ((gta5Hash(name.toLowerCase()) + us + 61) >>> 0) % 101;
        const block0 = ngDecryptBlock(buf.slice(dataOff, dataOff + 16), GTA5_NG_KEYS[keyIdx]);
        const adatInDec = block0.indexOf(Buffer.from('ADAT'));
        console.log(`     NG formula key=${keyIdx} -> dec[0:16]=${block0.toString('hex')} ADAT=${adatInDec >= 0}`);
        
        // Also try with FileSize (compressed size) instead of uncompressed
        if (flags_or_cs > 0) {
            const keyIdx2 = ((gta5Hash(name.toLowerCase()) + flags_or_cs + 61) >>> 0) % 101;
            const block02 = ngDecryptBlock(buf.slice(dataOff, dataOff + 16), GTA5_NG_KEYS[keyIdx2]);
            console.log(`     NG cs-formula key=${keyIdx2} -> dec=${block02.toString('hex')} ADAT=${block02.indexOf(Buffer.from('ADAT')) >= 0}`);
        }
        
        // Try with the FULL file path within RPF
        const fullPath = 'weapons_player.rpf\\' + name.toLowerCase();
        const keyIdx3 = ((gta5Hash(fullPath) + us + 61) >>> 0) % 101;
        const block03 = ngDecryptBlock(buf.slice(dataOff, dataOff + 16), GTA5_NG_KEYS[keyIdx3]);
        console.log(`     NG path-formula key=${keyIdx3} (path="${fullPath}") -> ADAT=${block03.indexOf(Buffer.from('ADAT')) >= 0}`);
    }
    console.log('');
}

// CRITICAL TEST: Check if the data might be NOT encrypted at all
// AWC files start with a specific header structure. Let's see if we can parse it
console.log('\n=== RAW DATA PATTERN CHECK (NO DECRYPTION) ===');
// E4 = mgn_sml_am83_verb.awc at page 1089
const testPage = 1089;
const testOff = testPage * 512;
const testData = buf.slice(testOff, testOff + 64);
console.log('Raw bytes at page 1089 (first 64):');
console.log(testData.toString('hex'));
console.log('As uint32s:', Array.from({length: 16}, (_, i) => '0x' + buf.readUInt32LE(testOff + i * 4).toString(16)).join(' '));

// AWC header format: first uint32 is often the magic or tag count
// Check first few uint32 values
const v0 = buf.readUInt32LE(testOff);
const v1 = buf.readUInt32LE(testOff + 4);
console.log(`v0=0x${v0.toString(16)} v1=0x${v1.toString(16)}`);

// E1 = lmg_combat.awc at page 2 - this is the FIRST file, right after header
const firstPage = 2;
const firstOff = firstPage * 512;
const firstData = buf.slice(firstOff, firstOff + 64);
console.log('\nRaw bytes at page 2 (lmg_combat.awc, first 64):');
console.log(firstData.toString('hex'));

// Check entropy of first sector (high entropy = encrypted, low = plaintext)
function entropy(data) {
    const freq = new Array(256).fill(0);
    for (let i = 0; i < data.length; i++) freq[data[i]]++;
    let e = 0;
    for (let i = 0; i < 256; i++) {
        if (freq[i] > 0) {
            const p = freq[i] / data.length;
            e -= p * Math.log2(p);
        }
    }
    return e; // max is 8.0 for perfectly random
}

// Check entropy of multiple sectors
const entries = [
    { name: 'lmg_combat.awc', page: 2, us: 55496 },
    { name: 'ptl_pistol.awc', page: 1874, us: 64352 },
    { name: 'spl_tank_player.awc', page: 6893, us: 353196 },
];

console.log('\n=== ENTROPY ANALYSIS ===');
for (const e of entries) {
    const o = e.page * 512;
    if (o + 512 > buf.length) continue;
    const sector = buf.slice(o, o + 512);
    const ent = entropy(sector);
    console.log(`${e.name} (page ${e.page}): entropy=${ent.toFixed(3)} (8.0=encrypted, <7.0=likely plaintext/structured)`);
}
