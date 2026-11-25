// Runs ONE scenario: start a server, send open-loop load, SIGTERM it, count what failed.
//
// Load model (open loop): requests are issued at a fixed rate whether or not earlier
// ones succeeded, like a real load balancer. A closed-loop client would speed up when
// the server starts refusing connections and inflate the failure count.
//
// Load balancer model: after SIGTERM the client keeps sending for `lagMs`, as if the
// endpoint had not been removed yet (Kubernetes endpoint propagation, ALB deregistration).
// After `lagMs` it stops sending new requests and waits for in-flight ones to finish.

import { spawn } from 'node:child_process';
import http from 'node:http';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'server.mjs');

function classify(err) {
  const code = err?.code ?? '';
  if (code === 'ECONNREFUSED') return 'econnrefused';
  if (code === 'ECONNRESET' || code === 'EPIPE' || /socket hang up|aborted/i.test(err?.message ?? '')) return 'econnreset';
  if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') return 'timeout';
  return `other:${code || err?.message || 'unknown'}`;
}

async function waitReady(port, timeoutMs = 8000) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    const ok = await new Promise((resolve) => {
      const req = http.get({ host: '127.0.0.1', port, path: '/health', agent: false, timeout: 500 }, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
    if (ok) return true;
    await sleep(50);
  }
  return false;
}

export async function runScenario({
  framework,
  strategy,
  lagMs,
  port,
  keepAlive = true,
  rps = 200,
  warmupMs = 1000,
  workMs = 150,
  delayMs = 1500,
  forceMs = 8000,
  clientTimeoutMs = 5000,
  keepAliveMs = null,
}) {
  const child = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      FRAMEWORK: framework,
      STRATEGY: strategy,
      PORT: String(port),
      WORK_MS: String(workMs),
      SHUTDOWN_DELAY_MS: String(delayMs),
      FORCE_EXIT_MS: String(forceMs),
      ...(keepAliveMs ? { KEEP_ALIVE_MS: String(keepAliveMs) } : {}),
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let serverLog = '';
  child.stderr.on('data', (d) => (serverLog += d));

  let exited = null;
  child.on('exit', (code, signal) => {
    exited = { code, signal, at: performance.now() };
  });

  if (!(await waitReady(port))) {
    child.kill('SIGKILL');
    throw new Error(`server did not become ready: ${framework}/${strategy}\n${serverLog}`);
  }

  const agent = new http.Agent({ keepAlive, maxSockets: Infinity });
  const records = [];
  const pending = [];
  let connectionCloseHeaders = 0;
  let sigAt = null;
  let stopAt = null;

  function fire() {
    const rec = { issuedAt: performance.now(), afterSig: sigAt !== null, outcome: null };
    records.push(rec);
    pending.push(
      new Promise((resolve) => {
        const done = (outcome) => {
          if (rec.outcome === null) rec.outcome = outcome;
          resolve();
        };
        const req = http.get(
          { host: '127.0.0.1', port, path: '/work', agent, timeout: clientTimeoutMs },
          (res) => {
            if (String(res.headers.connection).toLowerCase() === 'close') connectionCloseHeaders++;
            res.resume();
            res.on('end', () => done(res.statusCode === 200 ? 'ok' : `http${res.statusCode}`));
            res.on('error', (e) => done(classify(e)));
            res.on('close', () => {
              if (!res.complete) done('econnreset');
            });
          },
        );
        req.on('timeout', () => {
          done('timeout');
          req.destroy();
        });
        req.on('error', (e) => done(classify(e)));
      }),
    );
  }

  const interval = 1000 / rps;
  const loadStart = performance.now();
  let next = loadStart;
  for (;;) {
    const now = performance.now();
    if (sigAt === null && now - loadStart >= warmupMs) {
      sigAt = now;
      stopAt = now + lagMs;
      child.kill('SIGTERM');
    }
    if (stopAt !== null && now >= stopAt) break;
    while (next <= now) {
      fire();
      next += interval;
    }
    await sleep(1);
  }

  await Promise.all(pending);

  // Wait for the server process to finish (or give up and record that it hung).
  const waitDeadline = performance.now() + forceMs + 4000;
  while (exited === null && performance.now() < waitDeadline) await sleep(25);
  const hung = exited === null;
  if (hung) child.kill('SIGKILL');
  agent.destroy();

  const tally = (list) => {
    const out = {};
    for (const r of list) out[r.outcome] = (out[r.outcome] ?? 0) + 1;
    return out;
  };
  const before = records.filter((r) => !r.afterSig);
  const after = records.filter((r) => r.afterSig);
  const failed = (list) => list.filter((r) => r.outcome !== 'ok').length;

  return {
    framework,
    strategy,
    lagMs,
    keepAlive,
    rps,
    workMs,
    delayMs,
    sentBeforeSigterm: before.length,
    sentAfterSigterm: after.length,
    failedInFlight: failed(before), // issued before SIGTERM, did not get a 200
    failedNew: failed(after), // issued after SIGTERM, did not get a 200
    failedTotal: failed(records),
    outcomesBefore: tally(before),
    outcomesAfter: tally(after),
    connectionCloseHeaders,
    serverExit: hung
      ? { hung: true }
      : { code: exited.code, signal: exited.signal, afterSigtermMs: Math.round(exited.at - sigAt) },
    keepAliveMs,
    serverLogHead: serverLog.trim().split('\n')[0],
    serverLogTail: serverLog.trim().split('\n').slice(-4),
  };
}
