import paramiko, sys, time
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

# Show current closeRpfBuffer
stdin, stdout, stderr = client.exec_command(
    'awk "/^function closeRpfBuffer/,/^function [a-zA-Z]/" /var/www/lhc-node/vps_server_v32.js | head -20'
)
print("=== CURRENT closeRpfBuffer ===")
print(stdout.read().decode(errors='replace'))

patch = r"""
const fs = require('fs');
let src = fs.readFileSync('/var/www/lhc-node/vps_server_v32.js', 'utf8');

// Replace closeRpfBuffer with a version that aligns namesLength to 16-byte boundary.
// GTA V AES RPFs always have headers that are exact multiples of 16 bytes.
// If namesLength % 16 != 0, the unencrypted remainder causes exceptions when GTA V
// tries to AES-decrypt the full headerLen.
const oldFn = `function closeRpfBuffer(openBuf) {
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
}`;

const newFn = `function closeRpfBuffer(openBuf) {
    if (!GTA5_AES_KEY) return openBuf;
    const entryCount = openBuf.readUInt32LE(4);
    const namesLength = openBuf.readUInt32LE(8);
    // Align namesLength to 16-byte boundary (GTA V AES RPFs require this)
    const namesLengthAligned = namesLength % 16 === 0 ? namesLength : namesLength + (16 - namesLength % 16);
    const headerLen = entryCount * 16 + namesLengthAligned;
    // The extra bytes (namesLength..namesLengthAligned) are already zeros in the buffer
    // (they sit between the names table and the first 512-byte data sector)
    const result = Buffer.from(openBuf);
    result.writeUInt32LE(namesLengthAligned, 8); // update namesLength to aligned value
    result.writeUInt32LE(ENC_AES, 12);
    const c = crypto.createCipheriv('aes-256-ecb', GTA5_AES_KEY, null);
    c.setAutoPadding(false);
    const encData = Buffer.concat([c.update(result.slice(16, 16 + headerLen)), c.final()]);
    encData.copy(result, 16);
    return result;
}`;

if (src.includes(oldFn)) {
    src = src.replace(oldFn, newFn);
    console.log('REPLACED closeRpfBuffer with aligned version');
} else {
    // Try to find any closeRpfBuffer and show context
    const idx = src.indexOf('function closeRpfBuffer');
    if (idx >= 0) {
        console.log('WARNING: closeRpfBuffer found but exact text did not match');
        console.log('Context:', JSON.stringify(src.slice(idx, idx + 500)));
    } else {
        console.log('ERROR: closeRpfBuffer not found');
    }
    process.exit(1);
}

fs.writeFileSync('/var/www/lhc-node/vps_server_v32.js', src, 'utf8');
console.log('DONE');
"""

sftp = client.open_sftp()
with sftp.open('/tmp/fix_aes_align.js', 'w') as f:
    f.write(patch)
sftp.close()

stdin, stdout, stderr = client.exec_command('node /tmp/fix_aes_align.js 2>&1')
result = stdout.read().decode(errors='replace')
print("\n=== PATCH ===")
print(result)

if 'DONE' in result:
    # Verify the new function
    stdin, stdout, stderr = client.exec_command(
        'awk "/^function closeRpfBuffer/,/^function [a-zA-Z]/" /var/www/lhc-node/vps_server_v32.js | head -20'
    )
    print("\n=== NEW closeRpfBuffer ===")
    print(stdout.read().decode(errors='replace'))

    # Restart node
    stdin, stdout, stderr = client.exec_command(
        'kill -9 $(lsof -t -i:5000) 2>/dev/null; sleep 1; '
        'kill $(ps aux | grep "node /var/www" | grep -v grep | awk \'{print $2}\') 2>/dev/null; sleep 1; '
        'nohup /usr/bin/node /var/www/lhc-node/vps_server_v32.js > /var/log/lhc-node.log 2>&1 & echo PID:$!'
    )
    print("\n=== RESTART ===")
    print(stdout.read().decode(errors='replace'))

    time.sleep(3)
    stdin, stdout, stderr = client.exec_command('tail -3 /var/log/lhc-node.log')
    print("\n=== LOG ===")
    print(stdout.read().decode(errors='replace'))

client.close()
