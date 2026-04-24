const fs = require('fs');
const { Client } = require('ssh2');

// Read the server.js source file
const serverJsContent = fs.readFileSync('./scripts/vps/server.js', 'utf8');

const packageJsonContent = JSON.stringify({
  name: "lhc-node",
  version: "1.0.0",
  main: "server.js",
  dependencies: {
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "multer": "^1.4.5-lts.1",
    "adm-zip": "^0.5.12"
  }
});

const serviceContent = `
[Unit]
Description=LHC Node.js Backend
After=network.target

[Service]
Environment=NODE_ENV=production
Type=simple
User=root
WorkingDirectory=/var/www/lhc-node
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
`;

// CRITICAL FIX: Use base64 encoding to transfer server.js to the VPS
// This avoids ALL shell escaping issues with template literals ($, backticks, etc.)
const serverJsBase64 = Buffer.from(serverJsContent).toString('base64');
const packageJsonBase64 = Buffer.from(packageJsonContent).toString('base64');
const serviceBase64 = Buffer.from(serviceContent).toString('base64');

const setupScript = `
mkdir -p /var/www/lhc-node
echo "${serverJsBase64}" | base64 -d > /var/www/lhc-node/server.js
echo "${packageJsonBase64}" | base64 -d > /var/www/lhc-node/package.json
echo "${serviceBase64}" | base64 -d > /etc/systemd/system/lhc-node.service

cd /var/www/lhc-node
npm install 2>&1

systemctl daemon-reload
systemctl enable lhc-node
systemctl restart lhc-node

sleep 2
systemctl status lhc-node --no-pager
echo ""
echo "=== VERIFICATION ==="
# Check that template literals are NOT escaped in the deployed file
if grep -c '\\\\\\$' /var/www/lhc-node/server.js > /dev/null 2>&1; then
    echo "WARNING: Escaped dollar signs found!"
    grep -n '\\\\\\$' /var/www/lhc-node/server.js | head -5
else
    echo "OK: No escaped dollar signs. Template literals are correct."
fi
echo "DEPLOY COMPLETE v16"
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected to VPS. Deploying with BASE64 encoding (no escaping issues)...');
    conn.exec(setupScript, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('\nDeployment complete. Code:', code);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data.toString());
        }).stderr.on('data', (data) => {
            process.stderr.write(data.toString());
        });
    });
}).connect({
    host: '187.33.157.103',
    port: 22,
    username: 'root',
    password: 'diScordLhcds032.w'
});
