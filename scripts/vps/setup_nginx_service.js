const { Client } = require('ssh2');
const conn = new Client();

const nginxConfig = `
server {
    listen 80;
    server_name 187.33.157.103.nip.io;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection keep-alive;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;

const serviceFile = `
[Unit]
Description=LHC CSharp API

[Service]
WorkingDirectory=/var/www/lhc-csharp/CodeWalkerApi
ExecStart=/usr/bin/dotnet /var/www/lhc-csharp/CodeWalkerApi/bin/Debug/net8.0/CodeWalkerApi.dll --urls "http://localhost:5000"
Restart=always
RestartSec=10
KillSignal=SIGINT
SyslogIdentifier=lhc-csharp-api
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=DOTNET_PRINT_TELEMETRY_MESSAGE=false

[Install]
WantedBy=multi-user.target
`;

const commands = [
    `echo '${nginxConfig}' > /etc/nginx/sites-available/lhc-api`,
    "ln -s /etc/nginx/sites-available/lhc-api /etc/nginx/sites-enabled/ || true",
    "rm /etc/nginx/sites-enabled/default || true",
    "nginx -t && systemctl reload nginx",
    `echo '${serviceFile}' > /etc/systemd/system/lhc-api.service`,
    "systemctl daemon-reload",
    "systemctl enable lhc-api.service",
    "systemctl restart lhc-api.service"
];

conn.on('ready', () => {
    console.log('SSH Ready. Configuring Nginx and Systemd...');
    conn.exec(commands.join(' && '), (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
            console.log('Nginx and Service configured with code ' + code);
            conn.end();
        }).on('data', (data) => process.stdout.write(data))
          .stderr.on('data', (data) => process.stderr.write(data));
    });
}).connect({
    host: '187.33.157.103',
    port: 22,
    username: 'root',
    password: 'diScordLhcds032.w'
});
