const fs = require('fs');

function dumpRpf(path) {
    console.log('=== ' + path + ' ===');
    const buf = fs.readFileSync(path);
    if (buf.length < 16) return console.log('Too small');
    const magic = buf.readUInt32LE(0);
    if (magic !== 0x52504637) return console.log('Not RPF7 (got ' + magic.toString(16) + ')');
    const entriesCount = buf.readUInt32LE(4);
    const namesTableSize = buf.readUInt32LE(8);
    const namesOffset = 16 + entriesCount * 16;
    
    for (let i = 0; i < entriesCount; i++) {
        const off = 16 + i * 16;
        const nameOff = buf.readUInt32LE(off) & 0x00FFFFFF;
        const nameStrOff = namesOffset + nameOff;
        let name = '';
        if (nameStrOff < namesOffset + namesTableSize) {
            let j = nameStrOff;
            while (j < namesOffset + namesTableSize && buf[j] !== 0) {
                name += String.fromCharCode(buf[j]);
                j++;
            }
        }
        
        const type = buf.readUInt32LE(off + 12);
        if (type === 0x7FFFFF00) {
            console.log('[' + (name||'ROOT') + ']');
        } else {
            const size = buf.readUInt32LE(off + 4);
            console.log('  ' + name + '  size=' + size + ' flags=' + type.toString(16));
        }
    }
}

dumpRpf('test/Vintage Pistol (2).rpf');
dumpRpf('test/w_pi_combatpistol (1).rpf');