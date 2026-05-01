const https = require('https');

const options = {
  hostname: '187.33.157.103.nip.io',
  port: 443,
  path: '/health',
  method: 'GET',
  timeout: 5000
};

console.log('Probando conexión segura con el dominio nip.io...');
const req = https.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (e) => {
  console.error(`ERROR: ${e.message}`);
});

req.end();
