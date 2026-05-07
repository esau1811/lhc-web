const fs = require('fs');
const xmlPath = "C:\\Users\\esau2\\Desktop\\weapons.awc.xml";

if (!fs.existsSync(xmlPath)) {
    console.log("[✗] No se encuentra el XML en el escritorio.");
    process.exit(1);
}

const xml = fs.readFileSync(xmlPath, 'utf8');

// Buscamos PTL_PISTOL_SHOT.R o su variante de hash
const searchName = "PTL_PISTOL_SHOT.R";
const regex = new RegExp("<Item>\\s*<Name>(.*?)</Name>[\\s\\S]*?<FileName>(.*?)</FileName>", "gi");

let match;
let found = false;

while ((match = regex.exec(xml)) !== null) {
    if (match[1].toLowerCase() === searchName.toLowerCase() || match[1].includes("ef4dfcd5") || match[1].includes("1d2c90a8")) {
        console.log(`[✓] SONIDO LOCALIZADO: ${match[1]} -> Archivo: ${match[2]}`);
        found = true;
        break;
    }
}

if (!found) {
    console.log("[!] No se encontró por nombre. Listando sonidos de 32000 Hz...");
    const freqRegex = new RegExp("<Item>[\\s\\S]*?<SampleRate value=\"32000\" />[\\s\\S]*?<FileName>(.*?)</FileName>", "gi");
    while ((match = freqRegex.exec(xml)) !== null) {
        console.log(`[*] Candidato (32kHz): ${match[1]}`);
    }
}
