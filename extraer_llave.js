const fs = require('fs');
const path = require('path');

const magicPath = "C:\\Users\\esau2\\Desktop\\magic.bin";
const outPath = "C:\\Users\\esau2\\Desktop\\llave_final.dat";

console.log("[*] Buscando llave en magic.bin...");

try {
    const bytes = fs.readFileSync(magicPath);
    // Firma NG: 06 1E EB A6
    let found = false;
    for (let i = 0; i < bytes.length - 4; i++) {
        if (bytes[i] === 0x06 && bytes[i+1] === 0x1E && bytes[i+2] === 0xEB) {
            const table = bytes.slice(i, i + 69632);
            fs.writeFileSync(outPath, table);
            console.log("[✓] LLAVE LOCALIZADA EN OFFSET " + i);
            console.log("[!] Archivo guardado como: llave_final.dat");
            found = true;
            break;
        }
    }
    if (!found) console.log("[✗] Firma no encontrada en este magic.bin");
} catch (err) {
    console.log("[✗] Error: " + err.message);
}
