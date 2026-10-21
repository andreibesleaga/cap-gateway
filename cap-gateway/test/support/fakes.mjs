// Local HTTP servers that stand in for a misbehaving translation engine
import { createServer } from 'node:http';

const listen = async server => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  server.url = `http://127.0.0.1:${server.address().port}`;
  server.requests = 0;
  return server;
};

// accepts every request and never answers (until closed)
export const startSilentServer = () => {
  const open = new Set();
  const server = createServer((req, res) => {
    server.requests += 1;
    open.add(res);
  });
  server.closeAll = () => {
    open.forEach(res => res.destroy());
    server.close();
  };
  return listen(server);
};

// an OpenAI-compatible endpoint whose completions are not the JSON the contract requires
export const startInvalidLlmServer = () => {
  const server = createServer((req, res) => {
    server.requests += 1;
    req.resume();
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({ model: 'fake', choices: [{ message: { content: 'Sure! Here is the translation: Warning' } }] })
      );
    });
  });
  server.closeAll = () => server.close();
  return listen(server);
};
