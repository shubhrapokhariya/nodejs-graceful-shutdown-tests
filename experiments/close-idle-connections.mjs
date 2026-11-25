// Exploratory, single run per mode (not part of the published results).
// server.close() closes connections that are idle at the moment it is called.
// A socket that was busy then becomes idle later and lingers until keepAliveTimeout + buffer.
// Does calling server.closeIdleConnections() again, after the response, remove that tail?
// The client is a raw TCP socket that ignores Keep-Alive hints.
// Run: node experiments/close-idle-connections.mjs
import http from 'node:http';
import net from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

async function run(mode) {
  const server = http.createServer(async (req, res) => {
    await sleep(150);
    res.end('ok');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const socket = net.connect(port, '127.0.0.1');
  socket.on('error', () => {});
  socket.on('data', () => {});
  socket.write('GET / HTTP/1.1\r\nHost: x\r\n\r\n');
  await sleep(50); // request in flight
  const t0 = Date.now();
  const closed = new Promise((resolve) => {
    const giveUp = setTimeout(() => resolve('>7000'), 7000);
    server.close(() => {
      clearTimeout(giveUp);
      resolve(Date.now() - t0);
    });
  });
  if (mode === 'close, then closeIdleConnections after the response') {
    await sleep(300);
    server.closeIdleConnections();
  }
  const ms = await closed;
  socket.destroy();
  server.closeAllConnections();
  console.log(`${mode.padEnd(52)} exit ${ms} ms`);
}

await run('close only');
await run('close, then closeIdleConnections after the response');
