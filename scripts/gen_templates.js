const fs = require('fs');
const path = require('path');

function createCleanAWC(outputPath, id) {
    const header = Buffer.alloc(0x800, 0);
    
    header.write('TADA', 0);
    header.writeUInt16LE(0x0000, 4);
    header.writeUInt16LE(0x0002, 6); // 2 entries: Metadata + Audio
    
    // Entry 1: Metadata (Type 0x?? - often small)
    // Entry 2: Audio (Type 0x55)
    
    // Let's stick to 1 entry for now but ensure flags and alignment are perfect
    header.writeUInt16LE(0x0001, 6); 
    
    const audioOffset = 0x800;
    const hash = id || 0x4fe8c3d9;
    
    header.writeUInt32LE(audioOffset, 0x10);
    // Use 0x80 flag which is common for weapon audio
    header.writeUInt32LE((0x00001000 | 0x80000000) >>> 0, 0x14); 
    header.writeUInt32LE(hash, 0x18);
    header.writeUInt8(0x55, 0x1C);
    
    // Fill with zero audio data
    const dummyAudio = Buffer.alloc(4096, 0);
    
    fs.writeFileSync(outputPath, Buffer.concat([header, dummyAudio]));
}

const templatesDir = path.join(__dirname, '..', 'scratch', 'clean_templates');
if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir, { recursive: true });

createCleanAWC(path.join(templatesDir, 'pistol.awc'), 0x4fe8c3d9);
createCleanAWC(path.join(templatesDir, 'combatpistol.awc'), 0x55001588);
createCleanAWC(path.join(templatesDir, 'smg.awc'), 0x12345678);
createCleanAWC(path.join(templatesDir, 'microsmg.awc'), 0x87654321);
createCleanAWC(path.join(templatesDir, 'appistol.awc'), 0xabcdef01);
createCleanAWC(path.join(templatesDir, 'killsound.awc'), 0xdeadbeef);
