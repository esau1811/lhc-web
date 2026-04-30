import paramiko, sys, time
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

# Show current state before patching
stdin, stdout, stderr = client.exec_command(
    'grep -n "ngDecrypt.*512\\|zip.addFile\\|closeRpfBuffer\\|mods/x64\\|x64/audio\\|finalRpf" /var/www/lhc-node/vps_server_v32.js'
)
print("=== BEFORE ===")
print(stdout.read().decode(errors='replace'))

patch = r"""
const fs = require('fs');
let src = fs.readFileSync('/var/www/lhc-node/vps_server_v32.js', 'utf8');
const orig = src;

// ──────────────────────────────────────────────────────────────────────
// FIX 1: Remove NG data-page decryption from openRpfBuffer
// ──────────────────────────────────────────────────────────────────────
// GTA V RPF7 data pages are NOT individually NG-encrypted — only the
// RPF header (entry table + name table) is. Trying to NG-decrypt plain
// AWC data corrupts it, so ADAT magic is never found and stream IDs
// come out as garbage, preventing sound replacement from working.
const ngDataMarker = 'ngDecrypt(result.slice(page * 512, page * 512 + size), GTA5_NG_KEYS[kIdx]).copy(result, page * 512);';
if (src.includes(ngDataMarker)) {
    const markerPos = src.indexOf(ngDataMarker);
    // Find the enclosing `if (encType === ENC_NG) {` that contains this line
    const blockStart = src.lastIndexOf('if (encType === ENC_NG)', markerPos);
    if (blockStart === -1) { console.error('ERROR: cannot find if(encType===ENC_NG) block'); process.exit(1); }
    // Walk braces to find the matching closing brace
    let depth = 0, i = blockStart;
    while (i < src.length) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
        i++;
    }
    // Remove the block (trim trailing whitespace before it, keep newline)
    const before = src.slice(0, blockStart).trimEnd();
    const after = src.slice(i);
    src = before + '\n' + after;
    console.log('FIX 1 OK: removed NG data-page decryption from openRpfBuffer');
} else {
    console.log('FIX 1 SKIP: ngDecrypt data-page marker not found (already removed?)');
}

// ──────────────────────────────────────────────────────────────────────
// FIX 2: AES re-encrypt header + output to x64/audio/sfx/ (no mods/)
// ──────────────────────────────────────────────────────────────────────
// User has no OpenIV / mods folder. Output goes directly to
// x64/audio/sfx/ with AES-encrypted header so GTA V accepts it
// without "Found encryption type OPEN" error.
const candidates = [
    // Most likely current state
    ['zip.addFile(`mods/x64/audio/sfx/${rpfName}`, modifiedRpf);',
     'const finalRpf = closeRpfBuffer(modifiedRpf);\n            zip.addFile(`x64/audio/sfx/${rpfName}`, finalRpf);'],
    // Already on x64/ but missing re-encrypt
    ['zip.addFile(`x64/audio/sfx/${rpfName}`, modifiedRpf);',
     'const finalRpf = closeRpfBuffer(modifiedRpf);\n            zip.addFile(`x64/audio/sfx/${rpfName}`, finalRpf);'],
    // Has closeRpfBuffer but wrong path
    ['zip.addFile(`mods/x64/audio/sfx/${rpfName}`, finalRpf);',
     'zip.addFile(`x64/audio/sfx/${rpfName}`, finalRpf);'],
];

let zipFixed = false;
for (const [old, rep] of candidates) {
    if (src.includes(old)) {
        src = src.replace(old, rep);
        console.log('FIX 2 OK: ZIP now uses closeRpfBuffer (AES) + x64/audio/sfx/');
        zipFixed = true;
        break;
    }
}
if (!zipFixed) {
    // Show context to diagnose
    const idx = src.indexOf('zip.addFile');
    if (idx >= 0) {
        console.log('FIX 2 WARN: zip.addFile found but no pattern matched:');
        console.log(JSON.stringify(src.slice(Math.max(0, idx-40), idx+160)));
    } else {
        console.log('FIX 2 WARN: zip.addFile not found in file');
    }
}

if (src === orig) {
    console.log('WARNING: file unchanged - patches already applied or patterns differ');
} else {
    fs.writeFileSync('/var/www/lhc-node/vps_server_v32.js', src, 'utf8');
    console.log('SAVED to vps_server_v32.js');
}
console.log('DONE');
"""

sftp = client.open_sftp()
with sftp.open('/tmp/fix_v33.js', 'w') as f:
    f.write(patch)
sftp.close()

stdin, stdout, stderr = client.exec_command('node /tmp/fix_v33.js 2>&1')
result = stdout.read().decode(errors='replace')
print("\n=== PATCH ===")
print(result)

if 'DONE' in result:
    # Verify changes
    stdin, stdout, stderr = client.exec_command(
        'grep -n "ngDecrypt.*512\\|zip.addFile\\|closeRpfBuffer\\|mods/x64\\|x64/audio\\|finalRpf" /var/www/lhc-node/vps_server_v32.js'
    )
    print("\n=== AFTER ===")
    print(stdout.read().decode(errors='replace'))

    # Kill any process on port 5000 (dotnet keeps grabbing it), then restart node
    stdin, stdout, stderr = client.exec_command(
        'kill -9 $(lsof -t -i:5000) 2>/dev/null; sleep 1; '
        'kill $(ps aux | grep "node /var/www" | grep -v grep | awk \'{print $2}\') 2>/dev/null; sleep 1; '
        'nohup /usr/bin/node /var/www/lhc-node/vps_server_v32.js > /var/log/lhc-node.log 2>&1 & echo PID:$!'
    )
    print("\n=== RESTART ===")
    print(stdout.read().decode(errors='replace'))

    time.sleep(3)
    stdin, stdout, stderr = client.exec_command('ps aux | grep "node /var/www" | grep -v grep')
    print("\n=== RUNNING ===")
    print(stdout.read().decode(errors='replace'))

    stdin, stdout, stderr = client.exec_command('tail -5 /var/log/lhc-node.log 2>/dev/null')
    print("\n=== NODE LOG ===")
    print(stdout.read().decode(errors='replace'))

client.close()
