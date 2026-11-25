// What happens to src/graceful-shutdown.mjs when a request is still running at the moment server.close() is called?
//
// The module sets `Connection: close` only on requests that ARRIVE after SIGTERM. A request that started earlier
// and is still busy when server.close() runs keeps a keep-alive socket, and that socket sits idle after the
// response until keepAliveTimeout + keepAliveTimeoutBuffer (5000 + 1000 ms) pass.
//
// Run: node experiments/long-request.mjs      (one run per case, exploratory)
import { spawn } from "node:child_process";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

if (process.argv[2] === "server") {
  const { gracefulShutdown } = await import("../src/graceful-shutdown.mjs");
  const server = http.createServer(async (req, res) => {
    await sleep(Number(process.env.WORK_MS));
    res.end("ok");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  gracefulShutdown(server, {
    delayMs: Number(process.env.DELAY_MS),
    forceExitMs: 25000,
  });
  console.log(`PORT ${server.address().port}`);
} else {
  async function scenario({ work, delay, killAt, twice }) {
    const child = spawn(
      process.execPath,
      [fileURLToPath(import.meta.url), "server"],
      {
        env: { ...process.env, WORK_MS: String(work), DELAY_MS: String(delay) },
      },
    );
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    while (!/PORT \d+/.test(out)) await sleep(20);
    const port = Number(out.match(/PORT (\d+)/)[1]);
    const agent = new http.Agent({ keepAlive: true });
    const t0 = Date.now();
    let responseAt = null;
    http.get({ host: "127.0.0.1", port, agent }, (res) => {
      res.resume();
      res.on("end", () => (responseAt = Date.now() - t0));
    });
    await sleep(killAt);
    const tKill = Date.now();
    child.kill("SIGTERM");
    if (twice) {
      await sleep(300);
      child.kill("SIGTERM");
    }
    const code = await new Promise((resolve) =>
      child.on("exit", (c, s) => resolve(c ?? s)),
    );
    agent.destroy();
    const drainingLines = (out.match(/draining/g) || []).length;
    return {
      responseAtMs: responseAt,
      exitAfterSigtermMs: Date.now() - tKill,
      exitCode: code,
      drainingLines,
    };
  }
  const line = (label, r) =>
    console.log(
      `${label.padEnd(46)} response at ${String(r.responseAtMs).padStart(5)} ms   exit ${String(r.exitAfterSigtermMs).padStart(5)} ms after SIGTERM   code ${r.exitCode}   "draining" logged ${r.drainingLines}x`,
    );
  console.log(`node ${process.version}`);
  line(
    "150 ms request, 500 ms pause",
    await scenario({ work: 150, delay: 500, killAt: 50 }),
  );
  line(
    "3000 ms request, 500 ms pause (still busy at close)",
    await scenario({ work: 3000, delay: 500, killAt: 200 }),
  );
  line(
    "3000 ms request, 5000 ms pause (done before close)",
    await scenario({ work: 3000, delay: 5000, killAt: 200 }),
  );
  line(
    "second SIGTERM 300 ms after the first",
    await scenario({ work: 150, delay: 1500, killAt: 50, twice: true }),
  );
}
