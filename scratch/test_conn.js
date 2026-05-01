const http = require('http');

const options = {
  hostname: '187.33.157.103',
  port: 5000,
  path: '/health',
  method: 'GET',
  timeout: 5000
};

console.log('Probando conexión con el VPS...');
const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (e) => {
  console.error(`ERROR: ${e.message}`);
});

req.on('timeout', () => {
  console.error('TIMEOUT: El servidor no respondió a tiempo');
  req.destroy();
});

req.end();
