import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

patch = r"""
const fs = require('fs');
const src = fs.readFileSync('/var/www/lhc-node/vps_server_v32.js', 'utf8');

// ── 1. Add closeRpfBuffer after openRpfBuffer ────────────────────────────
const closeRpfFn = `
function closeRpfBuffer(openBuf) {
    if (!GTA5_AES_KEY) return openBuf;
    const entryCount = openBuf.readUInt32LE(4);
    const namesLength = openBuf.readUInt32LE(8);
    const headerLen = entryCount * 16 + namesLength;
    const blockLen = Math.floor(headerLen / 16) * 16;
    const c = crypto.createCipheriv('aes-256-ecb', GTA5_AES_KEY, null);
    c.setAutoPadding(false);
    const encData = Buffer.concat([c.update(openBuf.slice(16, 16 + blockLen)), c.final()]);
    const result = Buffer.from(openBuf);
    result.writeUInt32LE(ENC_AES, 12);
    encData.copy(result, 16);
    return result;
}
`;

const anchor = 'function wavParsePcm(';
if (!src.includes(anchor)) { console.log('ERROR: anchor not found'); process.exit(1); }

// Only add if not already there
let patched = src;
if (!patched.includes('function closeRpfBuffer(')) {
    patched = patched.replace(anchor, closeRpfFn + anchor);
    console.log('ADDED closeRpfBuffer');
} else {
    console.log('closeRpfBuffer already present');
}

// ── 2. Replace the ZIP lines (FiveM resource format) with AES+direct path ──
// Current state has the FiveM manifest lines, replace with simple AES approach
const oldZip1 = `const manifest = [
                'fx_version \\'cerulean\\'',
                'game \\'gta5\\'',
                '',
                'files {',
                "    'audio/sfx/WEAPONS_PLAYER.rpf'",
                '}',
                '',
                "data_file 'AUDIO_WAVEPACK' 'audio/sfx/WEAPONS_PLAYER'",
            ].join('\\n');
            zip.addFile('lhc-sound/fxmanifest.lua', Buffer.from(manifest, 'utf8'));
            zip.addFile('lhc-sound/audio/sfx/WEAPONS_PLAYER.rpf', modifiedRpf);`;

const newZip1 = `const finalRpf = closeRpfBuffer(modifiedRpf);
            zip.addFile(\`x64/audio/sfx/\${rpfName}\`, finalRpf);`;

if (patched.includes(oldZip1)) {
    patched = patched.replace(oldZip1, newZip1);
    console.log('REPLACED ZIP format: FiveM resource -> AES direct path');
} else {
    // Maybe it still has the old mods/ format
    const oldZip2 = 'zip.addFile(`mods/x64/audio/sfx/${rpfName}`, modifiedRpf);';
    if (patched.includes(oldZip2)) {
        const newZip2 = `const finalRpf = closeRpfBuffer(modifiedRpf);\n            zip.addFile(\`x64/audio/sfx/\${rpfName}\`, finalRpf);`;
        patched = patched.replace(oldZip2, newZip2);
        console.log('REPLACED ZIP format: mods/ -> AES direct path');
    } else {
        // Show what we have to diagnose
        const idx = patched.indexOf('zip.addFile');
        console.log('WARNING: could not find ZIP line. Context:', JSON.stringify(patched.slice(idx, idx+200)));
    }
}

fs.writeFileSync('/var/www/lhc-node/vps_server_v32.js', patched, 'utf8');
console.log('DONE');
"""

sftp = client.open_sftp()
with sftp.open('/tmp/patch_aes.js', 'w') as f:
    f.write(patch)
sftp.close()

stdin, stdout, stderr = client.exec_command('node /tmp/patch_aes.js 2>&1')
result = stdout.read().decode(errors='replace')
print("=== PATCH ===")
print(result)

if 'DONE' in result:
    # Verify
    stdin, stdout, stderr = client.exec_command(
        'grep -n "closeRpfBuffer\\|finalRpf\\|x64/audio\\|lhc-sound\\|mods/x64" /var/www/lhc-node/vps_server_v32.js'
    )
    print("=== VERIFY ===")
    print(stdout.read().decode(errors='replace'))

    # Restart node
    stdin, stdout, stderr = client.exec_command(
        'kill $(ps aux | grep "node /var/www" | grep -v grep | awk \'{print $2}\') 2>/dev/null; '
        'sleep 1; '
        'nohup /usr/bin/node /var/www/lhc-node/vps_server_v32.js > /var/log/lhc-node.log 2>&1 & '
        'echo PID:$!'
    )
    print("=== RESTART ===")
    print(stdout.read().decode(errors='replace'))

client.close()
