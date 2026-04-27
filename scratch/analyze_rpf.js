const fs = require('fs');

const data = fs.readFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\arma\\MKII_LEOPARDO_LHC.rpf');

console.log('=== RPF7 DEEP ANALYSIS ===');

// Header
const magic = data.readUInt32LE(0);
const tocSize = data.readUInt32LE(4);  
const numEntries = data.readUInt32LE(8);
const encFlag = data.readUInt32LE(12);

console.log(`Magic: RPF7 ✓`);
console.log(`TOC Size (raw): ${tocSize} bytes`);
console.log(`Num Entries (raw): ${numEntries}`);
console.log(`Enc Flag: 0x${encFlag.toString(16)} = "${Buffer.from([encFlag&0xFF, (encFlag>>8)&0xFF, (encFlag>>16)&0xFF, (encFlag>>24)&0xFF]).toString('ascii')}"`);

// OPEN = not encrypted. TOC starts at byte 16.
// Each entry is 16 bytes.
// After entries comes the name table.
// Total TOC = entries + names = tocSize bytes

const entriesStart = 16;
const entriesEnd = entriesStart + (numEntries * 16);
const nameTableStart = entriesEnd;
const tocEnd = entriesStart + tocSize;

console.log(`\nEntries: ${entriesStart} to ${entriesEnd} (${numEntries} x 16 bytes)`);
console.log(`Name table: ${nameTableStart} to ${tocEnd}`);

// Read a name from the name table
function readName(nameOff) {
  let name = '';
  let pos = nameTableStart + nameOff;
  while (pos < data.length && data[pos] !== 0) {
    name += String.fromCharCode(data[pos]);
    pos++;
  }
  return name;
}

// Dump the name table
console.log('\n=== NAME TABLE RAW ===');
const nameTableData = data.slice(nameTableStart, Math.min(tocEnd, nameTableStart + 512));
for (let i = 0; i < nameTableData.length; i += 16) {
  const chunk = nameTableData.slice(i, Math.min(i + 16, nameTableData.length));
  const hex = Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(' ');
  const ascii = Array.from(chunk).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
  console.log(`  ${(nameTableStart + i).toString(16).padStart(6, '0')}: ${hex.padEnd(48)}  ${ascii}`);
}

// Parse entries - RPF7 entry format from CodeWalker
console.log('\n=== ENTRIES ===');
for (let i = 0; i < numEntries; i++) {
  const off = entriesStart + (i * 16);
  
  // First, read all 16 bytes as uint32s
  const d0 = data.readUInt32LE(off);
  const d1 = data.readUInt32LE(off + 4);
  const d2 = data.readUInt32LE(off + 8);
  const d3 = data.readUInt32LE(off + 12);
  
  // In RPF7, entry type is determined by d1
  // If d1 has bit 31 set (0x80000000), it's a resource entry
  // Otherwise check specific patterns
  
  const isResource = (d1 & 0x80000000) !== 0;
  
  // Name offset is stored differently depending on version
  // Try: nameOffset = d0 & 0xFFFF (lower 16 bits)
  const nameOffset = d0 & 0xFFFF;
  const name = readName(nameOffset);
  
  // Also try: nameOffset from upper bits
  const nameOffset2 = (d0 >> 16) & 0xFFFF;
  const name2 = readName(nameOffset2);
  
  const hex = data.slice(off, off + 16).toString('hex');
  
  if (i < 10 || name.length > 2 || name2.length > 2) {
    console.log(`  [${i}] hex: ${hex}`);
    console.log(`       d0=0x${d0.toString(16)} d1=0x${d1.toString(16)} d2=0x${d2.toString(16)} d3=0x${d3.toString(16)}`);
    console.log(`       nameOff1=${nameOffset} -> "${name.substring(0,40)}"`);
    console.log(`       nameOff2=${nameOffset2} -> "${name2.substring(0,40)}"`);
    console.log(`       isResource=${isResource}`);
  }
}

// Also search for known ASCII patterns in the first 2048 bytes
console.log('\n=== ASCII SEARCH (first 4096 bytes) ===');
let str = '';
for (let i = 0; i < Math.min(4096, data.length); i++) {
  const b = data[i];
  if (b >= 32 && b <= 126) {
    str += String.fromCharCode(b);
  } else {
    if (str.length >= 4) {
      console.log(`  Offset 0x${(i - str.length).toString(16)}: "${str}"`);
    }
    str = '';
  }
}

// Data alignment
const dataStart = Math.ceil(tocEnd / 512) * 512;
console.log(`\nData section starts at: 0x${dataStart.toString(16)}`);

// Search for weapon names in entire file
const weaponPatterns = ['w_pi_pistol', 'w_ar_assault', 'pistolmk2', 'vintage'];
for (const pattern of weaponPatterns) {
  const buf = Buffer.from(pattern, 'ascii');
  let idx = 0;
  const locations = [];
  while ((idx = data.indexOf(buf, idx)) !== -1) {
    locations.push(`0x${idx.toString(16)}`);
    idx++;
  }
  console.log(`  "${pattern}" found at: ${locations.length > 0 ? locations.join(', ') : 'NOT FOUND'}`);
}
