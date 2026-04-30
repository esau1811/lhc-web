import paramiko, sys, time
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

patch = r"""
const fs = require('fs');
let src = fs.readFileSync('/var/www/lhc-node/vps_server_v32.js', 'utf8');

// ── STEP 1: Replace replaceAllAwcInRpf with in-place version ────────────────
const oldFnMarker = 'let currentPos = Math.ceil(rpfBuffer.length / 512) * 512;';
if (!src.includes(oldFnMarker)) {
    console.log('ERROR: old replaceAllAwcInRpf marker not found');
    process.exit(1);
}

// Find the start of the function
const fnStart = src.lastIndexOf('function replaceAllAwcInRpf(', src.indexOf(oldFnMarker));
// Find the matching closing brace
let depth = 0, i = fnStart;
while (i < src.length) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
    i++;
}
const oldFn = src.slice(fnStart, i);

const newFn = `function replaceAllAwcInRpf(openBuf, wavBuf) {
    // In-place: writes new PCM into original sector positions, keeps entry table unchanged.
    // Caller must restore the original encrypted header after this call.
    const entryCount = openBuf.readUInt32LE(4);
    const namesLength = openBuf.readUInt32LE(8);
    const nameTableStart = 16 + entryCount * 16;
    const output = Buffer.from(openBuf);
    const { audioData, sampleRate } = wavParsePcm(openBuf.slice ? wavBuf : openBuf);
    // wavBuf is the second argument
    const parsed = wavParsePcm(wavBuf);
    const audioPcm = parsed.audioData;
    const audioSR  = parsed.sampleRate;
    let replaced = 0;

    for (let i = 0; i < entryCount; i++) {
        const eOff = 16 + i * 16;
        if (output.readUInt32LE(eOff + 4) === 0x7FFFFF00) continue;
        const nameOff = output.readUInt16LE(eOff);
        const page = output[eOff+5] | (output[eOff+6]<<8) | (output[eOff+7]<<16);
        const size = output.readUInt32LE(eOff + 8);
        let name = '', p = nameTableStart + nameOff;
        while (p < nameTableStart + namesLength && output[p] !== 0) name += String.fromCharCode(output[p++]);
        if (!name.toLowerCase().endsWith('.awc') || page === 0 || size < 20) continue;

        const awcStart = page * 512;
        if (awcStart + size > output.length) continue;
        if (output.slice(awcStart, awcStart + 4).toString('ascii') !== 'ADAT') continue;

        const streamCount = output.readUInt32LE(awcStart + 8);
        const awcHeaderSize = output.readUInt32LE(awcStart + 12);
        const pcmSize = size - awcHeaderSize;
        if (pcmSize <= 0 || awcHeaderSize >= size) continue;

        // Find sfxInfo tag (type 0xFA) in the AWC tag table
        let sfxInfoOff = -1;
        const tagBase = awcStart + 16 + streamCount * 4;
        for (let t = 0; t < streamCount * 4; t++) {
            const tp = tagBase + t * 8;
            if (tp + 8 > awcStart + awcHeaderSize) break;
            const w1 = output.readUInt32LE(tp), w2 = output.readUInt32LE(tp + 4);
            if (((w2 >>> 24) & 0xFF) === 0xFA) { sfxInfoOff = awcStart + (w1 & 0x0FFFFFFF); break; }
        }

        // Fit new audio into original PCM slot (truncate if too long, pad with silence if too short)
        let newPcm;
        if (audioPcm.length >= pcmSize) {
            newPcm = audioPcm.slice(0, pcmSize);
        } else {
            newPcm = Buffer.alloc(pcmSize, 0);
            audioPcm.copy(newPcm);
        }
        newPcm.copy(output, awcStart + awcHeaderSize);

        // Update sfxInfo: numSamples = actual audio samples played, sampleRate
        if (sfxInfoOff >= awcStart && sfxInfoOff + 10 < awcStart + awcHeaderSize) {
            const playedSamples = Math.floor(Math.min(audioPcm.length, pcmSize) / 2);
            output.writeUInt32LE(playedSamples >>> 0, sfxInfoOff);
            output.writeUInt16LE(audioSR >>> 0, sfxInfoOff + 8);
        }

        console.log('[v32] Replaced ' + name + ' in-place (streams=' + streamCount + ' slot=' + pcmSize + ' audio=' + audioPcm.length + ')');
        replaced++;
    }
    if (replaced === 0) console.log('[v32] WARN: no AWC files replaced in-place');
    return output;
}`;

src = src.slice(0, fnStart) + newFn + src.slice(i);
console.log('STEP1 OK: replaceAllAwcInRpf replaced');

// ── STEP 2: Update inject endpoint ──────────────────────────────────────────
// Find the inject endpoint's encType line and surrounding block
const oldBlock = `        const encType = rpfBuffer.readUInt32LE(12);
        if (encType === ENC_AES || encType === ENC_NG) rpfBuffer = openRpfBuffer(rpfBuffer, encType, rpfName);
        console.log('[v32-DBG] rpfName='+rpfName+' encType=0x'+encType.toString(16)+' entries='+rpfBuffer.readUInt32LE(4)+' namesLen='+rpfBuffer.readUInt32LE(8)+' headerLen='+(rpfBuffer.readUInt32LE(4)*16+rpfBuffer.readUInt32LE(8))+' headerLen%16='+(rpfBuffer.readUInt32LE(4)*16+rpfBuffer.readUInt32LE(8))%16);
        const modifiedRpf = replaceAllAwcInRpf(rpfBuffer, wavBuf);
        const zip = new AdmZip();
        const finalRpf = closeRpfBuffer(modifiedRpf);
            zip.addFile(\`x64/audio/sfx/\${rpfName}\`, finalRpf);
        require('fs').writeFileSync('/tmp/last_output.rpf', finalRpf);
        console.log('[v32-DBG] Saved /tmp/last_output.rpf size='+finalRpf.length+' encType=0x'+finalRpf.readUInt32LE(12).toString(16)+' entries='+finalRpf.readUInt32LE(4)+' namesLen='+finalRpf.readUInt32LE(8));`;

const newBlock = `        const encType = rpfBuffer.readUInt32LE(12);
        const hdrEntries = rpfBuffer.readUInt32LE(4);
        const hdrNamesLen = rpfBuffer.readUInt32LE(8);
        const hdrLen = hdrEntries * 16 + hdrNamesLen;
        const originalEncRpf = Buffer.from(rpfBuffer); // preserve original encrypted header
        console.log('[v32-DBG] rpfName='+rpfName+' encType=0x'+encType.toString(16)+' entries='+hdrEntries+' namesLen='+hdrNamesLen+' headerLen='+hdrLen);
        if (encType === ENC_AES || encType === ENC_NG) rpfBuffer = openRpfBuffer(rpfBuffer, encType, rpfName);
        // Replace AWC audio in-place at original sector positions (same size, same structure)
        const modifiedRpf = replaceAllAwcInRpf(rpfBuffer, wavBuf);
        // Restore original encrypted header so GTA/FiveM sees the original encryption type
        if (encType === ENC_AES || encType === ENC_NG) originalEncRpf.copy(modifiedRpf, 0, 0, 16 + hdrLen);
        const zip = new AdmZip();
        zip.addFile(\`x64/audio/sfx/\${rpfName}\`, modifiedRpf);
        require('fs').writeFileSync('/tmp/last_output.rpf', modifiedRpf);
        console.log('[v32-DBG] finalRpf size='+modifiedRpf.length+' encType=0x'+modifiedRpf.readUInt32LE(12).toString(16));`;

if (!src.includes(oldBlock)) {
    console.log('ERROR: inject endpoint block not found');
    const idx = src.indexOf('const encType = rpfBuffer.readUInt32LE(12)');
    console.log('Inject context:', JSON.stringify(src.slice(Math.max(0,idx-20), idx+600)));
    process.exit(1);
}
src = src.replace(oldBlock, newBlock);
console.log('STEP2 OK: inject endpoint updated');

fs.writeFileSync('/var/www/lhc-node/vps_server_v32.js', src, 'utf8');
console.log('SAVED');
console.log('DONE');
"""

sftp = client.open_sftp()
with sftp.open('/tmp/patch_inplace.js', 'w') as f:
    f.write(patch)
sftp.close()

stdin, stdout, stderr = client.exec_command('node /tmp/patch_inplace.js 2>&1')
result = stdout.read().decode(errors='replace')
print('=== PATCH ===')
print(result)

if 'DONE' in result:
    stdin, stdout, stderr = client.exec_command(
        'grep -n "in-place\\|originalEncRpf\\|headerLen0\\|hdrLen\\|closeRpfBuffer" '
        '/var/www/lhc-node/vps_server_v32.js | head -20'
    )
    print('\n=== VERIFY ===')
    print(stdout.read().decode(errors='replace'))

    stdin, stdout, stderr = client.exec_command(
        'kill -9 $(lsof -t -i:5000) 2>/dev/null; sleep 1; '
        'kill $(ps aux | grep "node /var/www" | grep -v grep | awk \'{print $2}\') 2>/dev/null; sleep 1; '
        'nohup /usr/bin/node /var/www/lhc-node/vps_server_v32.js > /var/log/lhc-node.log 2>&1 & echo PID:$!'
    )
    print('\n=== RESTART ===')
    print(stdout.read().decode(errors='replace'))

    time.sleep(3)
    stdin, stdout, stderr = client.exec_command('tail -5 /var/log/lhc-node.log')
    print('\n=== LOG ===')
    print(stdout.read().decode(errors='replace'))
else:
    print('\n=== STDERR ===')
    print(stderr.read().decode(errors='replace'))

client.close()
