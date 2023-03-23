import http from 'http';
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/query') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    let id = 0;
    const sendEvent = (data) => {
      res.write(`id: ${id}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      id++;
    };
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      const query = JSON.parse(body).query;
      console.log(query);
      sendEvent({ response: 'KB PLACEHOLDER RESPONSE' });
      res.end();
    });
  } else {
    res.statusCode = 404;
    res.end();
  }
});
server.listen(3000, () => {
  console.log('Server running on port 3000');
}); 