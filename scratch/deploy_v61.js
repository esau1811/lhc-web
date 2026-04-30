const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const c = new Client();
c.on('ready', () => {
    console.log('Connected. Uploading v61...');
    c.sftp((err, sftp) => {
        if (err) { console.error(err); c.end(); return; }
        const ws = sftp.createWriteStream('/var/www/lhc-node/vps_server_v61.js');
        const data = fs.readFileSync(path.join(__dirname, 'vps_server_v61.js'));
        ws.write(data);
        ws.end();
        ws.on('close', () => {
            console.log('File uploaded. Updating systemd and restarting...');
            const cmds = [
                'sed -i "s/vps_server_v60.js/vps_server_v61.js/g" /etc/systemd/system/lhc-node.service',
                'systemctl daemon-reload',
                'systemctl stop lhc-node',
                'fuser -k 5000/tcp 2>/dev/null || true',
                'sleep 1',
                'systemctl start lhc-node',
                'sleep 2',
                'curl -s http://localhost:5000/health'
            ].join(' && ');
            
            c.exec(cmds, (err, stream) => {
                if (err) { console.error(err); c.end(); return; }
                stream.on('data', (d) => process.stdout.write(d));
                stream.stderr.on('data', (d) => process.stderr.write(d));
                stream.on('close', () => c.end());
            });
        });
    });
}).connect({
    host: '187.33.157.103',
    port: 22,
    username: 'root',
    password: 'diScordLhcds032.w'
});
