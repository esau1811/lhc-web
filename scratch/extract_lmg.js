const fs = require('fs');
const rpf = fs.readFileSync('/tmp/uploaded_user.rpf');
// lmg_combat.awc is the first file? Or where is it?
// Let's use the actual offset. 
// TOC says: FileOffset = 2 (in 512-byte blocks). FileSize = 31006. Uncompressed = 55496.
fs.writeFileSync('/var/www/lhc-node/lmg.bin', rpf.slice(2 * 512, 2 * 512 + 31006));
console.log('Extracted exactly 31006 bytes to lmg.bin');
