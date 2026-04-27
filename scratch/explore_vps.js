const { Client } = require('ssh2'); 
const conn = new Client(); 

conn.on('ready', () => { 
    console.log('Connected. Exploring VPS structure...');
    conn.exec('find /var/www/lhc-csharp -name "*.cs" -type f 2>/dev/null && echo "---" && ls -la /var/www/lhc-csharp/CodeWalkerApi/Controllers/ 2>/dev/null && echo "---" && find /var/www -name "WeaponConverter*" -type f 2>/dev/null && echo "---" && ls -la /var/www/lhc-csharp/ 2>/dev/null', (err, stream) => { 
        if (err) { console.error('Error:', err); conn.end(); return; }
        stream.on('close', () => { conn.end(); });
        stream.on('data', (d) => process.stdout.write(d.toString()));
        stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    }); 
}).connect({ host: '187.33.157.103', port: 22, username: 'root', password: 'diScordLhcds032.w' });
