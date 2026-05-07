const fs = require('fs');

const inputFile = "C:\\Users\\esau2\\Desktop\\weapons.awc";
const magicFile = "C:\\Users\\esau2\\Desktop\\magic.bin";

function decryptNG(data, key, tables) {
    let keyIdx = 0;
    const rounds = 17;
    for (let i = 0; i < rounds; i++) {
        for (let j = 0; j < 16; j++) {
            const tableIdx = (i * 16 + j) * 256;
            data[j] = tables[tableIdx + data[j]] ^ key[keyIdx % key.length];
            keyIdx++;
        }
    }
}

console.log("[*] Iniciando ESCÁNER DE MEMORIA (Premium Deluxe)...");

try {
    const awcData = fs.readFileSync(inputFile);
    const magicData = fs.readFileSync(magicFile);

    console.log(`[*] Analizando magic.bin (${magicData.length} bytes)...`);

    // Intentamos encontrar las tablas NG dentro del magic.bin
    // Las tablas son bloques de 69,632 bytes (17 * 16 * 256)
    const tableSize = 17 * 16 * 256;
    let found = false;

    for (let offset = 0; offset < magicData.length - tableSize; offset += 4) {
        const tables = magicData.slice(offset, offset + tableSize);
        
        // Probamos una llave genérica de 272 bytes (o la extraemos también)
        const key = Buffer.alloc(272, 0); // Prueba inicial con llave nula
        
        let testBlock = Buffer.from(awcData.slice(0, 16));
        decryptNG(testBlock, key, tables);
        
        const magic = testBlock.slice(0, 4).toString('ascii');
        if (magic === "TADA" || magic === "ADAT") {
            console.log(`[✓] ¡TABLAS ENCONTRADAS EN OFFSET 0x${offset.toString(16)}!`);
            found = true;
            break;
        }
    }

    if (!found) {
        console.log("[!] No se han encontrado tablas estándar. Probando descifrado AES con offsets de magic.bin...");
        // Intentamos ver si el magic.bin contiene llaves AES
        for (let i = 0; i < magicData.length - 32; i += 16) {
            const aesKey = magicData.slice(i, i + 32);
            // ... (lógica AES similar a la anterior)
        }
    }

} catch (err) {
    console.error("[✗] Error: " + err.message);
}
