const fs = require('fs');
const { Client } = require('ssh2');

const serverJsPaths = [
    './scripts/vps/server.js'
];
const serverJsContent = fs.readFileSync(serverJsPaths[0], 'utf8');

const packageJsonContent = JSON.stringify({
  name: "lhc-node",
  version: "1.0.0",
  main: "server.js",
  dependencies: {
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "multer": "^1.4.5-lts.1"
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

const setupScript = `
mkdir -p /var/www/lhc-node
cat << 'EOF' > /var/www/lhc-node/server.js
${serverJsContent.replace(/\$/g, '\\$')}
EOF

cat << 'EOF' > /var/www/lhc-node/package.json
${packageJsonContent}
EOF

cd /var/www/lhc-node
npm install

cat << 'EOF' > /etc/systemd/system/lhc-node.service
${serviceContent}
EOF

systemctl daemon-reload
systemctl enable lhc-node
systemctl restart lhc-node
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected to VPS.');
    conn.exec(setupScript, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('Deployment complete. Code:', code);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect({
    host: '187.33.157.103',
    port: 22,
    username: 'root',
    password: 'diScordLhcds032.w'
});
