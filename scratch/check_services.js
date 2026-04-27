const { Client } = require('ssh2'); 
const conn = new Client(); 

conn.on('ready', () => { 
    console.log('Connected. Checking running services...');
    const cmd = `systemctl status lhc-api.service 2>&1; echo "==="; systemctl status lhc-node.service 2>&1; echo "==="; netstat -tlnp | grep -E '(5000|3001|8080)' 2>&1; echo "==="; cat /var/www/lhc-node/server.js 2>/dev/null | head -100; echo "==="; cat /etc/systemd/system/lhc-api.service 2>/dev/null; echo "==="; cat /etc/systemd/system/lhc-node.service 2>/dev/null`;
    conn.exec(cmd, (err, stream) => { 
        if (err) { console.error('Error:', err); conn.end(); return; }
        stream.on('close', () => { conn.end(); });
        stream.on('data', (d) => process.stdout.write(d.toString()));
        stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    }); 
}).connect({ host: '187.33.157.103', port: 22, username: 'root', password: 'diScordLhcds032.w' });
