// Script de diagnóstico: extrae y muestra los bytes reales del AWC dentro del RPF
// Ejecutar en el VPS: node /var/www/lhc-node/diag_awc.js

const fs = require('fs');
const crypto = require('crypto');

const AES_KEY = Buffer.from([
    0x22, 0x7E, 0x14, 0x2C, 0x45, 0x5F, 0x1F, 0x18, 0x2E, 0x3E, 0x19, 0x6D, 0x32, 0x36, 0x53, 0x28,
    0x2D, 0x73, 0x3A, 0x01, 0x60, 0x14, 0x6E, 0x56, 0x31, 0x72, 0x08, 0x46, 0x3E, 0x31, 0x5D, 0x41
]);

const RPF_PATH = '/var/www/lhc-node/arma/WEAPONS_PLAYER.rpf';

const buf = fs.readFileSync(RPF_PATH);
console.log('RPF size:', buf.length);
console.log('Magic:', buf.toString('utf8', 0, 4));
const ec = buf.readUInt32LE(4);
const nl = buf.readUInt32LE(8);
const et = buf.readUInt32LE(12);
console.log('Entries:', ec, 'NameLen:', nl, 'EncType:', et.toString(16));

// Decrypt header if AES
const PAGE_SIZE = 512;
const headerSize = ec * 16 + nl;
let headerBuf;

if (et === 0x0FFFFFF9) {
    // AES encrypted header
    const rawHeader = buf.slice(16, 16 + Math.ceil(headerSize / 16) * 16);
    const d = crypto.createDecipheriv('aes-256-ecb', AES_KEY, null);
    d.setAutoPadding(false);
    headerBuf = Buffer.concat([d.update(rawHeader), d.final()]).slice(0, headerSize);
} else {
    headerBuf = buf.slice(16, 16 + headerSize);
}

const nts = ec * 16;
console.log('\nEntries:');
for (let i = 0; i < ec; i++) {
    const eo = i * 16;
    const nameOff = headerBuf.readUInt16LE(eo);
    const type = headerBuf[eo + 2];
    const us = headerBuf.readUInt32LE(eo + 8);
    const cs = headerBuf[eo + 2] | (headerBuf[eo + 3] << 8) | (headerBuf[eo + 4] << 16);
    const page = headerBuf[eo + 5] | (headerBuf[eo + 6] << 8) | (headerBuf[eo + 7] << 16);

    let name = '';
    let p = nts + nameOff;
    while (p < nts + nl && headerBuf[p] !== 0) name += String.fromCharCode(headerBuf[p++]);

    if (!name.toLowerCase().endsWith('.awc')) continue;

    console.log(`\n--- AWC: ${name} ---`);
    console.log(`  Page: ${page}, Uncompressed: ${us}, Compressed: ${cs}`);
    console.log(`  File offset: ${page * PAGE_SIZE}`);

    // Extract raw bytes
    const rawOff = page * PAGE_SIZE;
    const rawSize = cs > 0 ? cs : us;
    let rawData = buf.slice(rawOff, rawOff + Math.min(rawSize, 512));

    // Decrypt if AES
    if (et === 0x0FFFFFF9) {
        const d = crypto.createDecipheriv('aes-256-ecb', AES_KEY, null);
        d.setAutoPadding(false);
        const blockSize = Math.floor(rawData.length / 16) * 16;
        rawData = Buffer.concat([d.update(rawData.slice(0, blockSize)), d.final()]);
    }

    // Try decompress if compressed
    if (cs > 0) {
        try {
            rawData = require('zlib').inflateRawSync(rawData.slice(0, Math.min(cs, rawData.length)));
            console.log('  >> Decompressed successfully');
        } catch (e) {
            console.log('  >> NOT zlib compressed:', e.message);
            // Show raw bytes
        }
    }

    // Show first 128 bytes as hex
    const preview = rawData.slice(0, 128);
    console.log('  First 128 bytes (hex):');
    for (let b = 0; b < preview.length; b += 16) {
        const hex = Array.from(preview.slice(b, b + 16)).map(x => x.toString(16).padStart(2, '0')).join(' ');
        const asc = Array.from(preview.slice(b, b + 16)).map(x => x >= 32 && x < 127 ? String.fromCharCode(x) : '.').join('');
        console.log(`  ${b.toString(16).padStart(4, '0')}: ${hex.padEnd(47)} ${asc}`);
    }

    // Only process first AWC for now
    break;
}
