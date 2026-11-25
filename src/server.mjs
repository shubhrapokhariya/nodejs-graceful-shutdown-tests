// One server, four frameworks, six shutdown strategies. Configured entirely by env vars.
//
//   FRAMEWORK            node | express | fastify | hono
//   STRATEGY             none | exit | drain | drain-delay | drain-delay-close | native | native-delay | module
//   PORT                 listen port (127.0.0.1)
//   WORK_MS              simulated handler time for GET /work           (default 150)
//   SHUTDOWN_DELAY_MS    pause before closing, for the *-delay strategies (default 1500)
//   FORCE_EXIT_MS        hard stop if draining takes too long             (default 8000)
//
// Strategies
//   none               no SIGTERM handler at all (Node's default: the process dies at once)
//   exit               handler calls process.exit(0) immediately
//   drain              server.close(), exit when it reports closed  <- what most guides show
//   drain-delay        mark unready, keep serving for SHUTDOWN_DELAY_MS, then server.close()
//   drain-delay-close  as drain-delay, plus "Connection: close" on every response while draining
//   native             fastify only: fastify.close(). Falls back to "drain" for other frameworks.
//   module             the article's gracefulShutdown() module (src/graceful-shutdown.mjs)
//   native-delay       fastify only: mark unready, wait SHUTDOWN_DELAY_MS, then fastify.close()

import http from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';

const FRAMEWORK = process.env.FRAMEWORK ?? 'node';
const STRATEGY = process.env.STRATEGY ?? 'none';
const PORT = Number(process.env.PORT ?? 3000);
const HOST = '127.0.0.1';
const WORK_MS = Number(process.env.WORK_MS ?? 150);
const SHUTDOWN_DELAY_MS = Number(process.env.SHUTDOWN_DELAY_MS ?? 1500);
const FORCE_EXIT_MS = Number(process.env.FORCE_EXIT_MS ?? 8000);

const started = Date.now();
const log = (msg) => console.error(`[server +${Date.now() - started}ms] ${msg}`);

let draining = false;
const healthStatus = () => (draining ? 503 : 200);
const healthText = () => (draining ? 'draining' : 'ok');
const work = async () => {
  await sleep(WORK_MS);
  return { ok: true, pid: process.pid };
};

async function createServer() {
  switch (FRAMEWORK) {
    case 'node': {
      const server = http.createServer(async (req, res) => {
        if (req.url === '/health') {
          res.statusCode = healthStatus();
          return res.end(healthText());
        }
        if (req.url === '/work') {
          const body = await work();
          res.setHeader('content-type', 'application/json');
          return res.end(JSON.stringify(body));
        }
        res.statusCode = 404;
        res.end();
      });
      await new Promise((resolve) => server.listen(PORT, HOST, resolve));
      return { server };
    }
    case 'express': {
      const { default: express } = await import('express');
      const app = express();
      app.get('/health', (req, res) => res.status(healthStatus()).send(healthText()));
      app.get('/work', async (req, res) => res.json(await work()));
      const server = await new Promise((resolve) => {
        const s = app.listen(PORT, HOST, () => resolve(s));
      });
      return { server };
    }
    case 'fastify': {
      const { default: Fastify } = await import('fastify');
      const app = Fastify();
      app.get('/health', async (req, reply) => reply.code(healthStatus()).send(healthText()));
      app.get('/work', async () => work());
      await app.listen({ port: PORT, host: HOST });
      return { server: app.server, nativeClose: () => app.close() };
    }
    case 'hono': {
      const { Hono } = await import('hono');
      const { serve } = await import('@hono/node-server');
      const app = new Hono();
      app.get('/health', (c) => c.text(healthText(), healthStatus()));
      app.get('/work', async (c) => c.json(await work()));
      const server = await new Promise((resolve) => {
        const s = serve({ fetch: app.fetch, port: PORT, hostname: HOST }, () => resolve(s));
      });
      return { server };
    }
    default:
      throw new Error(`unknown FRAMEWORK: ${FRAMEWORK}`);
  }
}

const { server, nativeClose } = await createServer();

// Optional override, used to show how shutdown time depends on the keep-alive timeout.
if (process.env.KEEP_ALIVE_MS) server.keepAliveTimeout = Number(process.env.KEEP_ALIVE_MS);

if (STRATEGY === 'drain-delay-close') {
  // Runs before the framework sees the request, so it works for all four.
  server.prependListener('request', (req, res) => {
    if (draining) res.setHeader('Connection', 'close');
  });
}

const closeServer = () =>
  new Promise((resolve) => {
    server.close(() => resolve());
  });

async function drainAndExit() {
  const force = setTimeout(() => {
    log('FORCE EXIT: drain did not finish in time');
    process.exit(1);
  }, FORCE_EXIT_MS);
  force.unref();

  if ((STRATEGY === 'native' || STRATEGY === 'native-delay') && nativeClose) {
    await nativeClose();
  } else {
    await closeServer();
  }
  log('closed, exiting 0');
  process.exit(0);
}

if (STRATEGY === 'module') {
  // The copy-paste module from the article: src/graceful-shutdown.mjs
  const { gracefulShutdown } = await import('./graceful-shutdown.mjs');
  gracefulShutdown(server, { delayMs: SHUTDOWN_DELAY_MS, forceExitMs: FORCE_EXIT_MS });
} else if (STRATEGY !== 'none') {
  process.on('SIGTERM', async () => {
    log(`SIGTERM received (strategy=${STRATEGY})`);
    draining = true;
    if (STRATEGY === 'exit') process.exit(0);
    if (['drain-delay', 'drain-delay-close', 'native-delay'].includes(STRATEGY)) {
      await sleep(SHUTDOWN_DELAY_MS);
      log('delay over, closing');
    }
    await drainAndExit();
  });
}

log(
  `listening on ${HOST}:${PORT} framework=${FRAMEWORK} strategy=${STRATEGY} node=${process.version} ` +
    `keepAliveTimeout=${server.keepAliveTimeout} keepAliveTimeoutBuffer=${server.keepAliveTimeoutBuffer}`,
);
