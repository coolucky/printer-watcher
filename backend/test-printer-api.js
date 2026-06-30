const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/printers/scrape/printer/10.128.20.6/toner',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Headers:', res.headers);
    console.log('Response Body:', data);
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.end();