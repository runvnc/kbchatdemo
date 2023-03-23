import express from 'express';
import http from 'http';
import InteractionState from './state.js';
import { contextualQuery } from './kbqueries.mjs';

let state;

const app = express();
const server = http.createServer(app);

// Serve static files from the 'static/' directory
app.use(express.static('static'));

// Handle POST requests to '/query'
app.get('/query', express.json(), async (req, res) => {
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

  const query = req.body.query;
  console.log(query);
  if (!query) {
    res.end({response:'.'})
    return
  }
  let result = await contextualQuery(query, 'testacct', state, (d) => {
    sendEvent({ response: d.content });
  });
});

state = await InteractionState.get('testacct');
await state.clear();


server.listen(3600, async () => {
  console.log('Server running on port 3600');
});

