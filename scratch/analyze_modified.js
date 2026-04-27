const fs = require('fs');

function analyzeRPF(filePath) {
    const data = fs.readFileSync(filePath);
    
    // Find all 7FPR headers to locate nested RPFs
    const headerMagic = Buffer.from([0x37, 0x46, 0x50, 0x52]); // 7FPR
    let searchPos = 0;
    
    while ((searchPos = data.indexOf(headerMagic, searchPos)) !== -1) {
        console.log(`\n=== RPF at 0x${searchPos.toString(16)} ===`);
        
        const entryCount = data.readUInt32LE(searchPos + 4);
        const namesLength = data.readUInt32LE(searchPos + 8);
        console.log(`EntryCount: ${entryCount}, NamesLength: ${namesLength}`);
        
        const entriesOffset = searchPos + 16;
        const nameTableOffset = entriesOffset + (entryCount * 16);
        
        // Read Name Table
        try {
            const nameTable = data.slice(nameTableOffset, nameTableOffset + namesLength);
            
            // Read Entries
            for (let i = 0; i < entryCount; i++) {
                const entryPos = entriesOffset + (i * 16);
                const nameOffsetInfo = data.readUInt32LE(entryPos);
                const nameOffset = nameOffsetInfo & 0xFFFF; // usually lower 16 bits
                const nameIdx = data.readUInt16LE(entryPos + 2); // Wait, nameOffset is 2 bytes?
                
                // Let's just find the name string in the name table starting at nameOffset
                let nameStr = '';
                for (let j = nameOffset; j < nameTable.length; j++) {
                    if (nameTable[j] === 0) break;
                    nameStr += String.fromCharCode(nameTable[j]);
                }
                
                const d1 = data.readUInt32LE(entryPos + 4);
                const d2 = data.readUInt32LE(entryPos + 8);
                const d3 = data.readUInt32LE(entryPos + 12);
                
                const isDir = d1 === 0x7FFFFFFF;
                const isResource = !isDir && ((d1 & 0x80000000) !== 0);
                const fileOffset = (d1 & 0x7FFFFFFF) * 8; // standard block multiplier?
                // wait, if isResource is false, d1 is file offset (if < 0x80000000). But offset in RPF7 is typically block aligned?
                // actually d1 & 0x7FFFFFFF is the offset, but wait, usually file offset is just d1 * 512 or something?
                // Let's just print d1 and d2.
                console.log(`  Entry ${i}: NameOffset=${nameOffset} -> "${nameStr}", d1=${d1.toString(16)}, d2=${d2.toString(16)}, d3=${d3.toString(16)}, isResource=${isResource}`);
            }
        } catch (e) {
            console.log("Error parsing TOC:", e.message);
        }
        
        searchPos += 4;
    }
}

analyzeRPF('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\arma\\MODIFIED.rpf');
