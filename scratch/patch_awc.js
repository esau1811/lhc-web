function patchAWC(awcData, adpcmData) {
    const magic = awcData.toString('utf8', 0, 4);
    if (!magic.includes('AWC')) {
        throw new Error('Not a valid AWC file. Magic: ' + magic);
    }
    
    const streamCount = awcData.readUInt32LE(0x08);
    const dataOffset = awcData.readUInt32LE(0x0C);
    
    // Parse Stream Infos
    let chunkCountTotal = 0;
    const streamInfos = [];
    for (let i = 0; i < streamCount; i++) {
        const info = awcData.readUInt32LE(0x10 + i * 4);
        const hash = info & 0x1FFFFFFF;
        const chunks = (info >>> 29) & 0x7;
        streamInfos.push({ hash, chunks });
        chunkCountTotal += chunks;
    }
    
    // Flags check
    const flags = awcData.readUInt16LE(0x06);
    let chunksOffset = 0x10 + streamCount * 4;
    if ((flags & 1) !== 0) { // ChunkIndicesFlag
        chunksOffset += chunkCountTotal * 2;
    }
    
    // Parse Chunk Infos
    const chunks = [];
    for (let i = 0; i < chunkCountTotal; i++) {
        const off = chunksOffset + i * 8;
        const chunkVal = awcData.readBigUInt64LE(off);
        const chunkOffset = Number(chunkVal & 0xFFFFFFFn);
        const chunkSize = Number((chunkVal >> 28n) & 0xFFFFFFFn);
        const chunkType = Number((chunkVal >> 56n) & 0xFFn);
        chunks.push({ index: i, infoOffset: off, chunkOffset, chunkSize, chunkType });
    }
    
    // Find the primary audio data chunk (0x55). 
    // We'll pick the largest 0x55 chunk to be safe, or just the first one.
    // Usually the main gunshot is the largest or first data chunk.
    let targetChunk = null;
    let maxSz = -1;
    for (const c of chunks) {
        if (c.chunkType === 0x55) {
            if (c.chunkSize > maxSz) {
                maxSz = c.chunkSize;
                targetChunk = c;
            }
        }
    }
    
    if (!targetChunk) throw new Error('No audio data chunk (0x55) found in AWC.');
    
    console.log(`[AWC] Target chunk offset: ${targetChunk.chunkOffset}, size: ${targetChunk.chunkSize}`);
    
    // We will resize the chunk to fit the new ADPCM data perfectly.
    const newSize = adpcmData.length;
    const sizeDiff = newSize - targetChunk.chunkSize;
    
    // 1. Update the target chunk's size in its info block
    // chunkVal = (type << 56) | (size << 28) | offset
    const newChunkVal = (BigInt(targetChunk.chunkType) << 56n) | (BigInt(newSize) << 28n) | BigInt(targetChunk.chunkOffset);
    awcData.writeBigUInt64LE(newChunkVal, targetChunk.infoOffset);
    
    // 2. Update offsets for all chunks that come physical AFTER this chunk
    for (const c of chunks) {
        if (c.chunkOffset > targetChunk.chunkOffset) {
            c.chunkOffset += sizeDiff;
            const updatedVal = (BigInt(c.chunkType) << 56n) | (BigInt(c.chunkSize) << 28n) | BigInt(c.chunkOffset);
            awcData.writeBigUInt64LE(updatedVal, c.infoOffset);
        }
    }
    
    // 3. Rebuild the file
    const preData = awcData.slice(0, targetChunk.chunkOffset);
    const postData = awcData.slice(targetChunk.chunkOffset + targetChunk.chunkSize);
    
    return Buffer.concat([preData, adpcmData, postData]);
}

module.exports = patchAWC;
