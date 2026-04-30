const fs = require('fs');
const il = fs.readFileSync('/var/www/lhc-node/ArchiveFix.il', 'utf8');
const lines = il.split('\n');
console.log(lines.slice(285, 315).join('\n'));
