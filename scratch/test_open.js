// Test: try to convert the uploaded RPF to OPEN using ArchiveFix
// Then read the first AWC bytes to see if they make sense
const {exec} = require('child_process');
const fs = require('fs');

fs.copyFileSync('/tmp/uploaded_user.rpf', '/tmp/rpf_open_test.rpf');

// First try: ArchiveFix donotuse_really
exec('xvfb-run wine /var/www/lhc-node/ArchiveFix.exe donotuse_really /tmp/rpf_open_test.rpf 2>/dev/null', (e) => {
    const b = fs.readFileSync('/tmp/rpf_open_test.rpf');
    const et = b.readUInt32LE(12);
    console.log('After donotuse_really: ET=0x' + et.toString(16));
    
    if (et === 0 || et === 0x4E45504F) {
        console.log('IS OPEN! Reading TOC directly...');
        const ec = b.readUInt32LE(4);
        const nl = b.readUInt32LE(8);
        const nts = ec * 16;
        // Read TOC raw (no decryption needed for OPEN)
        const toc = b.slice(16, 16 + ec * 16 + nl);
        for (let i = 0; i < ec; i++) {
            const eo = i * 16;
            const nameOff = toc.readUInt16LE(eo);
            const us = toc.readUInt32LE(eo + 8);
            const page = toc[eo+5] | (toc[eo+6]<<8) | (toc[eo+7]<<16);
            let name = '', p = nts + nameOff;
            while (p < nts + nl && toc[p] !== 0) name += String.fromCharCode(toc[p++]);
            if (!name.endsWith('.awc')) continue;
            const awcOff = page * 512;
            const first8 = b.slice(awcOff, awcOff + 8);
            console.log(name + ': page=' + page + ' first8=' + first8.toString('hex'));
            break; // Just check first one
        }
    } else {
        console.log('Still encrypted. Trying different approach...');
        // Try: set ET to OPEN manually and see if TOC is readable
        const test = Buffer.from(b);
        test.writeUInt32LE(0, 12); // ET = 0 (OPEN)
        const ec = test.readUInt32LE(4);
        const nl = test.readUInt32LE(8);
        const nts = ec * 16;
        const toc = test.slice(16, 16 + ec * 16 + nl);
        for (let i = 0; i < ec; i++) {
            const eo = i * 16;
            const entryType = toc.readUInt32LE(eo + 4);
            const nameOff = toc.readUInt16LE(eo);
            let name = '', p = nts + nameOff;
            while (p < nts + nl && toc[p] !== 0 && p < toc.length) name += String.fromCharCode(toc[p++]);
            console.log('Entry ' + i + ': type=0x' + entryType.toString(16) + ' name="' + name + '"');
            if (i > 3) break;
        }
    }
});
