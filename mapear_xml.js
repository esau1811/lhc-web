// Mapear nombre legible -> hash WAV del CodeWalker usando el XML
const fs = require('fs');

const xml = fs.readFileSync('C:/Users/esau2/Desktop/weapons.awc.xml', 'utf8');

// El XML tiene Items con Name (puede ser hash o legible) y FileName (el .wav exportado)
// Vamos a volcar TODOS los Items con sus nombres y archivos
const itemRegex = /<Item>([\s\S]*?)<\/Item>/gi;
let match;
const items = [];

while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const nameMatch    = block.match(/<Name>(.*?)<\/Name>/);
    const fileMatch    = block.match(/<FileName>(.*?)<\/FileName>/);
    const rateMatch    = block.match(/<SampleRate value="(\d+)"/);
    if (nameMatch && fileMatch) {
        items.push({
            name:  nameMatch[1],
            file:  fileMatch[1],
            rate:  rateMatch ? rateMatch[1] : '?'
        });
    }
}

console.log('Total sonidos en XML:', items.length);

// Buscar PTL_PISTOL
const pistol = items.filter(i => i.name.toLowerCase().includes('pistol') || i.name.toLowerCase().includes('ptl'));
console.log('\nResultados para pistola:');
pistol.forEach(i => console.log(' ', i.name, '->', i.file, '('+i.rate+'Hz)'));

// Mostrar también los primeros 20 para entender el formato
console.log('\nPrimeros 20 items:');
items.slice(0, 20).forEach(i => console.log(' ', i.name, '->', i.file, '('+i.rate+'Hz)'));

// Ver si hay alguno con hash EF4DFCD5
const byHash = items.filter(i => i.name.toLowerCase().includes('ef4d') || i.file.toLowerCase().includes('ef4d'));
console.log('\nItems con hash EF4DFCD5:', byHash.length, byHash);
