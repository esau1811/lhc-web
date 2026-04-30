const fs = require('fs');

const v62 = fs.readFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v62.js', 'utf8');

let v63 = v62.replace(/\[v62\]/g, '[v63]');

// Update ArchiveFix call to capture output
const oldAF = 'execSync(`xvfb-run wine /var/www/lhc-node/ArchiveFix.exe fix "${rpfPath}"`, { \n                cwd: \'/var/www/lhc-node\',\n                env: { ...process.env, WINEDEBUG: \'-all\' },\n                timeout: 30000 \n            });';

const newAF = `
            const out = execSync(\`xvfb-run wine /var/www/lhc-node/ArchiveFix.exe fix "\${rpfPath}"\`, { 
                cwd: '/var/www/lhc-node',
                env: { ...process.env, WINEDEBUG: '-all' },
                timeout: 30000 
            });
            console.log('[v63] ArchiveFix Output: ' + out.toString());
            
            // Verify if file changed
            const stats = fs.statSync(rpfPath);
            console.log('[v63] RPF Size after fix: ' + stats.size);
`;

v63 = v63.replace(oldAF, newAF);

fs.writeFileSync('C:\\Users\\esau2\\.gemini\\antigravity\\scratch\\LHC\\scratch\\vps_server_v63.js', v63);
console.log('vps_server_v63.js generated.');
