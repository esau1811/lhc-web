const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  "sudo killall unattended-upgrades || true",
  "sudo dpkg --configure -a",
  "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
  "apt-get install -y nodejs nginx certbot python3-certbot-nginx",
  "mkdir -p /var/www/lhc-api",
  "cd /var/www/lhc-api && npm init -y && npm install express multer cors"
];

conn.on('ready', () => {
  console.log('SSH Ready. Executing installation after unlocking dpkg...');
  conn.exec(commands.join(' && '), (err, stream) => {
    if (err) throw err;
    stream.on('close', (code) => {
      console.log('Finished with code ' + code);
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
