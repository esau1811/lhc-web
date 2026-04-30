const fs = require('fs');
let il = fs.readFileSync('/var/www/lhc-node/ArchiveFix.il', 'utf8');

// Find the start of the AnonymousType class
const startMatch = il.match(/\.class [^\{]*?AnonymousType0/);
if (startMatch) {
    const startIndex = startMatch.index;
    // Find the end of this class (it's a top-level class, so search for next .class or .namespace)
    const nextIndex = il.indexOf('.namespace', startIndex + 1);
    if (nextIndex !== -1) {
        console.log(`Removing problematic class at offset ${startIndex} to ${nextIndex}`);
        il = il.substring(0, startIndex) + il.substring(nextIndex);
        fs.writeFileSync('/var/www/lhc-node/ArchiveFix.il', il);
        console.log('Removed AnonymousType0 from IL.');
    }
} else {
    console.log('AnonymousType0 not found.');
}
