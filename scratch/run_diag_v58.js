// Deploy diag_v58.js to VPS and run it
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const c = new Client();
c.on('ready', () => {
    console.log('Connected. Uploading files...');
    c.sftp((err, sftp) => {
        if (err) { console.error(err); c.end(); return; }
        
        // Upload RPF
        const rpfStream = sftp.createWriteStream('/tmp/wp_diag.rpf');
        const rpfData = fs.readFileSync(path.join(__dirname, '..', 'arma', 'WEAPONS_PLAYER.rpf'));
        rpfStream.write(rpfData);
        rpfStream.end();
        
        rpfStream.on('close', () => {
            console.log('RPF uploaded. Uploading diagnostic script...');
            
            // Upload diag script
            const diagStream = sftp.createWriteStream('/tmp/diag_v58.js');
            const diagData = fs.readFileSync(path.join(__dirname, 'diag_v58.js'));
            diagStream.write(diagData);
            diagStream.end();
            
            diagStream.on('close', () => {
                console.log('Running diagnostic...');
                c.exec('node /tmp/diag_v58.js 2>&1', { timeout: 60000 }, (err, stream) => {
                    if (err) { console.error(err); c.end(); return; }
                    let output = '';
                    stream.on('data', (d) => { output += d.toString(); process.stdout.write(d); });
                    stream.on('close', () => {
                        c.exec('rm /tmp/wp_diag.rpf /tmp/diag_v58.js', () => c.end());
                    });
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
