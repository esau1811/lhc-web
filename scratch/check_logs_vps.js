const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    conn.exec('journalctl -u lhc-node.service --since "20 minutes ago" --no-pager', (err, stream) => {
        if (err) throw err;
        stream.on('data', (data) => {
            console.log(data.toString());
        }).on('close', () => {
            conn.end();
        });
    });
}).connect({
    host: '187.33.157.103',
    port: 22,
    username: 'root',
    password: 'diScordLhcds032.w'
});
