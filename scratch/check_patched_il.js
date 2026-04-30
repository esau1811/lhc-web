const fs = require('fs');
const il = fs.readFileSync('/var/www/lhc-node/ArchiveFix.il', 'utf8');
const index = il.indexOf('get_IsInvokedFromConsole');
if (index !== -1) {
    console.log(il.substring(index - 50, index + 200));
} else {
    console.log('Not found');
}
