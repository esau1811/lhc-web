const fs = require('fs');
const crypto = require('crypto');

const dll = fs.readFileSync('C:\\Users\\esau2\\Desktop\\CodeWalker30_dev46\\CodeWalker.Core.dll');
const awcEncrypted = Buffer.from('158adf32f6754713d5ab481894feaaa5', 'hex');
const outDir = 'C:\\Users\\esau2\\Desktop';

console.log('[*] Buscando pc_awc_key en CodeWalker.Core.dll...');
console.log('[*] DLL:', dll.length, 'bytes');

// La pc_awc_key de Rockstar es 272 bytes (17 subllaves de 16 bytes)
// Probamos cada posición del DLL como llave NG de 272 bytes
// La identificamos si, combinada con las tablas del magic.bin, descifra "158adf32" -> "TADA"

const magic = fs.readFileSync('C:\\Users\\esau2\\Desktop\\magic.bin');
const TABLE_SIZE = 17 * 256; // 4352 bytes por tabla

// Cargar todas las tablas del magic.bin
const tables = [];
for (let off = 0; off + TABLE_SIZE <= magic.length; off += TABLE_SIZE) {
    const tbl = [];
    for (let r = 0; r < 17; r++) {
        tbl.push(magic.slice(off + r * 256, off + r * 256 + 256));
    }
    tables.push(tbl);
}
console.log('[*] Tablas NG del magic.bin:', tables.length);

// Función NG decrypt de 16 bytes con tablas Uint8
function ngDecryptBlock(block, key272, tableSet) {
    const out = Buffer.from(block.slice(0, 16));
    for (let round = 0; round < 17; round++) {
        const table = tableSet[round];
        const keyOff = round * 16;
        for (let b = 0; b < 16; b++) {
            out[b] = table[out[b]] ^ key272[keyOff + b];
        }
    }
    return out;
}

let found = 0;
console.log('[*] Probando cada posición del DLL como pc_awc_key (272 bytes)...');

for (let i = 0; i <= dll.length - 272; i += 4) {
    const keyCandidate = dll.slice(i, i + 272);
    
    // Filtro rápido: no puede tener más de 30 ceros en 272 bytes
    let zeros = 0;
    for (let z = 0; z < 272; z++) if (keyCandidate[z] === 0) zeros++;
    if (zeros > 30) continue;

    // Probar contra cada tabla del magic.bin
    for (let t = 0; t < tables.length; t++) {
        try {
            const dec = ngDecryptBlock(awcEncrypted, keyCandidate, tables[t]);
            const magic4 = dec.slice(0, 4).toString('ascii');
            if (magic4 === 'TADA' || magic4 === 'ADAT') {
                console.log(`\n[✓✓✓] ¡¡LLAVE ENCONTRADA!! offset=0x${i.toString(16)} tabla=${t}`);
                console.log(`       KEY (272 bytes): ${keyCandidate.toString('hex')}`);
                console.log(`       Resultado: ${dec.toString('hex')}`);
                fs.writeFileSync(`${outDir}\\pc_awc_key_real.dat`, keyCandidate);
                console.log(`[✓] Guardada como: pc_awc_key_real.dat`);
                found++;
                if (found >= 2) { process.exit(0); }
            }
        } catch(e) {}
    }
}

if (found === 0) {
    console.log('[✗] No encontrada en el DLL con las tablas actuales del magic.bin.');
}
console.log('[*] Escaneo completado.');
