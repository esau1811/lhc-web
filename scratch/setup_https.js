const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('Client ready');
    conn.exec('openssl req -x509 -newkey rsa:4096 -keyout /var/www/lhc-node/key.pem -out /var/www/lhc-node/cert.pem -days 365 -nodes -subj "/CN=187.33.157.103"', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('Certificates generated');
            conn.exec('fuser -k 5000/tcp; nohup node /var/www/lhc-node/server.js > /var/www/lhc-node/server.log 2>&1 &', (err, stream) => {
                if (err) throw err;
                stream.on('close', () => {
                    console.log('Server restarted');
                    conn.end();
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
