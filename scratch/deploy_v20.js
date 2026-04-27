// Deploy v20: NG/AES RPF decryption support
// 1. Download GTA5 key files from gizzdev/gtautil to /opt/lhc-keys
// 2. Upload vps_server_v20.js as /var/www/lhc-node/server.js
// 3. Restart lhc-node.service

const { Client } = require('ssh2');
const fs         = require('fs');
const path       = require('path');

const SSH = { host: '187.33.157.103', port: 22, username: 'root', password: 'diScordLhcds032.w' };

const SERVER_LOCAL = path.join(__dirname, 'vps_server_v20.js');
const SERVER_REMOTE = '/var/www/lhc-node/server.js';

const KEY_BASE_URL = 'https://raw.githubusercontent.com/gizzdev/gtautil/master/gtautil/Resources';
const KEY_FILES = [
    'gtav_aes_key.dat',
    'gtav_ng_key.dat',
    'gtav_ng_decrypt_tables.dat',
    'gtav_hash_lut.dat',
];

function runCmd(conn, cmd) {
    return new Promise((resolve, reject) => {
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let out = '';
            stream.on('data',   d => { out += d.toString(); process.stdout.write(d.toString()); });
            stream.stderr.on('data', d => { out += d.toString(); process.stderr.write(d.toString()); });
            stream.on('close', code => {
                if (code !== 0) return reject(new Error(`Command failed (exit ${code}): ${cmd}\n${out}`));
                resolve(out.trim());
            });
        });
    });
}

function uploadFile(conn, localPath, remotePath) {
    return new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            console.log(`Uploading ${path.basename(localPath)} → ${remotePath}`);
            sftp.fastPut(localPath, remotePath, err2 => {
                sftp.end();
                if (err2) return reject(err2);
                console.log(`  Done: ${path.basename(localPath)}`);
                resolve();
            });
        });
    });
}

async function deploy() {
    const conn = new Client();
    await new Promise((resolve, reject) => {
        conn.on('ready', resolve).on('error', reject).connect(SSH);
    });
    console.log('Connected to VPS');

    try {
        // 1. Create keys directory
        console.log('\n[1] Creating /opt/lhc-keys...');
        await runCmd(conn, 'mkdir -p /opt/lhc-keys');

        // 2. Download key files from GitHub
        console.log('\n[2] Downloading GTA5 crypto key files...');
        for (const keyFile of KEY_FILES) {
            const url = `${KEY_BASE_URL}/${keyFile}`;
            const dest = `/opt/lhc-keys/${keyFile}`;
            // Check if already downloaded
            const exists = await runCmd(conn, `test -f "${dest}" && echo yes || echo no`);
            if (exists === 'yes') {
                console.log(`  ${keyFile}: already present, skipping`);
            } else {
                console.log(`  Downloading ${keyFile}...`);
                await runCmd(conn, `curl -fsSL -o "${dest}" "${url}"`);
                const size = await runCmd(conn, `wc -c < "${dest}"`);
                console.log(`  ${keyFile}: ${size.trim()} bytes`);
            }
        }

        // 3. Verify key files
        console.log('\n[3] Verifying key files...');
        const keyCheck = await runCmd(conn, 'ls -la /opt/lhc-keys/');
        console.log(keyCheck);

        // 4. Upload v20 server
        console.log('\n[4] Uploading vps_server_v20.js...');
        await uploadFile(conn, SERVER_LOCAL, SERVER_REMOTE);

        // 5. Restart service
        console.log('\n[5] Restarting lhc-node.service...');
        await runCmd(conn, 'systemctl restart lhc-node.service');
        await new Promise(r => setTimeout(r, 2000));

        // 6. Verify
        console.log('\n[6] Verifying...');
        const ping = await runCmd(conn, 'curl -s http://localhost:5000/ping');
        console.log('Ping:', ping);

        const soundTest = await runCmd(conn, 'curl -s http://localhost:5000/api/Sound/test');
        console.log('Sound test:', soundTest);

        console.log('\n✓ v20 deployed successfully!');
        console.log('  - NG/AES encrypted RPF decryption: enabled');
        console.log('  - GTA5 key files: /opt/lhc-keys/');
        console.log('  - Server: /var/www/lhc-node/server.js');

    } finally {
        conn.end();
    }
}

deploy().catch(err => {
    console.error('Deploy failed:', err.message || err);
    process.exit(1);
});
