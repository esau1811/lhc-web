const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();

const controllerCode = fs.readFileSync(
    path.join(__dirname, 'SoundController.cs'),
    'utf8'
);

conn.on('ready', () => {
    console.log('Conectado a VPS. Desplegando SoundController v1.0...');

    const cmd = [
        // Create output dir if needed
        'mkdir -p /opt/lhc-sound',
        // Write the controller file
        `cat > /var/www/lhc-csharp/CodeWalkerApi/Controllers/SoundController.cs << 'ENDOFCONTROLLER'\n${controllerCode}\nENDOFCONTROLLER`,
        // Build and publish
        'cd /var/www/lhc-csharp/CodeWalkerApi && dotnet publish -c Release -o bin/Publish 2>&1',
        // Restart service
        'systemctl restart lhc-api.service 2>&1',
        'sleep 2',
        // Verify it's running
        'systemctl is-active lhc-api.service',
        'echo "DEPLOY COMPLETE"'
    ].join(' && ');

    conn.exec(cmd, (err, stream) => {
        if (err) { console.error('SSH Error:', err); conn.end(); return; }
        stream.on('close', (code) => {
            console.log('Exit code:', code);
            conn.end();
        });
        stream.on('data', (d) => process.stdout.write(d.toString()));
        stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    });
}).connect({
    host: '187.33.157.103',
    port: 22,
    username: 'root',
    password: 'diScordLhcds032.w'
});
