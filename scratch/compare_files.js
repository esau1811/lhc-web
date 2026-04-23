const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/esau2/.gemini/antigravity/scratch/LHC/arma/';
const files = fs.readdirSync(dir);

const originalFile = 'MK2_911_LHC.rpf';
const convertedFile = files.find(f => f.startsWith('w_pi_vintage_pistol') && f.endsWith('.rpf'));

if (!convertedFile) {
    console.log('Converted file not found in /arma/');
    process.exit(1);
}

console.log('Comparing', originalFile, 'with', convertedFile);

const original = fs.readFileSync(path.join(dir, originalFile));
const converted = fs.readFileSync(path.join(dir, convertedFile));

if (original.length !== converted.length) {
    console.log('Size mismatch!', original.length, 'vs', converted.length);
} else {
    let diffCount = 0;
    let firstDiff = -1;
    for (let i = 0; i < original.length; i++) {
        if (original[i] !== converted[i]) {
            diffCount++;
            if (firstDiff === -1) firstDiff = i;
        }
    }
    console.log('---------------------------');
    console.log('Binary Comparison Results');
    console.log('Total differences:', diffCount);
    if (diffCount > 0) {
        console.log('First difference at byte:', firstDiff);
        console.log('Original hex:', original[firstDiff].toString(16), 'Converted hex:', converted[firstDiff].toString(16));
    } else {
        console.log('FILES ARE IDENTICAL. Conversion failed.');
    }
    console.log('---------------------------');
}
