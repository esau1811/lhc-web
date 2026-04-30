// Deploy server_awc_v2.js → VPS
const { Client } = require('ssh2');
const fs = require('fs');

const c = new Client();
c.on('ready', () => {
    console.log('SSH listo');
    c.sftp((err, sftp) => {
        if (err) throw err;
        sftp.fastPut('scratch/server_awc_v2.js', '/var/www/lhc-node/server.js', (err) => {
            if (err) throw err;
            console.log('Archivo subido');
            c.exec('pkill -f "node server.js"; sleep 1; cd /var/www/lhc-node; nohup node server.js > server.log 2>&1 &', (err, stream) => {
                if (err) throw err;
                stream.on('data', d => process.stdout.write(d.toString()));
                stream.stderr.on('data', d => process.stderr.write(d.toString()));
                stream.on('close', () => { console.log('Servidor reiniciado'); c.end(); });
            });
        });
    });
}).connect({
    host: '187.33.157.103',
    port: 22,
    username: 'root',
    password: 'diScordLhcds032.w'
});
