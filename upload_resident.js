/**
 * Sube RESIDENT.rpf desde la carpeta local "LHC Sound boost"
 * a la VPS en /opt/lhc-sound/RESIDENT.rpf
 *
 * Uso: node upload_resident.js
 */
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const LOCAL_PATH = path.join(__dirname, 'LHC Sound boost', 'RESIDENT.rpf');
const REMOTE_PATH = '/opt/lhc-sound/RESIDENT.rpf';

if (!fs.existsSync(LOCAL_PATH)) {
    console.error('ERROR: No se encontró RESIDENT.rpf en "LHC Sound boost/"');
    process.exit(1);
}

const fileSize = fs.statSync(LOCAL_PATH).size;
console.log(`Subiendo RESIDENT.rpf (${(fileSize / 1024 / 1024).toFixed(1)} MB) a la VPS...`);

const conn = new Client();

conn.on('ready', () => {
    console.log('Conectado. Iniciando transferencia SFTP...');

    conn.sftp((err, sftp) => {
        if (err) { console.error('SFTP error:', err); conn.end(); return; }

        // Ensure /opt/lhc-sound exists
        conn.exec('mkdir -p /opt/lhc-sound', (e, stream) => {
            if (e) { console.error('mkdir error:', e); conn.end(); return; }
            stream.on('close', () => {
                // Upload file
                const writeStream = sftp.createWriteStream(REMOTE_PATH);
                const readStream  = fs.createReadStream(LOCAL_PATH);

                let uploaded = 0;
                let lastPct  = 0;

                readStream.on('data', (chunk) => {
                    uploaded += chunk.length;
                    const pct = Math.floor((uploaded / fileSize) * 100);
                    if (pct >= lastPct + 5) {
                        lastPct = pct;
                        process.stdout.write(`\r  ${pct}% (${(uploaded / 1024 / 1024).toFixed(1)} MB)`);
                    }
                });

                writeStream.on('close', () => {
                    console.log('\nRESIDENT.rpf subido correctamente.');
                    conn.end();
                });

                writeStream.on('error', (e) => {
                    console.error('\nError al escribir:', e);
                    conn.end();
                });

                readStream.pipe(writeStream);
            });
            stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
        });
    });
}).connect({
    host: '187.33.157.103',
    port: 22,
    username: 'root',
    password: 'diScordLhcds032.w'
});
