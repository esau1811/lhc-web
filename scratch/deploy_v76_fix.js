const { Client } = require('ssh2');
const fs = require('fs');

const c = new Client();
c.on('ready', () => {
    console.log('Client ready');
    c.sftp((err, sftp) => {
        if (err) throw err;
        console.log('SFTP ready');
        sftp.fastPut('scratch/server_awc.js', '/var/www/lhc-node/server.js', (err) => {
            if (err) throw err;
            console.log('File uploaded');
            c.exec('pkill -f "node server.js"; sleep 1; cd /var/www/lhc-node; nohup node server.js > server.log 2>&1 &', (err, stream) => {
                if (err) throw err;
                stream.on('data', (data) => console.log('STDOUT: ' + data));
                stream.stderr.on('data', (data) => console.log('STDERR: ' + data));
                stream.on('close', () => {
                    console.log('Server restarted');
                    c.end();
                });
            });
        });
    });
}).connect({
    host: '187.33.157.103',
    port: 22,
    username: 'root',
    password: 'diScordLhcds032.w'
});
