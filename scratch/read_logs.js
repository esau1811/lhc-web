const { Client } = require('ssh2'); 
const conn = new Client(); 

conn.on('ready', () => { 
    console.log('Connected. Reading server logs...');
    conn.exec('journalctl -u lhc-node.service --no-pager -n 50', (err, stream) => { 
        if (err) { console.error('Error:', err); conn.end(); return; }
        stream.on('close', () => { conn.end(); });
        stream.on('data', (d) => process.stdout.write(d.toString()));
        stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    }); 
}).connect({ host: '187.33.157.103', port: 22, username: 'root', password: 'diScordLhcds032.w' });
