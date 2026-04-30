const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load RPF tools from v61
// ... (I'll copy the full content of v61 and modify it)

const v61 = fs.readFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v61.js', 'utf8');

let v62 = v61.replace('v61', 'v62');

// Find the part where RPF is saved
const saveMatch = v62.indexOf('fs.writeFileSync(rpfPath, rpfBuffer);');
if (saveMatch !== -1) {
    const insertIndex = saveMatch + 'fs.writeFileSync(rpfPath, rpfBuffer);'.length;
    const patchCode = `
            console.log('Applying ArchiveFix...');
            try {
                // We need to run this in the same directory where ArchiveFix.exe and keys are
                // Or use full paths
                execSync(\`xvfb-run wine /var/www/lhc-node/ArchiveFix.exe fix \${rpfPath}\`, { 
                    cwd: '/var/www/lhc-node',
                    env: { ...process.env, WINEDEBUG: '-all' }
                });
                console.log('ArchiveFix applied successfully.');
            } catch (afErr) {
                console.error('ArchiveFix failed:', afErr.message);
            }
    `;
    v62 = v62.slice(0, insertIndex) + patchCode + v62.slice(insertIndex);
}

// Add the encryption tables and keys loading if missing
// (v61 already has them)

fs.writeFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v62.js', v62);
console.log('vps_server_v62.js created.');
