
const fs = require('fs');
const path = require('path');

// Mock of the RPF parser logic (since we can't easily import ES modules here)
function extractFilenamesMock(buffer) {
  const filenames = new Set();
  const u8 = new Uint8Array(buffer);
  const extensions = ['.ytd', '.ydr', '.yft', '.ydd', '.ycd'];
  const weaponPrefixes = ['w_pi_', 'w_sb_', 'w_ar_', 'w_sg_', 'w_mg_', 'w_sr_', 'w_lr_', 'w_me_', 'w_ex_'];

  let currentStr = '';
  const maxSearch = Math.min(u8.length, 2 * 1024 * 1024);
  
  for (let i = 0; i < maxSearch; i++) {
    const byte = u8[i];
    if (byte >= 0x20 && byte <= 0x7E) {
      currentStr += String.fromCharCode(byte);
    } else {
      if (currentStr.length >= 4) {
        const lower = currentStr.toLowerCase();
        let found = false;
        for (const prefix of weaponPrefixes) {
          if (lower.includes(prefix)) {
            filenames.add(currentStr.trim());
            found = true;
            break;
          }
        }
        if (!found) {
          for (const ext of extensions) {
            if (lower.endsWith(ext)) {
              filenames.add(currentStr.trim());
              break;
            }
          }
        }
      }
      currentStr = '';
    }
  }
  return Array.from(filenames);
}

const armaDir = 'C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\arma';
const files = fs.readdirSync(armaDir);

console.log('--- TEST DE DETECCIÓN DE ARMAS ---');

files.forEach(file => {
  if (file.endsWith('.rpf')) {
    console.log(`\nAnalizando: ${file}...`);
    const buffer = fs.readFileSync(path.join(armaDir, file));
    const internalFiles = extractFilenamesMock(buffer);
    
    console.log(`Archivos encontrados dentro (${internalFiles.length}):`);
    internalFiles.slice(0, 5).forEach(f => console.log(` - ${f}`));
    if (internalFiles.length > 5) console.log(` ... y ${internalFiles.length - 5} más.`);

    // Check if vintage pistol would be detected
    const hasVintage = internalFiles.some(f => f.toLowerCase().includes('vintage'));
    const hasPistol = internalFiles.some(f => f.toLowerCase().includes('pistol'));
    
    console.log(`¿Contiene rastro de Vintage?: ${hasVintage ? 'SÍ ✅' : 'NO ❌'}`);
    console.log(`¿Contiene rastro de Pistol?: ${hasPistol ? 'SÍ ✅' : 'NO ❌'}`);
  }
});
