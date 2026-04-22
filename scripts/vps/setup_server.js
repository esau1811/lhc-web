const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(`
    apt-get update && apt-get install -y docker.io unzip zip
    echo "SERVER READY: Docker Installed"
  `, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).on('error', (err) => {
    console.error('ERROR:', err.message);
}).connect({
  host: '187.33.157.103',
  port: 22,
  username: 'root',
  password: 'diScordLhcds032.w'
});
