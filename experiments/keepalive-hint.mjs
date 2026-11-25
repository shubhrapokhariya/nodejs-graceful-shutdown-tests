// Why does keepAliveTimeout = 1000 make a plain Node server exit in ~150 ms
// instead of the ~2150 ms the formula predicts?
//
// The server advertises `Keep-Alive: timeout=1`. Node's HTTP agent subtracts
// `agentKeepAliveTimeoutBuffer` (default 1000 ms, added in v22.20.0 and v24.7.0)
// from that hint, which leaves no time, so the agent drops the socket right after
// the response. Three clients make the cause visible:
//   node-agent          the default agent
//   node-agent buffer 0 the same agent with agentKeepAliveTimeoutBuffer set to 0
//   raw-socket          a client that ignores the hint completely
//
// A request is in flight when server.close() is called, like the busy sockets in the lab.
// Run: node experiments/keepalive-hint.mjs
import http from 'node:http';
import net from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

async function run(keepAliveTimeout, client) {
  const server = http.createServer(async (req, res) => {
    await sleep(150);
    res.end('ok');
  });
  server.keepAliveTimeout = keepAliveTimeout;
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  let agent;
  let socket;
  if (client === 'raw-socket') {
    socket = net.connect(port, '127.0.0.1');
    socket.on('error', () => {});
    socket.on('data', () => {});
    socket.write('GET / HTTP/1.1\r\nHost: x\r\n\r\n');
  } else {
    agent = new http.Agent({
      keepAlive: true,
      ...(client === 'node-agent buffer 0' ? { agentKeepAliveTimeoutBuffer: 0 } : {}),
    });
    http.get({ host: '127.0.0.1', port, agent }, (res) => res.resume());
  }

  await sleep(50); // the request is now in flight
  const t0 = Date.now();
  const closedAfter = await new Promise((resolve) => {
    const giveUp = setTimeout(() => resolve('>9000'), 9000);
    server.close(() => {
      clearTimeout(giveUp);
      resolve(Date.now() - t0);
    });
  });
  agent?.destroy();
  socket?.destroy();
  server.closeAllConnections();
  return closedAfter;
}

console.log(`node ${process.version}`);
console.log('keepAliveTimeout  client                 exit after server.close()   formula (100 ms left + timeout + 1000 buffer)');
for (const kat of [1000, 3000]) {
  for (const client of ['node-agent', 'node-agent buffer 0', 'raw-socket']) {
    const ms = await run(kat, client);
    console.log(`${String(kat).padEnd(17)} ${client.padEnd(21)} ${String(ms).padStart(6)} ms                  ~${100 + kat + 1000} ms`);
  }
}
