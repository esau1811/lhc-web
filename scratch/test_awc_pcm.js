const fs = require('fs');

function wavToAwc(wavBuffer, nameStr) {
    // Basic WAV parsing
    if (wavBuffer.toString('utf8', 0, 4) !== 'RIFF' || wavBuffer.toString('utf8', 8, 12) !== 'WAVE') {
        throw new Error('Not a valid WAV file');
    }
    
    let fmtOffset = 12;
    while (wavBuffer.toString('utf8', fmtOffset, fmtOffset + 4) !== 'fmt ') {
        fmtOffset += 8 + wavBuffer.readUInt32LE(fmtOffset + 4);
    }
    const channels = wavBuffer.readUInt16LE(fmtOffset + 10);
    const sampleRate = wavBuffer.readUInt32LE(fmtOffset + 12);
    
    let dataOffset = 12;
    while (wavBuffer.toString('utf8', dataOffset, dataOffset + 4) !== 'data') {
        dataOffset += 8 + wavBuffer.readUInt32LE(dataOffset + 4);
    }
    const dataSize = wavBuffer.readUInt32LE(dataOffset + 4);
    const audioData = wavBuffer.slice(dataOffset + 8, dataOffset + 8 + dataSize);
    const numSamples = dataSize / (channels * 2);

    // Generate Jenkins Hash for stream id
    function jenkinsHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash += str.charCodeAt(i);
            hash += (hash << 10);
            hash ^= (hash >>> 6);
        }
        hash += (hash << 3);
        hash ^= (hash >>> 11);
        hash += (hash << 15);
        return hash >>> 0;
    }
    const streamId = jenkinsHash(nameStr);

    // Build AWC
    const awc = Buffer.alloc(1024 + audioData.length);
    let o = 0;
    
    // Magic "ADAT" (little endian)
    awc.write('ADAT', o); o += 4;
    // Flags
    awc.writeUInt32LE(0xFF000001, o); o += 4;
    // Entries (1 stream)
    awc.writeUInt32LE(1, o); o += 4;
    // Header size (will calculate later)
    o += 4;
    
    // Stream IDs and tag counts (3 bits count, 29 bits ID)
    const infoHeader = (2 << 29) | (streamId & 0x1FFFFFFF);
    awc.writeUInt32LE(infoHeader, o); o += 4;
    
    // Tags start at offset 0x14
    const tagsOffset = o;
    o += 8 * 2; // 2 tags
    
    // Write Tag 1 (SFX Header: 0xFA)
    const sfxHeaderOffset = o;
    awc.writeUInt32LE(numSamples, o); o += 4;
    awc.writeInt32LE(-1, o); o += 4;
    awc.writeUInt16LE(sampleRate, o); o += 2;
    awc.writeUInt16LE(0, o); o += 2; // headroom?
    awc.writeUInt32LE(0, o); o += 4;
    awc.writeUInt32LE(0, o); o += 4;
    awc.writeUInt8(0x00, o); o += 1; // CODEC: 0x00 (PCM 16-bit LE)
    awc.writeUInt8(0, o); o += 1;
    awc.writeUInt16LE(0, o); o += 2;
    awc.writeUInt32LE(0, o); o += 4;
    
    // Round to 2048 alignment? GTA V often aligns data chunk.
    const dataAlign = Math.ceil(o / 2048) * 2048;
    o = dataAlign;
    
    const audioDataOffset = o;
    audioData.copy(awc, o);
    o += audioData.length;
    
    // Now write tags
    let to = tagsOffset;
    // Tag 1 (0xFA): SFX Header
    let tag1 = Buffer.alloc(8);
    tag1[7] = 0xFA;
    tag1.writeUInt32LE(sfxHeaderOffset, 0); // Offset is 28 bits, but writing 32 is fine since it's < 256MB
    tag1.copy(awc, to); to += 8;
    
    // Tag 2 (0x55): Data
    let tag2 = Buffer.alloc(8);
    tag2[7] = 0x55;
    tag2.writeUInt32LE(audioDataOffset, 0);
    // Size is in upper 28 bits... wait!
    // tag_header >> 28 & 0x0FFFFFFF
    // So tag_size << 28 | tag_offset
    let tag2SizeOff = (audioData.length << 28) | audioDataOffset; // JS bitwise is 32-bit!
    // We need 64-bit writing for tags:
    // tag_type (8) | tag_size (28) | tag_offset (28)
    // tag_offset: bits 0-27
    // tag_size: bits 28-55
    // tag_type: bits 56-63
    
    function writeTag(type, size, offset, buf, writeOff) {
        const lo = offset & 0x0FFFFFFF;
        const mid = size & 0x0FFFFFFF;
        const hi = type & 0xFF;
        
        // 64-bit integer
        const b = Buffer.alloc(8);
        b.writeUInt32LE((lo | ((mid & 0xF) << 28)) >>> 0, 0);
        b.writeUInt32LE(((mid >>> 4) | (hi << 24)) >>> 0, 4);
        b.copy(buf, writeOff);
    }
    
    writeTag(0xFA, 0x18, sfxHeaderOffset, awc, tagsOffset); // size is ~24 bytes
    writeTag(0x55, audioData.length, audioDataOffset, awc, tagsOffset + 8);
    
    awc.writeUInt32LE(sfxHeaderOffset + 0x18, 12); // Header size
    
    return awc.slice(0, o);
}

const wav = fs.readFileSync('test_pcm.wav'); // We need to create a test_pcm.wav
const out = wavToAwc(wav, 'shoot');
fs.writeFileSync('shoot_pcm.awc', out);
console.log('Created shoot_pcm.awc', out.length);
