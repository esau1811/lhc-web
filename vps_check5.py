import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

# 1. Inspect the real AWC from RESIDENT.rpf
inspect = r"""
const fs = require('fs');
const awc = fs.readFileSync('/tmp/first.awc');
console.log('Size:', awc.length);
console.log('Magic:', awc.slice(0,4).toString('ascii'));
const version = awc.readUInt32LE(4);
const streamCount = awc.readUInt32LE(8);
const headerSize = awc.readUInt32LE(12);
console.log('Version:', version.toString(16), '| streamCount:', streamCount, '| headerSize:', headerSize);

// Stream IDs
for (let i = 0; i < Math.min(streamCount, 10); i++) {
    const sid = awc.readUInt32LE(16 + i * 4);
    console.log(`Stream[${i}] ID: 0x${sid.toString(16)} (raw) | 0x${(sid & 0x1FFFFFFF).toString(16)} (masked)`);
}

// Tag table starts at 16 + streamCount*4
const tagTableStart = 16 + streamCount * 4;
console.log('tagTableStart:', tagTableStart);
for (let i = 0; i < Math.min(streamCount, 5); i++) {
    const p = tagTableStart + i * 16;
    // Two tags per stream (8 bytes each)
    const w1 = awc.readUInt32LE(p);
    const w2 = awc.readUInt32LE(p + 4);
    const w3 = awc.readUInt32LE(p + 8);
    const w4 = awc.readUInt32LE(p + 12);
    const t0type = (w2 >>> 24) & 0xFF;
    const t0size = ((w1 >>> 28) << 24) | (w2 & 0x00FFFFFF);
    const t0off  = w1 & 0x0FFFFFFF;
    const t1type = (w4 >>> 24) & 0xFF;
    const t1size = ((w3 >>> 28) << 24) | (w4 & 0x00FFFFFF);
    const t1off  = w3 & 0x0FFFFFFF;
    console.log(`Stream[${i}] Tag0: type=0x${t0type.toString(16)} size=${t0size} off=${t0off} | Tag1: type=0x${t1type.toString(16)} size=${t1size} off=${t1off}`);
}

// SFX info at offset pointed by first tag
const sfxOff = awc.readUInt32LE(tagTableStart) & 0x0FFFFFFF;
console.log('SFX numSamples:', awc.readUInt32LE(sfxOff));
console.log('SFX loop:', awc.readInt32LE(sfxOff + 4));
console.log('SFX sampleRate:', awc.readUInt16LE(sfxOff + 8));
console.log('SFX channels:', awc[sfxOff + 10]);
"""
sftp = client.open_sftp()
with sftp.open('/tmp/inspect_awc.js', 'w') as f:
    f.write(inspect)
sftp.close()

stdin, stdout, stderr = client.exec_command('node /tmp/inspect_awc.js 2>&1')
print("=== REAL AWC STRUCTURE ===")
print(stdout.read().decode(errors='replace'))

# 2. Get openRpfBuffer full body
stdin, stdout, stderr = client.exec_command(
    'awk "/function openRpfBuffer/,/^function [a-z]/" /var/www/lhc-node/vps_server_v32.js'
)
print("=== openRpfBuffer FULL ===")
print(stdout.read().decode(errors='replace'))

# 3. Remove duplicate functions (first copy is the one to keep — the new one at lines 140-199)
# Lines 200-262 are the duplicate
stdin, stdout, stderr = client.exec_command(
    'awk "NR>=200 && NR<=262 {next} {print}" /var/www/lhc-node/vps_server_v32.js | wc -l'
)
print("=== Lines after removing duplicates ===", stdout.read().decode().strip())

client.close()
