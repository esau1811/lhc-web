// GTA5 uses Jenkins One-at-a-Time hash (joaat) to select the NG key per file
// keyIndex = joaat(lowercase_filename) % 101
// Let's verify this theory

function joaat(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash += str.charCodeAt(i);
        hash += hash << 10;
        hash ^= hash >>> 6;
    }
    hash += hash << 3;
    hash ^= hash >>> 11;
    hash += hash << 15;
    return hash >>> 0; // unsigned 32-bit
}

const files = [
    { name: 'lmg_combat.awc', page: 2, us: 55496 },
    { name: 'ptl_pistol.awc', page: 1874, us: 64352 },
    { name: 'smg_micro.awc', page: 3226, us: 193048 },
    { name: 'ptl_combat.awc', page: 1763, us: 56744 },
    { name: 'sht_pump.awc', page: 2776, us: 230244 },
];

for (const f of files) {
    const hash = joaat(f.name.toLowerCase());
    const keyIdx = hash % 101;
    console.log(`${f.name}: joaat=0x${hash.toString(16)} keyIdx=${keyIdx}`);
}

// Also try without extension
for (const f of files) {
    const nameNoExt = f.name.replace('.awc', '');
    const hash = joaat(nameNoExt.toLowerCase());
    const keyIdx = hash % 101;
    console.log(`${nameNoExt} (no ext): joaat=0x${hash.toString(16)} keyIdx=${keyIdx}`);
}
