// graceful-shutdown.mjs
import { setTimeout as sleep } from 'node:timers/promises';

export function gracefulShutdown(
  server,
  {
    delayMs = 5000, // keep serving while the load balancer catches up. Must be longer than its lag.
    forceExitMs = 25000, // hard stop. Keep it below your platform's grace period.
    onShutdown = async () => {}, // close database pools, flush queues, and so on
  } = {},
) {
  let draining = false;

  // Tell clients to drop their sockets while draining, so none are left idle.
  server.prependListener('request', (req, res) => {
    if (draining) res.setHeader('Connection', 'close');
  });

  async function shutdown(signal) {
    if (draining) return;
    draining = true;
    console.error(`${signal} received, draining`);

    // Left referenced on purpose, so a cleanup that never finishes still ends with exit code 1.
    const force = setTimeout(() => {
      console.error('shutdown took too long, forcing exit');
      process.exit(1);
    }, forceExitMs);

    let code = 0;
    try {
      await sleep(delayMs); // 1. keep serving while the balancer catches up (/health reports 503 via isDraining)
      await new Promise((resolve) => server.close(resolve)); // 2. stop listening, finish in-flight requests
      await onShutdown(); // 3. now it is safe to close the database pool
    } catch (err) {
      console.error('error during shutdown', err);
      code = 1;
    }
    clearTimeout(force);
    process.exit(code);
  }

  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => shutdown(signal));

  return { isDraining: () => draining };
}
