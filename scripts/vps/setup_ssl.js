const { Client } = require('ssh2');
const conn = new Client();

const commands = [
    "certbot --nginx -d 187.33.157.103.nip.io --non-interactive --agree-tos -m esau1811@gmail.com"
];

conn.on('ready', () => {
    console.log('SSH Ready. Requesting SSL Certificate...');
    conn.exec(commands.join(' && '), (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
            console.log('SSL Configuration finished with code ' + code);
            conn.end();
        }).on('data', (data) => process.stdout.write(data))
          .stderr.on('data', (data) => process.stderr.write(data));
    });
}).connect({
    host: '187.33.157.103',
    port: 22,
    username: 'root',
    password: 'diScordLhcds032.w'
});
