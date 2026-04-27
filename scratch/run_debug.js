// SSH to VPS, upload debug script + first 512 bytes of RPF, run it
const { Client } = require('ssh2');
const fs   = require('fs');
const path = require('path');

const SSH = { host: '187.33.157.103', port: 22, username: 'root', password: 'diScordLhcds032.w' };

function runCmd(conn, cmd) {
    return new Promise((res, rej) => {
        conn.exec(cmd, (e, s) => {
            if (e) return rej(e);
            let out = '';
            s.on('data', d => { out += d; process.stdout.write(d.toString()); });
            s.stderr.on('data', d => { out += d; process.stderr.write(d.toString()); });
            s.on('close', code => code ? rej(new Error('exit ' + code)) : res(out));
        });
    });
}

function uploadFile(conn, localPath, remotePath) {
    return new Promise((res, rej) => {
        conn.sftp((e, sftp) => {
            if (e) return rej(e);
            sftp.fastPut(localPath, remotePath, e2 => { sftp.end(); e2 ? rej(e2) : res(); });
        });
    });
}

async function main() {
    // Write first 512 bytes of RPF to a tmp file
    const rpfBuf = fs.readFileSync('LHC Sound boost/WEAPONS_PLAYER.rpf');
    const tmpRpf = path.join(require('os').tmpdir(), 'debug_rpf.bin');
    fs.writeFileSync(tmpRpf, rpfBuf.slice(0, 512));

    const conn = new Client();
    await new Promise((res, rej) => conn.on('ready', res).on('error', rej).connect(SSH));
    console.log('Connected');

    try {
        await uploadFile(conn, tmpRpf, '/tmp/debug_rpf.bin');
        await uploadFile(conn, 'scratch/debug_ng_vps.js', '/tmp/debug_ng.js');
        await runCmd(conn, 'node /tmp/debug_ng.js');
    } finally {
        conn.end();
    }
}

main().catch(e => { console.error(e.message); process.exit(1); });
