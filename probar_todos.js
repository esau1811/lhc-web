// Algoritmo NG EXACTO de Rockstar según gtautil (C) y CodeWalker (C#)
// Referencia: https://github.com/Neodymium146/gta-toolkit/blob/master/RageLib/Cryptography/Rage/Ng.cs
// Las tablas son uint32, el bloque se procesa como 4 uint32 (little-endian)

const fs = require('fs');

const awcBuf   = fs.readFileSync('C:\\Users\\esau2\\Desktop\\weapons.awc');
const awcBlock = awcBuf.slice(0, 16);
console.log('[*] weapons.awc bloque[0..15]:', awcBlock.toString('hex'));

// Cargar tablas (17 rondas × 256 Uint32)
const tabRaw = fs.readFileSync('keys/gtav_ng_decrypt_tables.dat');
const NG_DEC  = [];
let off = 0;
for (let r = 0; r < 17; r++) {
    const t = new Uint32Array(256);
    for (let e = 0; e < 256; e++) { t[e] = tabRaw.readUInt32LE(off); off += 4; }
    NG_DEC.push(t);
}

// Cargar llaves (101 × 272 bytes = 101 × 17 Uint32[4])
const keysRaw = fs.readFileSync('keys/gtav_ng_key.dat');
const KEYS = [];
for (let i = 0; i + 272 <= keysRaw.length; i += 272) KEYS.push(keysRaw.slice(i, i + 272));
console.log('[*] Llaves:', KEYS.length, '| Tablas:', NG_DEC.length, 'rondas');

// ── NG Decrypt exacto (gta-toolkit / CodeWalker) ──────────────────────────────
// El bloque de 16 bytes se trata como 4 palabras de 32 bits
// Cada tabla es un array de 256 uint32
// Subclaves: key[round] = 4 uint32 (leídos de keyBuf en offset round*16)

function ngDecryptBlock(blk16, keyBuf) {
    let a = blk16.readUInt32LE(0);
    let b = blk16.readUInt32LE(4);
    let c = blk16.readUInt32LE(8);
    let d = blk16.readUInt32LE(12);

    // XOR con subclave de la ronda 0
    a = (a ^ keyBuf.readUInt32LE(0))  >>> 0;
    b = (b ^ keyBuf.readUInt32LE(4))  >>> 0;
    c = (c ^ keyBuf.readUInt32LE(8))  >>> 0;
    d = (d ^ keyBuf.readUInt32LE(12)) >>> 0;

    // 16 rondas de sustitución + XOR
    for (let r = 1; r <= 16; r++) {
        const T  = NG_DEC[r];
        const ko = r * 16;

        // Sustitución: cada byte de cada palabra se sustituye por un Uint32 de la tabla
        // y se combinan con XOR
        const a0 = T[ a        & 0xFF];
        const a1 = T[(a >>>  8) & 0xFF];
        const a2 = T[(a >>> 16) & 0xFF];
        const a3 = T[(a >>> 24) & 0xFF];

        const b0 = T[ b        & 0xFF];
        const b1 = T[(b >>>  8) & 0xFF];
        const b2 = T[(b >>> 16) & 0xFF];
        const b3 = T[(b >>> 24) & 0xFF];

        const c0 = T[ c        & 0xFF];
        const c1 = T[(c >>>  8) & 0xFF];
        const c2 = T[(c >>> 16) & 0xFF];
        const c3 = T[(c >>> 24) & 0xFF];

        const d0 = T[ d        & 0xFF];
        const d1 = T[(d >>>  8) & 0xFF];
        const d2 = T[(d >>> 16) & 0xFF];
        const d3 = T[(d >>> 24) & 0xFF];

        // Mezcla (ShiftRows style): combina bytes de distintas palabras
        const na = ((a0        & 0x000000FF) | (b1 & 0x0000FF00) | (c2 & 0x00FF0000) | (d3 & 0xFF000000)) >>> 0;
        const nb = ((b0        & 0x000000FF) | (c1 & 0x0000FF00) | (d2 & 0x00FF0000) | (a3 & 0xFF000000)) >>> 0;
        const nc = ((c0        & 0x000000FF) | (d1 & 0x0000FF00) | (a2 & 0x00FF0000) | (b3 & 0xFF000000)) >>> 0;
        const nd = ((d0        & 0x000000FF) | (a1 & 0x0000FF00) | (b2 & 0x00FF0000) | (c3 & 0xFF000000)) >>> 0;

        // XOR con subclave de esta ronda
        a = (na ^ keyBuf.readUInt32LE(ko))    >>> 0;
        b = (nb ^ keyBuf.readUInt32LE(ko+4))  >>> 0;
        c = (nc ^ keyBuf.readUInt32LE(ko+8))  >>> 0;
        d = (nd ^ keyBuf.readUInt32LE(ko+12)) >>> 0;
    }

    const out = Buffer.allocUnsafe(16);
    out.writeUInt32LE(a, 0); out.writeUInt32LE(b, 4);
    out.writeUInt32LE(c, 8); out.writeUInt32LE(d, 12);
    return out;
}

// ── Probar todas las llaves ────────────────────────────────────────────────────
let found = false;
for (let k = 0; k < KEYS.length; k++) {
    const dec = ngDecryptBlock(awcBlock, KEYS[k]);
    const magic = dec.slice(0, 4).toString('ascii');
    if (magic === 'TADA' || magic === 'ADAT') {
        console.log(`\n[✓✓✓] ¡¡LLAVE ${k} FUNCIONA!!`);
        console.log(`  Decrypted: ${dec.toString('hex')}`);
        fs.writeFileSync('C:\\Users\\esau2\\Desktop\\pc_awc_key_GANADORA.dat', KEYS[k]);
        found = true;
    }
}

if (!found) {
    console.log('[✗] Ninguna de las 101 llaves funcionó.');
    // Diagnóstico: mostrar los primeros resultados
    for (let k = 0; k < 3; k++) {
        const dec = ngDecryptBlock(awcBlock, KEYS[k]);
        console.log(`  llave[${k}] -> ${dec.toString('hex')}`);
    }
    // Intentar con la llave seleccionada por hash del filename
    // Hash JOAAT de "weapons" = ?
    function joaat(s) {
        let h = 0;
        for (let i = 0; i < s.length; i++) {
            h = (h + s.charCodeAt(i)) >>> 0;
            h = (h + (h << 10)) >>> 0;
            h = (h ^ (h >>> 6)) >>> 0;
        }
        h = (h + (h << 3)) >>> 0;
        h = (h ^ (h >>> 11)) >>> 0;
        h = (h + (h << 15)) >>> 0;
        return h;
    }
    const idx = joaat('weapons') % KEYS.length;
    console.log(`\n[*] Hash de 'weapons' -> índice llave: ${idx}`);
    const dec = ngDecryptBlock(awcBlock, KEYS[idx]);
    console.log(`  llave[${idx}] -> ${dec.toString('hex')}`);
    
    // Probar también "weapons.awc"
    const idx2 = joaat('weapons.awc') % KEYS.length;
    console.log(`[*] Hash de 'weapons.awc' -> índice llave: ${idx2}`);
    const dec2 = ngDecryptBlock(awcBlock, KEYS[idx2]);
    console.log(`  llave[${idx2}] -> ${dec2.toString('hex')}`);
}
