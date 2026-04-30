const fs = require('fs');

const NG_DECRYPT_TABLES_RAW = fs.readFileSync('/var/www/lhc-node/gtav_ng_decrypt_tables.dat');
const NG_ENCRYPT_TABLES_RAW = fs.readFileSync('/var/www/lhc-node/gtav_ng_encrypt_tables.dat');

function loadTables(raw) {
    const tables = [];
    for (let r = 0; r < 17; r++) {
        const roundTables = [];
        for (let t = 0; t < 16; t++) {
            const table = new Uint32Array(256);
            for (let i = 0; i < 256; i++) {
                table[i] = raw.readUInt32LE((r * 16 * 256 * 4) + (t * 256 * 4) + (i * 4));
            }
            roundTables.push(table);
        }
        tables.push(roundTables);
    }
    return tables;
}

const DECRYPT_TABLES = loadTables(NG_DECRYPT_TABLES_RAW);
const ENCRYPT_TABLES = loadTables(NG_ENCRYPT_TABLES_RAW);

function ngDecryptBlock(block, keyBuf) {
    const sk = [];
    for (let i = 0; i < 17; i++) {
        sk.push([
            keyBuf.readUInt32LE(i * 16),
            keyBuf.readUInt32LE(i * 16 + 4),
            keyBuf.readUInt32LE(i * 16 + 8),
            keyBuf.readUInt32LE(i * 16 + 12)
        ]);
    }

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
    b = rdA(b, sk[0], DECRYPT_TABLES[0]);
    b = rdA(b, sk[1], DECRYPT_TABLES[1]);
    for (let k = 2; k <= 15; k++) {
        b = rdB(b, sk[k], DECRYPT_TABLES[k]);
    }
    return rdA(b, sk[16], DECRYPT_TABLES[16]);
}

function ngEncryptBlock(block, keyBuf) {
    const sk = [];
    for (let i = 0; i < 17; i++) {
        sk.push([
            keyBuf.readUInt32LE(i * 16),
            keyBuf.readUInt32LE(i * 16 + 4),
            keyBuf.readUInt32LE(i * 16 + 8),
            keyBuf.readUInt32LE(i * 16 + 12)
        ]);
    }

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
        // ShiftRows pattern for encryption:
        // Col 0: 0, 5, 10, 15
        // Col 1: 4, 9, 14, 3
        // Col 2: 8, 13, 2, 7
        // Col 3: 12, 1, 6, 11
        r.writeUInt32LE((t[0][d[0]] ^ t[1][d[5]] ^ t[2][d[10]] ^ t[3][d[15]] ^ s[0]) >>> 0, 0);
        r.writeUInt32LE((t[4][d[4]] ^ t[5][d[9]] ^ t[6][d[14]] ^ t[7][d[3]] ^ s[1]) >>> 0, 4);
        r.writeUInt32LE((t[8][d[8]] ^ t[9][d[13]] ^ t[10][d[2]] ^ t[11][d[7]] ^ s[2]) >>> 0, 8);
        r.writeUInt32LE((t[12][d[12]] ^ t[13][d[1]] ^ t[14][d[6]] ^ t[15][d[11]] ^ s[3]) >>> 0, 12);
        return r;
    };

    let b = block;
    b = rdA(b, sk[16], ENCRYPT_TABLES[16]);
    for (let k = 15; k >= 2; k--) {
        b = rdB(b, sk[k], ENCRYPT_TABLES[k]);
    }
    b = rdA(b, sk[1], ENCRYPT_TABLES[1]);
    b = rdA(b, sk[0], ENCRYPT_TABLES[0]);
    return b;
}

// Test with a dummy block and key
const dummyBlock = Buffer.from([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
const keyBuf = fs.readFileSync('/var/www/lhc-node/gtav_ng_key.dat').slice(0, 272);

const encrypted = ngEncryptBlock(dummyBlock, keyBuf);
const decrypted = ngDecryptBlock(encrypted, keyBuf);

console.log('Original:  ', dummyBlock.toString('hex'));
console.log('Encrypted: ', encrypted.toString('hex'));
console.log('Decrypted: ', decrypted.toString('hex'));

if (dummyBlock.equals(decrypted)) {
    console.log('SUCCESS! Encryption and Decryption are consistent.');
} else {
    console.log('FAILURE! Decrypted data does not match original.');
}
