import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

# Inspect the WEAPONS_PLAYER.rpf - patch the inject endpoint temporarily to save first AWC
# Instead, use a different approach: dump the RESIDENT.rpf AWC raw hex to understand if
# the tags are NG-encrypted or using a different format

dump = r"""
const fs = require('fs');
const awc = fs.readFileSync('/tmp/first.awc');
console.log('=== RAW HEX (first 200 bytes) ===');
console.log(awc.slice(0, 200).toString('hex'));

// Try different headerSize calculations
const streamCount = awc.readUInt32LE(8);
const headerSize = awc.readUInt32LE(12);
console.log('\n=== HEADER ===');
console.log('streamCount:', streamCount, 'headerSize:', headerSize);

// Check if headerSize is 512-aligned
console.log('headerSize / 512 =', headerSize / 512);
console.log('headerSize / 2048 =', headerSize / 2048);

// Stream ID table
const tagTableStart = 16 + streamCount * 4;
console.log('tagTableStart (calc):', tagTableStart);

// Try 512-byte alignment for headerSize
const sfxInfoOff2 = tagTableStart + streamCount * 16;
const hdr512 = Math.ceil((sfxInfoOff2 + 28) / 512) * 512;
console.log('headerSize with 512 align for', streamCount, 'streams:', hdr512);

// Actual bytes at sfxInfoOff location in real file
// sfxInfoOff = tagTableStart + streamCount * 16 = 440 + 1696 = 2136
// But real headerSize = 2348, so sfxInfo is somewhere before 2348
// Try: sfxInfoOff = headerSize - 28*N or similar
// Actually, maybe each stream has its own SFX info
// sfxInfoOff per stream = tagTableStart + streamCount * 16 + stream_index * 28 ?
// tagTableStart + 106*16 = 440+1696=2136, +0*28=2136
// 2136 + 106*28 = 2136 + 2968 = 5104 — too big

// Let's just look at what's at headerSize offset in the real file
console.log('\n=== BYTES JUST BEFORE headerSize (last 20 of header) ===');
console.log(awc.slice(headerSize - 20, headerSize).toString('hex'));
console.log('\n=== FIRST 16 BYTES OF PCM AREA (at headerSize) ===');
console.log(awc.slice(headerSize, headerSize + 16).toString('hex'));

// Check if bytes look like silence (zeros) or PCM noise
const pcmStart = awc.slice(headerSize, headerSize + 100);
let zeroCount = 0;
for (let i = 0; i < pcmStart.length; i++) if (pcmStart[i] === 0) zeroCount++;
console.log('Zeros in first 100 bytes of PCM area:', zeroCount);

// Real tag at position 440
const p = 440;
console.log('\n=== RAW TAG AT POS 440 (hex) ===');
console.log(awc.slice(p, p+16).toString('hex'));
// Try reading as: [3-byte offset | 1 byte codec] [4 bytes size] for 2 tags
// Or maybe the tag table is just 4 bytes per stream (offset only)
// and tags are stored differently
const raw440 = awc.readUInt32LE(440);
console.log('Word at 440:', raw440.toString(16));
const raw444 = awc.readUInt32LE(444);
console.log('Word at 444:', raw444.toString(16));
const raw448 = awc.readUInt32LE(448);
console.log('Word at 448:', raw448.toString(16));
const raw452 = awc.readUInt32LE(452);
console.log('Word at 452:', raw452.toString(16));
"""

sftp = client.open_sftp()
with sftp.open('/tmp/inspect_awc2.js', 'w') as f:
    f.write(dump)
sftp.close()

stdin, stdout, stderr = client.exec_command('node /tmp/inspect_awc2.js 2>&1')
print(stdout.read().decode(errors='replace'))

client.close()
