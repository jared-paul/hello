const http = require('http');

const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'Hello from cereal.box!',
    version: process.env.APP_VERSION || 'unknown',
    timestamp: new Date().toISOString(),
  }));
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
