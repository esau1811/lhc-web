const { Client } = require('ssh2');
const fs   = require('fs');
const path = require('path');

const MANIFEST_PATH = 'C:/Users/esau2/Desktop/weapons_manifest.json';
const WAVS_DIR      = 'C:/Users/esau2/Desktop/weapons';
const REMOTE_JSON   = '/var/www/lhc-node/weapons_manifest.json';
const REMOTE_WAVS   = '/var/www/lhc-node/weapons_wavs';

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const filesToUpload = Object.values(manifest).map(e => e.fileName);

const c = new Client();
c.on('ready', async () => {
    console.log('[SSH] Conectado');
    try {
        await run(c, `mkdir -p ${REMOTE_WAVS}`);
        const sftp = await getSftp(c);

        console.log('[*] Subiendo weapons_manifest.json...');
        await fastPut(sftp, MANIFEST_PATH, REMOTE_JSON);
        console.log('[✓] JSON subido');

        console.log(`[*] Subiendo ${filesToUpload.length} archivos WAV (con nombres bonitos)...`);
        let done = 0;
        for (const f of filesToUpload) {
            const localPath = path.join(WAVS_DIR, f);
            if (fs.existsSync(localPath)) {
                await fastPut(sftp, localPath, `${REMOTE_WAVS}/${f}`);
                done++;
                if (done % 50 === 0) console.log(`  ${done}/${filesToUpload.length} WAVs subidos...`);
            } else {
                console.log(`[!] Faltó: ${f}`);
            }
        }
        console.log(`[✓] ${done} WAVs subidos correctamente`);

        await run(c, 'systemctl restart lhc-sound && sleep 2');
        console.log('[✓] Servicio reiniciado');

        const result = await run(c, 'curl -s http://localhost:5000/api/Sound/manifest | head -c 200');
        console.log('[*] Manifest preview:', result);

    } catch(e) {
        console.error('[✗] Error:', e.message);
    } finally {
        c.end();
    }
});

function run(c, cmd) {
    return new Promise((resolve, reject) => {
        c.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let out = '';
            stream.on('data', d => { out += d; process.stdout.write(d.toString()); });
            stream.stderr.on('data', d => process.stderr.write(d.toString()));
            stream.on('close', () => resolve(out));
        });
    });
}
function getSftp(c) {
    return new Promise((resolve, reject) => { c.sftp((err, sftp) => err ? reject(err) : resolve(sftp)); });
}
function fastPut(sftp, local, remote) {
    return new Promise((resolve, reject) => { sftp.fastPut(local, remote, err => err ? reject(err) : resolve()); });
}

c.connect({ host: '187.33.157.103', port: 22, username: 'root', password: 'diScordLhcds032.w' });
