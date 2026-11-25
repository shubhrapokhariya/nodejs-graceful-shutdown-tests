// Experiment 2: does SIGTERM sent to the process you launched reach your Node app?
// No Docker needed. Wrappers tested: direct, sh -c (single and compound command), npm start.
//
//   node experiments/signal-forwarding.mjs
//
// For each wrapper we start src/signal-target.mjs, send SIGTERM to the wrapper's PID
// (what an init system / orchestrator would do), wait 3s, then check whether the app
// is still alive.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const node = process.execPath;
const target = 'src/signal-target.mjs';

const wrappers = [
  { name: 'node app.js (direct)', cmd: node, args: [target] },
  { name: 'sh -c "node app.js"', cmd: 'sh', args: ['-c', `${node} ${target}`] },
  { name: 'sh -c "node app.js; echo"', cmd: 'sh', args: ['-c', `${node} ${target}; echo wrapper-done`] },
  { name: 'npm start', cmd: 'npm', args: ['start', '--silent'] },
];

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function trial(wrapper, handle) {
  const child = spawn(wrapper.cmd, wrapper.args, {
    cwd: root,
    env: { ...process.env, HANDLE: handle ? '1' : '0' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  let wrapperExit = null;
  child.on('exit', (code, signal) => (wrapperExit = { code, signal }));

  // Wait for READY and parse the app's PID.
  const t0 = Date.now();
  while (!/READY pid=(\d+)/.test(out) && Date.now() - t0 < 8000) await sleep(50);
  const match = out.match(/READY pid=(\d+)/);
  if (!match) {
    child.kill('SIGKILL');
    return { wrapper: wrapper.name, handler: handle, verdict: 'app never started' };
  }
  const appPid = Number(match[1]);
  const sameProcess = appPid === child.pid;

  child.kill('SIGTERM'); // signal the thing we launched, like an orchestrator would
  const t1 = Date.now();
  while (alive(appPid) && Date.now() - t1 < 3000) await sleep(50);
  await sleep(100);

  const appAlive = alive(appPid);
  const gotSigterm = out.includes('GOT SIGTERM');
  if (appAlive) {
    try {
      process.kill(appPid, 'SIGKILL');
    } catch {}
  }
  if (child.exitCode === null) child.kill('SIGKILL');

  let verdict;
  if (appAlive) verdict = 'NOT forwarded: app kept running (orphaned)';
  else if (handle && gotSigterm) verdict = 'forwarded: handler ran';
  else if (!handle) verdict = 'forwarded: default action stopped the app';
  else verdict = 'app stopped, but handler did not run';

  return {
    wrapper: wrapper.name,
    handler: handle,
    shellReplacedByApp: sameProcess,
    verdict,
    wrapperExit: JSON.stringify(wrapperExit),
  };
}

const rows = [];
for (const wrapper of wrappers) {
  for (const handle of [true, false]) {
    rows.push(await trial(wrapper, handle));
  }
}

console.log(`Node ${process.version} on ${process.platform}\n`);
console.table(rows);
