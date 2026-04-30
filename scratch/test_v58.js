const { Client } = require('ssh2');
const fs = require('fs');

const c = new Client();
c.on('ready', () => {
    console.log('Connected.');
    c.sftp((err, sftp) => {
        if (err) { console.error(err); c.end(); return; }
        
        // Upload RPF
        const rpf = fs.readFileSync('arma/WEAPONS_PLAYER.rpf');
        sftp.writeFile('/tmp/test_wpf.rpf', rpf, (e) => {
            if (e) { console.error('Upload RPF error:', e); c.end(); return; }
            console.log('RPF uploaded (' + rpf.length + ' bytes)');
            
            // Generate a test tone and test the API
            const testScript = `
cd /tmp
ffmpeg -y -f lavfi -i "sine=frequency=440:duration=1" -ac 1 -ar 32000 -c:a pcm_s16le test_tone.wav 2>/dev/null
echo "Test tone created: $(ls -la test_tone.wav)"

# Call API
HTTP_CODE=$(curl -s -o /tmp/result.zip -w "%{http_code}" \
  -F "files=@/tmp/test_wpf.rpf" \
  -F "files=@/tmp/test_tone.wav" \
  http://localhost:5000/api/Sound/inject)

echo "HTTP status: $HTTP_CODE"
ls -la /tmp/result.zip 2>/dev/null

echo "=== SERVER LOGS ==="
journalctl -u lhc-node.service -n 30 --no-pager
`;
            
            c.exec(testScript, (err, stream) => {
                if (err) { console.error(err); c.end(); return; }
                let output = '';
                stream.on('data', (d) => { output += d.toString(); process.stdout.write(d); });
                stream.stderr.on('data', (d) => process.stderr.write(d));
                stream.on('close', () => {
                    // Clean up
                    c.exec('rm -f /tmp/test_wpf.rpf /tmp/test_tone.wav /tmp/result.zip', () => c.end());
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
