const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
    conn.sftp((err, sftp) => {
        if (err) throw err;
        const code = fs.readFileSync('scratch/v52_fixed.js'); // I'll write the fixed one now
        const ws = sftp.createWriteStream('/var/www/lhc-node/vps_server_v52.js');
        ws.on('close', () => {
            console.log('Uploaded. Restarting service...');
            conn.exec("sed -i 's/ExecStart=.*/ExecStart=\\/usr\\/bin\\/node \\/var\\/www\\/lhc-node\\/vps_server_v52.js/' /etc/systemd/system/lhc-node.service && systemctl daemon-reload && systemctl restart lhc-node.service", (err, stream) => {
                stream.on('close', () => conn.end());
            });
        });
        ws.end(code);
    });
}).connect({
    host: '187.33.157.103',
    port: 22,
    username: 'root',
    password: 'diScordLhcds032.w'
});
