const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const c = new Client();
c.on('ready', () => {
    console.log('Connected. Uploading script...');
    c.sftp((err, sftp) => {
        if (err) { console.error(err); c.end(); return; }
        const ws = sftp.createWriteStream('/var/www/lhc-node/patch_il.js');
        const data = fs.readFileSync(path.join(__dirname, 'patch_il.js'));
        ws.write(data);
        ws.end();
        ws.on('close', () => {
            console.log('File uploaded. Running patch and reassembling ArchiveFix...');
            const cmds = [
                'cd /var/www/lhc-node',
                'node patch_il.js',
                'ilasm /exe ArchiveFix.il /output:ArchiveFix_Linux.exe',
                'chmod +x ArchiveFix_Linux.exe',
                'mono ArchiveFix_Linux.exe' // Test if it runs
            ].join(' && ');
            
            c.exec(cmds, (err, stream) => {
                if (err) { console.error(err); c.end(); return; }
                stream.on('data', (d) => process.stdout.write(d));
                stream.stderr.on('data', (d) => process.stderr.write(d));
                stream.on('close', () => c.end());
            });
        });
    });
}).connect({
    host: '187.33.157.103',
    port: 22,
    username: 'root',
    password: 'diScordLhcds032.w'
});
