const fs   = require('fs');
const http  = require('https');

const AUDIO_PATH = 'C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\test_pcm.wav';
const audioBuf   = fs.readFileSync(AUDIO_PATH);
const soundName  = 'hash_00156060'; // primer sonido del manifest (existe)

console.log('[*] Audio:', audioBuf.length, 'bytes');
console.log('[*] Probando /api/Sound/rebuild-awc con soundName:', soundName);

const boundary = '----FB' + Date.now().toString(16);
function part(name, buf, filename, mime) {
    const hdr = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"` +
        (filename ? `; filename="${filename}"` : '') + `\r\n` +
        (mime ? `Content-Type: ${mime}\r\n` : '') + `\r\n`
    );
    return Buffer.concat([hdr, buf, Buffer.from('\r\n')]);
}

const body = Buffer.concat([
    part('audio',     audioBuf,               'test.wav', 'audio/wav'),
    part('soundName', Buffer.from(soundName)),
    Buffer.from(`--${boundary}--\r\n`)
]);

const options = {
    hostname: '187.33.157.103.nip.io',
    port: 443,
    path: '/api/Sound/rebuild-awc',
    method: 'POST',
    headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
    },
    rejectUnauthorized: false
};

const req = http.request(options, res => {
    console.log('[*] Status HTTP:', res.statusCode);
    const chunks = [];
    res.on('data', d => chunks.push(d));
    res.on('end', () => {
        const full = Buffer.concat(chunks);
        if (res.statusCode === 200) {
            fs.writeFileSync('resultado.zip', full);
            console.log('[✓] ÉXITO. resultado.zip guardado (' + full.length + ' bytes)');
        } else {
            console.log('[✗] Error:', full.toString('utf8').slice(0, 400));
        }
    });
});
req.on('error', e => console.error('[✗] Error red:', e.message));
req.write(body);
req.end();
