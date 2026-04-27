import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

# The problem: FiveM does NOT load audio RPFs from the mods/ folder.
# The fix: output a FiveM server resource ZIP with fxmanifest.lua
# User puts the resource in server-data/resources/ and adds "ensure lhc-sound" to server.cfg

# 1. Show current inject endpoint (ZIP generation) to confirm current state
stdin, stdout, stderr = client.exec_command(
    'grep -n "zip.addFile\\|Content-Disposition\\|mods/" /var/www/lhc-node/vps_server_v32.js'
)
print("=== CURRENT ZIP LINES ===")
current = stdout.read().decode(errors='replace')
print(current)

# 2. Find the exact line with zip.addFile to patch
stdin, stdout, stderr = client.exec_command(
    'grep -n "zip.addFile" /var/www/lhc-node/vps_server_v32.js'
)
zip_lines = stdout.read().decode(errors='replace').strip()
print("=== zip.addFile LINES ===")
print(zip_lines)

# 3. Apply the patch — change ZIP structure from mods/ path to FiveM resource
# Old: zip.addFile(`mods/x64/audio/sfx/${rpfName}`, modifiedRpf);
# New: add fxmanifest.lua + audio/sfx/WEAPONS_PLAYER.rpf in resource folder
patch = r"""
const fs = require('fs');

const src = fs.readFileSync('/var/www/lhc-node/vps_server_v32.js', 'utf8');

// Find and replace the zip.addFile line
const oldLine = "zip.addFile(`mods/x64/audio/sfx/${rpfName}`, modifiedRpf);";
const newLines = `const manifest = [
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

if (!src.includes(oldLine)) {
    console.log('ERROR: old line not found');
    console.log('Looking for:', JSON.stringify(oldLine));
    // Show surrounding context
    const idx = src.indexOf('zip.addFile');
    console.log('Found zip.addFile at index:', idx);
    console.log('Context:', JSON.stringify(src.slice(idx, idx+120)));
    process.exit(1);
}

const patched = src.replace(oldLine, newLines);
fs.writeFileSync('/var/www/lhc-node/vps_server_v32.js', patched, 'utf8');
console.log('PATCH OK: ZIP now outputs FiveM resource format');
console.log('Lines changed: zip.addFile mods/ -> lhc-sound/ resource with fxmanifest.lua');
"""

sftp = client.open_sftp()
with sftp.open('/tmp/patch_fivem_zip.js', 'w') as f:
    f.write(patch)
sftp.close()

stdin, stdout, stderr = client.exec_command('node /tmp/patch_fivem_zip.js 2>&1')
result = stdout.read().decode(errors='replace')
print("=== PATCH RESULT ===")
print(result)

if 'PATCH OK' in result:
    # 4. Verify the patch took effect
    stdin, stdout, stderr = client.exec_command(
        'grep -n "fxmanifest\\|lhc-sound\\|AUDIO_WAVEPACK\\|mods/x64" /var/www/lhc-node/vps_server_v32.js'
    )
    print("=== VERIFICATION ===")
    print(stdout.read().decode(errors='replace'))

    # 5. Restart the service
    stdin, stdout, stderr = client.exec_command('pm2 restart lhc-node 2>&1 && sleep 2 && pm2 status 2>&1')
    print("=== PM2 RESTART ===")
    print(stdout.read().decode(errors='replace'))
else:
    # Show what zip.addFile lines look like to diagnose
    stdin, stdout, stderr = client.exec_command(
        'grep -n "zip.addFile\\|addFile" /var/www/lhc-node/vps_server_v32.js'
    )
    print("=== ALL addFile LINES (for manual fix) ===")
    print(stdout.read().decode(errors='replace'))

client.close()
