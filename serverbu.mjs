import http from 'http';
import {InteractionState} from './state.js'
import {contextualQuery} from './kbqueries.mjs'

let state = await InteractionState.get('testacct')
await state.clear()

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/query') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      const query = JSON.parse(body).query;
      console.log(query);
      let result = await contextualQuery(query, state, (d) => {
        res.write(d.content)
      })
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
