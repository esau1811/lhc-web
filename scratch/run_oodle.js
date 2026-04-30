const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
    c.sftp((e, sftp) => {
        sftp.fastPut('scratch/OodleTool.cs', '/var/www/lhc-node/OodleTool.cs', () => {
            c.exec('cd /var/www/lhc-node && mcs OodleTool.cs && xvfb-run wine OodleTool.exe', (e, s) => {
                s.on('data', d => process.stdout.write(d));
                s.stderr.on('data', d => process.stderr.write(d));
                s.on('close', () => c.end());
            });
        });
    });
}).connect({host:'187.33.157.103', port:22, username:'root', password:'diScordLhcds032.w'});
