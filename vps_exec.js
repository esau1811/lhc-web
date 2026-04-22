const { Client } = require('ssh2');

const command = process.argv.slice(2).join(' ');

if (!command) {
  console.error("Please provide a command to run.");
  process.exit(1);
}

const conn = new Client();
conn.on('ready', () => {
  conn.exec(command, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
      process.exit(code);
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
