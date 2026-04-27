const { Client } = require('ssh2'); 
const conn = new Client(); 

conn.on('ready', () => { 
    console.log('Connected. Reading full server.js...');
    conn.exec('cat /var/www/lhc-node/server.js', (err, stream) => { 
        if (err) { console.error('Error:', err); conn.end(); return; }
        let output = '';
        stream.on('close', () => { 
            require('fs').writeFileSync('scratch/current_server.js', output);
            console.log(`Written ${output.length} bytes to scratch/current_server.js`);
            conn.end(); 
        });
        stream.on('data', (d) => { output += d.toString(); });
        stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    }); 
}).connect({ host: '187.33.157.103', port: 22, username: 'root', password: 'diScordLhcds032.w' });
