
import {InteractionState} from './state.js'
import {contextualQuery} from './kbqueries.mjs'

let state = await InteractionState.get('testacct')
await state.clear()

     //res.setHeader('Content-Type', 'application/json');
      //res.end(JSON.stringify({ response: 'KB PLACEHOLDER RESPONSE' }));
    });
  } else {
    res.statusCode = 404;
    res.end();
  }
});
server.listen(3000, () => {
  console.log('Server running on port 3000');
});

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
      let result = await contextualQuery(query, state, (d) => {
        sendEvent({ response: d.content });
      })
 
    });
  } else {
    res.statusCode = 404;
    res.end();
  }
});
server.listen(3000, () => {
  console.log('Server running on port 3000');
}); 
