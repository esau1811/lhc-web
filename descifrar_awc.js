const fs = require('fs');
const path = require('path');

const inputFile = "C:\\Users\\esau2\\Desktop\\weapons.awc";
const outputFile = "C:\\Users\\esau2\\Desktop\\weapons_DESBLOQUEADO.awc";
const workDir = "C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC";

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

console.log("[*] Iniciando ATAQUE MAESTRO COMBINADO (NG)...");

try {
    const awcData = fs.readFileSync(inputFile);
    
    // Listamos todos los candidatos
    const tableFiles = [1,2,3,4,5,6].map(n => path.join(workDir, `candidato_${n}.dat`));
    const keyFiles = [1,2,3,4].map(n => path.join(workDir, `keys_candidato_${n}.dat`));

    let found = false;

    for (const tPath of tableFiles) {
        if (!fs.existsSync(tPath)) continue;
        const tables = fs.readFileSync(tPath);
        
        for (const kPath of keyFiles) {
            if (!fs.existsSync(kPath)) continue;
            const keysAll = fs.readFileSync(kPath);
            
            console.log(`[*] Probando Tabla ${path.basename(tPath)} con Llaves ${path.basename(kPath)}...`);

            for (let k = 0; k < 101; k++) {
                const currentKey = keysAll.slice(k * 272, (k + 1) * 272);
                if (currentKey.length < 272) continue;

                let testBlock = Buffer.from(awcData.slice(0, 16));
                decryptNG(testBlock, currentKey, tables);
                
                const magic = testBlock.slice(0, 4).toString('ascii');
                if (magic === "TADA" || magic === "ADAT") {
                    console.log(`[✓] ¡¡¡ENCONTRADO!!!`);
                    console.log(`[!] Tabla: ${path.basename(tPath)}`);
                    console.log(`[!] Juego de Llaves: ${path.basename(kPath)}`);
                    console.log(`[!] Índice de Llave: ${k}`);
                    
                    const finalBuffer = Buffer.from(awcData);
                    decryptNG(finalBuffer, currentKey, tables);
                    fs.writeFileSync(outputFile, finalBuffer);
                    console.log("[!] ARCHIVO DESBLOQUEADO GUARDADO EN EL ESCRITORIO.");
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
        if (found) break;
    }

    if (!found) {
        console.log("[✗] Ninguna combinación de las extraídas ha funcionado.");
    }

} catch (err) {
    console.error("[✗] Error: " + err.message);
}
