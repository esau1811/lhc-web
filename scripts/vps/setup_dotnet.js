const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  "sudo apt-get update",
  "sudo apt-get install -y dotnet-sdk-8.0",
  "mkdir -p /var/www/lhc-csharp",
  "cd /var/www/lhc-csharp && dotnet new webapi -n CodeWalkerApi || true"
];

conn.on('ready', () => {
  console.log('SSH Ready. Installing .NET 8.0 SDK and scaffolding C# API...');
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
