const fs = require('fs');

const v61 = fs.readFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v61.js', 'utf8');

// 1. Change version strings
let v62 = v61.replace(/\[v61\]/g, '[v62]');

// 2. Ensure ngDecrypt is properly defined and called
// It seems it was defined at line 62.

// 3. Add ArchiveFix integration
const saveCode = 'const openRpf = buildOpenRpf(rpf.buffer, pcmData, rpf.originalname);';
const patchCode = `
        const rpfPath = path.join(os.tmpdir(), \`rpf_\${tmpId}.rpf\`);
        fs.writeFileSync(rpfPath, openRpf);
        
        console.log('[v62] Applying ArchiveFix to ' + rpf.originalname);
        try {
            // ArchiveFix.exe needs to be in the CWD or we use full path.
            // It also needs the .dat keys in the same folder.
            const { execSync } = require('child_process');
            execSync(\`xvfb-run wine /var/www/lhc-node/ArchiveFix.exe fix "\${rpfPath}"\`, { 
                cwd: '/var/www/lhc-node',
                env: { ...process.env, WINEDEBUG: '-all' },
                timeout: 30000 
            });
            console.log('[v62] ArchiveFix applied successfully.');
        } catch (afErr) {
            console.error('[v62] ArchiveFix failed:', afErr.message);
            // We still proceed with the openRpf as fallback, though it might crash FiveM
        }
        
        const finalRpf = fs.readFileSync(rpfPath);
        fs.unlinkSync(rpfPath);
`;

v62 = v62.replace('const finalRpf = openRpf;', patchCode);

// 4. Fix potential typo in ngDecrypt
// Line 79 in v61: if (d.readUInt16LE(0) === 0 && d.readUInt32LE(4) === 0x7FFFFF00) return ngDecrypt(enc, GTA5_NG_KEYS[i]);
// It looks fine.

fs.writeFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v62.js', v62);
console.log('vps_server_v62.js generated.');
