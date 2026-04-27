'use strict';
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const SSH = { host: '187.33.157.103', port: 22, username: 'root', password: 'diScordLhcds032.w' };

async function deploy() {
    const conn = new Client();
    
    await new Promise((resolve, reject) => {
        conn.on('ready', resolve).on('error', reject).connect(SSH);
    });
    console.log('Connected to VPS\n');

    // Upload server.js
    console.log('[1] Uploading vps_server_v21.js...');
    const serverCode = fs.readFileSync(path.join(__dirname, 'vps_server_v21.js'));
    await new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            const ws = sftp.createWriteStream('/var/www/lhc-node/server.js');
            ws.on('close', () => { sftp.end(); resolve(); });
            ws.on('error', reject);
            ws.end(serverCode);
        });
    });
    console.log('  Done: vps_server_v21.js\n');

    // Restart service
    console.log('[2] Restarting lhc-node.service...');
    await runSSH(conn, 'systemctl restart lhc-node.service');
    await new Promise(r => setTimeout(r, 2000));

    // Verify
    console.log('\n[3] Verifying...');
    const ping = await runSSH(conn, 'curl -s http://localhost:5000/ping');
    console.log('Ping:', ping.trim());
    const test = await runSSH(conn, 'curl -s http://localhost:5000/api/Sound/test');
    console.log('Sound test:', test.trim());

    console.log('\n✓ v21 deployed successfully!');
    console.log('  - Kill Sound endpoint: POST /api/Sound/kill');
    console.log('  - Weapon Sound endpoint: POST /api/Sound/weapon');
    conn.end();
}

function runSSH(conn, cmd) {
    return new Promise((resolve, reject) => {
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let out = '';
            stream.on('data', d => out += d.toString());
            stream.stderr.on('data', d => out += d.toString());
            stream.on('close', () => resolve(out));
        });
    });
}

deploy().catch(e => { console.error('Deploy failed:', e.message); process.exit(1); });
