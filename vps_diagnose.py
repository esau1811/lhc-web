import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

# 1. Service logs
stdin, stdout, stderr = client.exec_command('journalctl -u lhc-node.service -n 60 --no-pager 2>&1')
print("=== SERVICE LOGS ===")
print(stdout.read().decode(errors='replace'))

# 2. Key functions present
stdin, stdout, stderr = client.exec_command(
    'grep -n "function wavParsePcm.\\|function buildAwc.\\|function wavToAwc.\\|function replaceAllAwcInRpf.\\|origCount\\|0xFF010001\\|size >>> 24" '
    '/var/www/lhc-node/vps_server_v32.js'
)
print("=== KEY LINES ===")
print(stdout.read().decode(errors='replace'))

# 3. Dump buildAwc body (lines around it)
stdin, stdout, stderr = client.exec_command(
    'awk "/function buildAwc/,/^function [a-z]/" /var/www/lhc-node/vps_server_v32.js | head -80'
)
print("=== buildAwc BODY ===")
print(stdout.read().decode(errors='replace'))

# 4. Dump replaceAllAwcInRpf body
stdin, stdout, stderr = client.exec_command(
    'awk "/function replaceAllAwcInRpf/,/^app\\./" /var/www/lhc-node/vps_server_v32.js | head -80'
)
print("=== replaceAllAwcInRpf BODY ===")
print(stdout.read().decode(errors='replace'))

# 5. Generate a test AWC with known data and dump its hex
test_script = r"""
const wavParsePcm = (wavBuffer) => {
    let fmtOffset = 12;
    while (wavBuffer.toString('utf8', fmtOffset, fmtOffset + 4) !== 'fmt ')
        fmtOffset += 8 + wavBuffer.readUInt32LE(fmtOffset + 4);
    const channels = wavBuffer.readUInt16LE(fmtOffset + 10);
    const sampleRate = wavBuffer.readUInt32LE(fmtOffset + 12);
    let dataOffset = 12;
    while (wavBuffer.toString('utf8', dataOffset, dataOffset + 4) !== 'data')
        dataOffset += 8 + wavBuffer.readUInt32LE(dataOffset + 4);
    const dataSize = wavBuffer.readUInt32LE(dataOffset + 4);
    const audioData = wavBuffer.slice(dataOffset + 8, dataOffset + 8 + dataSize);
    const numSamples = Math.floor(dataSize / (channels * 2));
    return { audioData, numSamples, sampleRate, channels };
};

const buildAwc = (streamIds, audioData, numSamples, sampleRate) => {
    const streamCount = streamIds.length;
    const version = streamCount > 1 ? 0xFF010001 : 0xFF000001;
    const tagTableStart = 16 + streamCount * 4;
    const sfxInfoOff = tagTableStart + streamCount * 16;
    const sfxInfoSize = 28;
    const headerSize = Math.ceil((sfxInfoOff + sfxInfoSize) / 2048) * 2048;
    const awc = Buffer.alloc(headerSize + audioData.length, 0);
    awc.write('ADAT', 0);
    awc.writeUInt32LE(version >>> 0, 4);
    awc.writeUInt32LE(streamCount, 8);
    awc.writeUInt32LE(headerSize, 12);
    for (let i = 0; i < streamCount; i++)
        awc.writeUInt32LE(streamIds[i] >>> 0, 16 + i * 4);
    const writeTag = (type, size, offset, pos) => {
        awc.writeUInt32LE(((offset & 0x0FFFFFFF) | (((size >>> 24) & 0xF) << 28)) >>> 0, pos);
        awc.writeUInt32LE(((size & 0x00FFFFFF) | ((type & 0xFF) << 24)) >>> 0, pos + 4);
    };
    for (let i = 0; i < streamCount; i++) {
        const p = tagTableStart + i * 16;
        writeTag(0xFA, sfxInfoSize, sfxInfoOff, p);
        writeTag(0x55, audioData.length, headerSize, p + 8);
    }
    awc.writeUInt32LE(numSamples >>> 0, sfxInfoOff);
    awc.writeInt32LE(-1, sfxInfoOff + 4);
    awc.writeUInt16LE(sampleRate, sfxInfoOff + 8);
    awc.writeUInt8(1, sfxInfoOff + 10);
    audioData.copy(awc, headerSize);
    return awc;
};

// Fake 32-sample mono 32000Hz PCM WAV
const pcmSamples = 32;
const wavBuf = Buffer.alloc(44 + pcmSamples * 2, 0);
wavBuf.write('RIFF', 0);
wavBuf.writeUInt32LE(36 + pcmSamples * 2, 4);
wavBuf.write('WAVE', 8);
wavBuf.write('fmt ', 12);
wavBuf.writeUInt32LE(16, 16);
wavBuf.writeUInt16LE(1, 20);   // PCM
wavBuf.writeUInt16LE(1, 22);   // mono
wavBuf.writeUInt32LE(32000, 24); // 32000 Hz
wavBuf.writeUInt32LE(64000, 28);
wavBuf.writeUInt16LE(2, 32);
wavBuf.writeUInt16LE(16, 34);
wavBuf.write('data', 36);
wavBuf.writeUInt32LE(pcmSamples * 2, 40);

const { audioData, numSamples, sampleRate } = wavParsePcm(wavBuf);
// Test single-stream
const awc1 = buildAwc([0x12345678], audioData, numSamples, sampleRate);
console.log('Single-stream AWC hex (first 64 bytes):');
console.log(awc1.slice(0, 64).toString('hex'));
console.log('headerSize:', awc1.readUInt32LE(12), 'streamCount:', awc1.readUInt32LE(8));
console.log('Stream ID:', awc1.readUInt32LE(16).toString(16));
// tag table starts at 16+4=20
const tagTableStart = 20;
const w1 = awc1.readUInt32LE(tagTableStart);
const w2 = awc1.readUInt32LE(tagTableStart + 4);
const tagType = (w2 >>> 24) & 0xFF;
const tagSize = ((w1 >>> 28) << 24) | (w2 & 0x00FFFFFF);
const tagOffset = w1 & 0x0FFFFFFF;
console.log('Tag0 type:', tagType.toString(16), 'size:', tagSize, 'offset:', tagOffset);
const w3 = awc1.readUInt32LE(tagTableStart + 8);
const w4 = awc1.readUInt32LE(tagTableStart + 12);
const tag1Type = (w4 >>> 24) & 0xFF;
const tag1Size = ((w3 >>> 28) << 24) | (w4 & 0x00FFFFFF);
const tag1Offset = w3 & 0x0FFFFFFF;
console.log('Tag1 type:', tag1Type.toString(16), 'size:', tag1Size, 'offset:', tag1Offset);
// SFX info
const sfxInfoOff = tagTableStart + 16;
console.log('SFX numSamples:', awc1.readUInt32LE(sfxInfoOff), 'sampleRate:', awc1.readUInt16LE(sfxInfoOff + 8), 'channels:', awc1[sfxInfoOff + 10]);
"""
sftp = client.open_sftp()
with sftp.open('/tmp/test_awc.js', 'w') as f:
    f.write(test_script)
sftp.close()

stdin, stdout, stderr = client.exec_command('node /tmp/test_awc.js 2>&1')
print("=== TEST AWC GENERATION ===")
print(stdout.read().decode(errors='replace'))

client.close()
