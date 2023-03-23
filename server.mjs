import express from 'express';
import http from 'http';
import InteractionState from './state.js';
import { contextualQuery } from './kbqueries.mjs';

let state = await InteractionState.get('testacct');
await state.clear();

const app = express();
const server = http.createServer(app);

// Serve static files from the 'static/' directory
app.use(express.static('static'));

// Handle POST requests to '/query'
app.post('/query', async (req, res) => {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
  });
  req.on('end', async () => {
    const query = JSON.parse(body).query;
    console.log(query);
    let result = await contextualQuery(query, 'testacct', state, (d) => {
      res.write(d.content);
    });
  });
});

server.listen(3600, () => {
  console.log('Server running on port 3600');
});

