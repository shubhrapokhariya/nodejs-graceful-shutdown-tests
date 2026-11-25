// Prints the numbers the article quotes, computed from your raw result files,
// so you can compare them with the article line by line.
// Usage: node src/article-numbers.mjs [nodeMajor]    (default 22)
import fs from 'node:fs';

const major = process.argv[2] ?? '22';
const files = ['results/raw.jsonl', 'results/raw-node24.jsonl', 'results/raw-module.jsonl'].filter((f) => fs.existsSync(f));
const rows = files
  .flatMap((f) => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)))
  .filter((r) => (r.serverLogHead.match(/node=v(\d+)/) || [])[1] === major);

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const fmt = (n) => (Number.isNaN(n) ? 'n/a' : Number.isInteger(n) ? String(n) : n.toFixed(1));
const pick = (f) => rows.filter(f);
const exitMs = (r) => r.serverExit?.afterSigtermMs;
const FW = ['node', 'express', 'fastify', 'hono'];
const row = (label, f, field) => console.log(`  ${label.padEnd(34)}` + FW.map((fw) => fmt(mean(pick((r) => r.framework === fw && f(r)).map(field)))).join('   '));

console.log(`Node ${major}.x   columns = ${FW.join('  ')}   (means)\n`);
console.log('Mistake 1  in-flight lost');
for (const s of ['none', 'exit', 'drain']) row(s, (r) => r.strategy === s && r.keepAlive && r.lagMs === 1000 && !r.keepAliveMs && r.label.startsWith('matrix'), (r) => r.failedInFlight);

console.log('\nMistake 2  new requests failed, plain server.close(), 1000 ms lag');
row('pooled client', (r) => r.strategy === 'drain' && r.keepAlive && r.lagMs === 1000 && !r.keepAliveMs && r.label.startsWith('matrix'), (r) => r.failedNew);
row('new connection per request', (r) => r.strategy === 'drain' && !r.keepAlive && r.lagMs === 1000 && !r.keepAliveMs, (r) => r.failedNew);

console.log('\nMistake 3  new requests failed, new connection per request');
for (const s of ['drain', 'drain-delay', 'drain-delay-close']) for (const lag of [1000, 2500]) row(`${s} lag ${lag}`, (r) => r.strategy === s && !r.keepAlive && r.lagMs === lag, (r) => r.failedNew);
console.log('  Fastify, pooled client, 1000 ms lag');
for (const s of ['native', 'native-delay']) console.log(`    ${s.padEnd(14)} ${fmt(mean(pick((r) => r.framework === 'fastify' && r.strategy === s && r.keepAlive && r.lagMs === 1000).map((r) => r.failedNew)))} failed`);

console.log('\nMistake 4  exit time after SIGTERM (ms), plain node:http, no further traffic');
for (const ka of [1000, 3000, 5000, 8000]) {
  const sel = pick((r) => r.framework === 'node' && r.strategy === 'drain' && r.lagMs === 0 && r.keepAliveMs === ka).map(exitMs);
  console.log(`  keepAliveTimeout ${String(ka).padEnd(5)} ${fmt(mean(sel))}   (n=${sel.length})`);
}
console.log('  plain drain, pooled client, lag 0 (default timeouts)');
for (const fw of FW) {
  const sel = pick((r) => r.framework === fw && r.strategy === 'drain' && r.keepAlive && r.lagMs === 0 && !r.keepAliveMs && r.label.startsWith('matrix'));
  console.log(`    ${fw.padEnd(8)} exit ${sel.map(exitMs).join(', ')}   forced(code 1): ${sel.filter((r) => r.serverExit?.code === 1).length}/${sel.length}`);
}
const dc = pick((r) => r.strategy === 'drain-delay-close' && r.lagMs <= 1000).map(exitMs);
console.log(`  drain-delay-close exit at 0 and 1000 ms lag: ${Math.min(...dc)} to ${Math.max(...dc)} ms (n=${dc.length})`);

console.log('\nShutdown module (src/graceful-shutdown.mjs)');
const mod = pick((r) => r.strategy === 'module');
if (!mod.length) console.log('  no module runs found, run ./run-module-tests.sh first');
for (const lag of [0, 1000, 2500]) {
  const sel = mod.filter((r) => r.lagMs === lag);
  if (sel.length) console.log(`  lag ${String(lag).padEnd(5)} in-flight lost ${sel.reduce((a, r) => a + r.failedInFlight, 0)}   new failed mean ${fmt(mean(sel.map((r) => r.failedNew)))}   exit ${Math.min(...sel.map(exitMs))} to ${Math.max(...sel.map(exitMs))} ms   (n=${sel.length})`);
}
