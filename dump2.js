const fs = require('fs');

function dumpRpf(path) {
    const buf = fs.readFileSync(path);
    const m = buf.slice(0, 4).toString();
    console.log(path + ' magic: ' + m);
}

dumpRpf('test/Vintage Pistol (2).rpf');
dumpRpf('test/w_pi_combatpistol (1).rpf');