const fs = require('fs');
const path = require('path');

const OAC_PATH = 'C:/Users/esau2/Desktop/weapons.oac';
const WAVS_DIR = 'C:/Users/esau2/Desktop/weapons';
const OUTPUT_JSON = 'C:/Users/esau2/Desktop/weapons_manifest.json';

const oacContent = fs.readFileSync(OAC_PATH, 'utf8');

const entries = {};
let currentTrackName = null;

const lines = oacContent.split('\n');
for (let line of lines) {
    line = line.trim();
    if (line.startsWith('WaveTrack ')) {
        currentTrackName = line.replace('WaveTrack ', '').trim();
    } else if (line.startsWith('Wave ') && currentTrackName) {
        // e.g. Wave weapons\SHT_PUMP_OPEN.wav
        const relativePath = line.replace('Wave ', '').trim();
        const fileName = path.basename(relativePath); // SHT_PUMP_OPEN.wav
        
        // Read the WAV header to get sample rate and channels
        const wavPath = path.join(WAVS_DIR, fileName);
        if (fs.existsSync(wavPath)) {
            const fd = fs.openSync(wavPath, 'r');
            const header = Buffer.alloc(44);
            fs.readSync(fd, header, 0, 44, 0);
            fs.closeSync(fd);
            
            const channels = header.readUInt16LE(22);
            const sampleRate = header.readUInt32LE(24);
            
            entries[currentTrackName] = {
                fileName: fileName,
                sampleRate: sampleRate,
                channels: channels
            };
        } else {
            console.log('MISSING WAV:', wavPath);
        }
        currentTrackName = null;
    }
}

fs.writeFileSync(OUTPUT_JSON, JSON.stringify(entries, null, 2));
console.log('Manifest generado con', Object.keys(entries).length, 'entradas');
console.log('Guardado en:', OUTPUT_JSON);

// Show a sample
const sampleKey = Object.keys(entries)[0];
console.log('Muestra:', sampleKey, '->', entries[sampleKey]);
