import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

stdin, stdout, stderr = client.exec_command('cat /var/www/lhc-node/vps_server_v32.js')
current = stdout.read().decode(errors='replace')

# ─── Replace wavToAwc + add helpers ───────────────────────────────────────────
OLD_WAV_TO_AWC = '''function wavToAwc(wavBuffer, streamId) {
    let fmtOffset = 12; while (wavBuffer.toString('utf8', fmtOffset, fmtOffset + 4) !== 'fmt ') fmtOffset += 8 + wavBuffer.readUInt32LE(fmtOffset + 4);
    const channels = wavBuffer.readUInt16LE(fmtOffset + 10);
    const sampleRate = wavBuffer.readUInt32LE(fmtOffset + 12);
    let dataOffset = 12; while (wavBuffer.toString('utf8', dataOffset, dataOffset + 4) !== 'data') dataOffset += 8 + wavBuffer.readUInt32LE(dataOffset + 4);
    const dataSize = wavBuffer.readUInt32LE(dataOffset + 4);
    const audioData = wavBuffer.slice(dataOffset + 8, dataOffset + 8 + dataSize);
    const numSamples = dataSize / (channels * 2);
    const headerSize = 2048;
    const awc = Buffer.alloc(headerSize + audioData.length);
    awc.write('ADAT', 0);
    awc.writeUInt32LE(0xFF000001, 4);
    awc.writeUInt32LE(1, 8);
    awc.writeUInt32LE(headerSize, 12);
    awc.writeUInt32LE(streamId & 0x1FFFFFFF, 16);
    const sfxInfoOff = 64;
    const writeTag = (type, size, offset, writePos) => {
        // FIXED v32: Wrap EVERYTHING in parentheses before >>> 0 to ensure bitwise OR result is unsigned
        awc.writeUInt32LE(((offset & 0x0FFFFFFF) | ((size & 0xF) << 28)) >>> 0, writePos);
        awc.writeUInt32LE((((size >>> 4) & 0x00FFFFFF) | (type << 24)) >>> 0, writePos + 4);
    };
    writeTag(0xFA, 28, sfxInfoOff, 20);
    writeTag(0x55, audioData.length, headerSize, 28);
    awc.writeUInt32LE(numSamples, sfxInfoOff);
    awc.writeInt32LE(-1, sfxInfoOff + 4);
    awc.writeUInt16LE(sampleRate, sfxInfoOff + 8);
    awc.writeUInt8(1, sfxInfoOff + 10);
    audioData.copy(awc, headerSize);
    return awc.slice(0, headerSize + audioData.length);
}'''

NEW_WAV_TO_AWC = '''function wavParsePcm(wavBuffer) {
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
}

function buildAwc(streamIds, audioData, numSamples, sampleRate) {
    const streamCount = streamIds.length;
    // version: 0xFF000001 = single-stream, 0xFF010001 = multi-stream
    const version = streamCount > 1 ? 0xFF010001 : 0xFF000001;
    // Layout: header(16) + streamIdTable(4*N) + tagTable(16*N) + sfxInfo(28) + padding + pcmData
    const tagTableStart = 16 + streamCount * 4;
    const sfxInfoOff = tagTableStart + streamCount * 16; // 2 tags × 8 bytes per stream
    const sfxInfoSize = 28;
    const rawHeaderEnd = sfxInfoOff + sfxInfoSize;
    const headerSize = Math.ceil(rawHeaderEnd / 2048) * 2048; // align to 2048
    const awc = Buffer.alloc(headerSize + audioData.length, 0);

    awc.write('ADAT', 0);
    awc.writeUInt32LE(version, 4);
    awc.writeUInt32LE(streamCount, 8);
    awc.writeUInt32LE(headerSize, 12);

    for (let i = 0; i < streamCount; i++)
        awc.writeUInt32LE(streamIds[i] >>> 0, 16 + i * 4);

    // FIXED: correct AWC tag encoding
    // Word1: bits 0-27 = data offset, bits 28-31 = upper 4 bits of size
    // Word2: bits 0-23 = lower 24 bits of size, bits 24-31 = tag type
    const writeTag = (type, size, offset, pos) => {
        awc.writeUInt32LE(((offset & 0x0FFFFFFF) | (((size >>> 24) & 0xF) << 28)) >>> 0, pos);
        awc.writeUInt32LE(((size & 0x00FFFFFF) | ((type & 0xFF) << 24)) >>> 0, pos + 4);
    };

    // All streams share the same SFX info block and PCM data
    for (let i = 0; i < streamCount; i++) {
        const p = tagTableStart + i * 16;
        writeTag(0xFA, sfxInfoSize, sfxInfoOff, p);
        writeTag(0x55, audioData.length, headerSize, p + 8);
    }

    // SFX info block
    awc.writeUInt32LE(numSamples >>> 0, sfxInfoOff);
    awc.writeInt32LE(-1, sfxInfoOff + 4);       // no loop
    awc.writeUInt16LE(sampleRate, sfxInfoOff + 8);
    awc.writeUInt8(1, sfxInfoOff + 10);         // mono
    awc.writeUInt8(0, sfxInfoOff + 11);

    audioData.copy(awc, headerSize);
    return awc;
}

function wavToAwc(wavBuffer, streamId) {
    const { audioData, numSamples, sampleRate } = wavParsePcm(wavBuffer);
    return buildAwc([streamId & 0x1FFFFFFF], audioData, numSamples, sampleRate);
}'''

# ─── Replace replaceAllAwcInRpf ───────────────────────────────────────────────
OLD_REPLACE = '''function replaceAllAwcInRpf(rpfBuffer, wavBuf) {
    const entryCount = rpfBuffer.readUInt32LE(4);
    const namesLength = rpfBuffer.readUInt32LE(8);
    const nameTableStart = 16 + entryCount * 16;
    let currentPos = Math.ceil(rpfBuffer.length / 512) * 512;
    const output = Buffer.from(rpfBuffer);
    output.writeUInt32LE(ENC_OPEN, 12);
    const newAwcs = [];
    for (let i = 0; i < entryCount; i++) {
        const eOff = 16 + i * 16;
        if (output.readUInt32LE(eOff + 4) === 0x7FFFFF00) continue;
        const nameOff = output.readUInt16LE(eOff);
        let name = \'\'; let p = nameTableStart + nameOff;
        while (p < nameTableStart + namesLength && output[p] !== 0) name += String.fromCharCode(output[p++]);
        if (name.toLowerCase().endsWith(\'.awc\')) {
            const page = output[eOff+5] | (output[eOff+6]<<8) | (output[eOff+7]<<16);
            const size = output.readUInt32LE(eOff + 8);
            if (page > 0 && size >= 20) {
                const originalAwc = output.slice(page * 512, page * 512 + size);
                const streamId = originalAwc.readUInt32LE(0x10) & 0x1FFFFFFF;
                const newAwc = wavToAwc(wavBuf, streamId);
                newAwcs.push({ entryOffset: eOff, name, data: newAwc, pos: currentPos });
                currentPos += Math.ceil(newAwc.length / 512) * 512;
            }
        }
    }
    if (newAwcs.length === 0) return output;
    const finalBuffer = Buffer.alloc(currentPos);
    output.copy(finalBuffer, 0);
    for (const awc of newAwcs) {
        awc.data.copy(finalBuffer, awc.pos);
        const p = awc.pos / 512;
        finalBuffer[awc.entryOffset + 5] = p & 0xFF;
        finalBuffer[awc.entryOffset + 6] = (p >> 8) & 0xFF;
        finalBuffer[awc.entryOffset + 7] = (p >> 16) & 0xFF;
        finalBuffer.writeUInt32LE(awc.data.length, awc.entryOffset + 8);
        console.log(`[v32] Replaced ${awc.name}`);
    }
    return finalBuffer;
}'''

NEW_REPLACE = '''function replaceAllAwcInRpf(rpfBuffer, wavBuf) {
    const entryCount = rpfBuffer.readUInt32LE(4);
    const namesLength = rpfBuffer.readUInt32LE(8);
    const nameTableStart = 16 + entryCount * 16;
    let currentPos = Math.ceil(rpfBuffer.length / 512) * 512;
    const output = Buffer.from(rpfBuffer);
    output.writeUInt32LE(ENC_OPEN, 12);
    const newAwcs = [];

    const { audioData, numSamples, sampleRate } = wavParsePcm(wavBuf);

    for (let i = 0; i < entryCount; i++) {
        const eOff = 16 + i * 16;
        if (output.readUInt32LE(eOff + 4) === 0x7FFFFF00) continue;
        const nameOff = output.readUInt16LE(eOff);
        let name = \'\'; let p = nameTableStart + nameOff;
        while (p < nameTableStart + namesLength && output[p] !== 0) name += String.fromCharCode(output[p++]);
        if (name.toLowerCase().endsWith(\'.awc\')) {
            const page = output[eOff+5] | (output[eOff+6]<<8) | (output[eOff+7]<<16);
            const size = output.readUInt32LE(eOff + 8);
            if (page > 0 && size >= 20) {
                const originalAwc = output.slice(page * 512, page * 512 + size);
                // Read ALL stream IDs from the original AWC so every weapon uses the new sound
                let streamIds = [];
                if (originalAwc.toString(\'ascii\', 0, 4) === \'ADAT\') {
                    const origCount = originalAwc.readUInt32LE(8);
                    for (let s = 0; s < origCount && s < 2000; s++)
                        streamIds.push(originalAwc.readUInt32LE(16 + s * 4) & 0x1FFFFFFF);
                }
                if (streamIds.length === 0)
                    streamIds = [(originalAwc.readUInt32LE(0x10) & 0x1FFFFFFF)];
                const newAwc = buildAwc(streamIds, audioData, numSamples, sampleRate);
                newAwcs.push({ entryOffset: eOff, name, data: newAwc, pos: currentPos, streams: streamIds.length });
                currentPos += Math.ceil(newAwc.length / 512) * 512;
            }
        }
    }
    if (newAwcs.length === 0) return output;
    const finalBuffer = Buffer.alloc(currentPos);
    output.copy(finalBuffer, 0);
    for (const awc of newAwcs) {
        awc.data.copy(finalBuffer, awc.pos);
        const p = awc.pos / 512;
        finalBuffer[awc.entryOffset + 5] = p & 0xFF;
        finalBuffer[awc.entryOffset + 6] = (p >> 8) & 0xFF;
        finalBuffer[awc.entryOffset + 7] = (p >> 16) & 0xFF;
        finalBuffer.writeUInt32LE(awc.data.length, awc.entryOffset + 8);
        console.log(`[v32] Replaced ${awc.name} (${awc.streams} streams)`);
    }
    return finalBuffer;
}'''

errors = []
if OLD_WAV_TO_AWC not in current:
    errors.append('wavToAwc pattern NOT FOUND')
    idx = current.find('function wavToAwc')
    if idx >= 0:
        print('Context around wavToAwc:')
        print(repr(current[idx:idx+200]))
else:
    current = current.replace(OLD_WAV_TO_AWC, NEW_WAV_TO_AWC)
    print('wavToAwc replacement OK')

if OLD_REPLACE not in current:
    errors.append('replaceAllAwcInRpf pattern NOT FOUND')
    idx = current.find('function replaceAllAwcInRpf')
    if idx >= 0:
        print('Context around replaceAllAwcInRpf:')
        print(repr(current[idx:idx+200]))
else:
    current = current.replace(OLD_REPLACE, NEW_REPLACE)
    print('replaceAllAwcInRpf replacement OK')

if errors:
    print('ERRORS:', errors)
    client.close()
    exit(1)

sftp = client.open_sftp()
with sftp.open('/var/www/lhc-node/vps_server_v32.js', 'w') as f:
    f.write(current)
sftp.close()
print('File written OK')

stdin, stdout, stderr = client.exec_command('systemctl restart lhc-node.service && sleep 2 && systemctl is-active lhc-node.service')
print('Service:', stdout.read().decode().strip())

stdin, stdout, stderr = client.exec_command(
    'grep -n "buildAwc\\|wavParsePcm\\|size >>> 24\\|0x00FFFFFF\\|origCount\\|streams" '
    '/var/www/lhc-node/vps_server_v32.js'
)
print('Verify:')
print(stdout.read().decode(errors='replace'))

client.close()
