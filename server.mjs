import http from 'http';
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/query') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      const query = JSON.parse(body).query;
      console.log(query);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ response: 'KB PLACEHOLDER RESPONSE' }));
    });
  } else {
    res.statusCode = 404;
    res.end();
  }
});
server.listen(3000, () => {
  console.log('Server running on port 3000');
});