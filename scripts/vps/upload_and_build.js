const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

const controllerContent = fs.readFileSync('WeaponController.cs', 'utf8');

conn.on('ready', () => {
    console.log('SSH Ready. Materializing Controller inside VPS...');
    conn.exec(`cat <<EOF > /var/www/lhc-csharp/CodeWalkerApi/Controllers/WeaponConverterController.cs\n${controllerContent}\nEOF`, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
            console.log('Controller uploaded. Building project...');
            conn.exec('cd /var/www/lhc-csharp/CodeWalkerApi && dotnet build', (err2, stream2) => {
                if (err2) throw err2;
                stream2.on('close', (code2) => {
                    console.log('Build finished with code ' + code2);
                    conn.end();
                }).on('data', (data) => process.stdout.write(data));
            });
        }).on('data', (data) => process.stdout.write(data));
    });
}).connect({
    host: '187.33.157.103',
    port: 22,
    username: 'root',
    password: 'diScordLhcds032.w'
});
