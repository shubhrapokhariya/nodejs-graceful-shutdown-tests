# nodejs-graceful-shutdown-tests

A Node.js graceful-shutdown test lab that answers one question:

> When a Node.js HTTP server receives SIGTERM while under load, how many requests fail,
> and how long does the process take to exit?

It compares four servers (plain `node:http`, Express, Fastify, Hono) across several
shutdown strategies, and adds side experiments on keep-alive timeouts and on whether SIGTERM even reaches
your app.

The main framework matrix and shutdown-module runs used **Node 22.23.4 and 24.22.3 on Ubuntu under WSL2**, between 23 and 25 November 2026. Selected exploratory experiments also ran on Node 26.13.1. The Docker stop tests used Node 22.23.5 in the `node:22-slim` image. The recorded results are in `results/` (see RESULTS-NOTES.md). Timing results depend on the machine, so run it on yours and compare.

## Scope

This repo measures **HTTP graceful shutdown** in Node.js: what happens to requests when a server receives SIGTERM under steady load, and whether SIGTERM reaches the process at all.

**Tested**

- `node:http`, Express 5.3.0, Fastify 5.12.8 and Hono 4.13.18 (`@hono/node-server` 2.1.8)
- Node.js 22.23.4 and 24.22.3, Ubuntu on WSL2, loopback only
- No-handler, immediate-exit, `server.close()`, pause-then-close and `Connection: close` strategies, with keep-alive and new-connection-per-request clients, at 0, 1000 and 2500 ms of simulated load balancer lag
- `keepAliveTimeout` sweep (1000, 3000, 5000, 8000 ms) and the `keepAliveTimeout: 1000` client-hint case (`experiments/keepalive-hint.mjs`, also run on Node 26.13.1)
- Whether SIGTERM reaches Node through `node`, `sh -c` and `npm start`, and PID 1 behavior in a Linux PID namespace
- A request still running when `server.close()` starts, and a second SIGTERM during shutdown (`experiments/long-request.mjs`, exploratory, one run per case)
- `docker stop` with four launch styles (exec form, `sh -c`, `npm start`, `--init`) on Docker Desktop 29.9.2, image `node:22-slim` (Node 22.23.5)

**Not tested yet**

- Database work during shutdown (in-flight queries, cancellation, a query still running after forced exit)
- Process killed mid-query, `pool.end()` hangs
- Real Kubernetes, a real load balancer, serverless freezing, Windows
- HTTPS, HTTP/2, WebSockets, server-sent events, streaming responses, Next.js
- CPU-bound handlers (the handler only waits on a timer) and long requests that outlast the grace period
- The full framework matrix was run only on Node 22.23.4 and 24.22.3. Node 26.13.1 was used only for the selected experiments listed above. Older Node versions may also differ because they lack `keepAliveTimeoutBuffer`.
- The main framework matrix and full shutdown-module matrix were not run on Node 26.13.1. Selected keep-alive experiments and the exploratory long-request/second-SIGTERM check did run there
- The `onShutdown` hook of the module (closing a database pool or queue)

## Results at a glance

Most matrix figures are means of 2 or 3 runs per case on Node 22.23.4. Exploratory results are identified in the table. Node 24.22.3 request counts were within a few requests of Node 22.23.4. The full data is in `results/`. Print the figures with `node src/article-numbers.mjs 22`.

| Experiment                                                                                               | Finding                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| No handler, or immediate `process.exit(0)`                                                               | About 30 in-flight requests lost on every server (`ECONNRESET`)                                                                                     |
| `server.close()`                                                                                         | 0 in-flight requests lost in every run. New connections are no longer accepted, but requests can still arrive over existing keep-alive connections. |
| Keep-alive client vs new connection per request (plain `server.close()`, 1000 ms lag)                    | 7 new requests failed vs about 200 (Node 22, all four servers)                                                                                      |
| Pause then close, pause longer than lag                                                                  | 0 new requests failed                                                                                                                               |
| Pause then close, pause shorter than lag (1500 vs 2500 ms), new connection per request                   | About 200 failed, equal to the requests sent in the gap                                                                                             |
| `Connection: close` while draining                                                                       | Exit in about 1.5 s (1506 to 1527 ms at 0 and 1000 ms lag) on all four servers, instead of 6 s or more                                              |
| `keepAliveTimeout` 3000 / 5000 / 8000 ms                                                                 | Exit 4159 / 6160 / 9158 ms (request time + timeout + 1000 ms buffer)                                                                                |
| `keepAliveTimeout` 1000 ms                                                                               | Exit in about 150 ms with Node's own client, about 2.1 s with a client that ignores the `Keep-Alive` hint                                           |
| `closeIdleConnections()` after the response (exploratory, one run per mode)                              | Exit about 0.3 s instead of about 6.1 s on Node 22, 24 and 26                                                                                       |
| Fastify defaults, keep-alive client                                                                      | `keepAliveTimeout` is 72000 ms, process still waiting at the 8 s limit (forced exit in 3 of 3 runs on each Node version)                            |
| `fastify.close()` with no pause, keep-alive client, 1000 ms lag                                          | About 200 of 200 new requests failed                                                                                                                |
| `npm start`, `sh -c "node app.js"` on a Linux host                                                       | SIGTERM did not reach Node (dash, npm 10.9.9)                                                                                                       |
| `docker stop -t 10`, exec form `node app.js`                                                             | 0.3 s, exit 0 with a handler. Without a handler 10.3 s and exit 137 (PID 1 ignores SIGTERM)                                                         |
| `docker stop -t 10`, `sh -c "node app.js"`                                                               | 10.3 s and exit 137. The handler never ran                                                                                                          |
| `docker stop -t 10`, `npm start`                                                                         | About 0.8 s with exit 1, but the app's handler never ran (no `GOT SIGTERM` in the log)                                                              |
| `docker stop -t 10`, exec form with `--init`                                                             | 0.2 to 0.3 s. Exit 0 with a handler, 143 without                                                                                                    |
| PID 1 in a PID namespace, no SIGTERM handler                                                             | Process kept running                                                                                                                                |
| Shutdown module, 3 second request still running when `server.close()` starts (500 ms pause), exploratory | Exit about 8.8 s after SIGTERM (rest of the request plus the 6 s keep-alive wait). With a 5 s pause, exit at 5 s. A second SIGTERM is ignored       |
| `graceful-shutdown.mjs` (this repo), Node 22 and 24                                                      | 0 in-flight lost; 0 new failed at 1000 ms lag; exit in about 1.5 s (about 1.65 s at 2500 ms lag, where about 200 requests fail)                     |

## Reading the results

- `results/raw.jsonl`, `results/raw-node24.jsonl` and `results/raw-module.jsonl` hold one JSON line per run.
- `results/summary.md` and `summary.csv` cover the Node 22.23.4 matrix (`node src/report.mjs --env results/environment-node22.json`).
  `summary-node24.md` covers Node 24.22.3.
- `results/summary-module-node22.md` and `summary-module-node24.md` cover the shutdown module runs, one file per Node version.
  Regenerate them with `./report-module.sh`.
- `results/keepalive-hint.txt` is the output of `experiments/keepalive-hint.mjs` and `experiments/close-idle-connections.mjs` on Node 22.23.4, 24.22.3 and 26.13.1, saved with `tee`.
  `close-idle-connections.mjs` is exploratory, one run per mode.
- `results/signals.txt`, `results/pid1-namespace.txt` and `results/docker-stop.txt` hold the signal, PID 1 and `docker stop` output.
- Counts moved by a few requests between runs. Treat small differences as noise.

## Setup

Use Linux (Ubuntu, or WSL2 on Windows) and keep the project inside the Linux filesystem, not under `/mnt/c`. The signal and PID 1 experiments are Linux-specific, and slow file access adds timing noise.

```bash
nvm install 22.23.4 && nvm install 24.22.3   # the versions used in the article (26.13.1 for the extra experiments)
nvm use 22.23.4
npm ci                                        # installs the pinned versions (express 5.3.0, fastify 5.12.8, hono 4.13.18)
node -v
```

## Run

Run experiments one at a time. They share the CPU, and parallel runs distort the timings.

| Command                                                                         | What it does                                                                                            | Time    |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------- |
| `npm run pilot`                                                                 | one scenario, prints the raw JSON                                                                       | ~10 s   |
| `npm run matrix:quick`                                                          | plain Node only, 1 rep                                                                                  | ~1 min  |
| `npm run matrix`                                                                | full matrix, keep-alive client, 3 reps (Node 22)                                                        | ~15 min |
| `./run-followups.sh`                                                            | keep-alive OFF matrix, keepAliveTimeout sweep                                                           | ~5 min  |
| `NODE24=$(nvm which 24.22.3) ./run-node24.sh`                                   | the matrix, the sweep and the keep-alive OFF matrix on Node 24                                          | ~20 min |
| `NODE22=$(nvm which 22.23.4) NODE24=$(nvm which 24.22.3) ./run-module-tests.sh` | the shutdown module (`src/graceful-shutdown.mjs`) on both versions, with and without keep-alive clients | ~5 min  |
| `./report-module.sh`                                                            | one module summary per Node version                                                                     | instant |
| `node src/report.mjs --env results/environment-node22.json`                     | builds `results/summary.md` and `summary.csv` from `raw.jsonl`                                          | instant |
| `npm run keepalive`                                                             | why `keepAliveTimeout: 1000` exits early with Node's own client                                         | ~10 s   |
| `npm run close-idle`                                                            | exploratory, one run per mode                                                                           | ~7 s    |
| `npm run long-request`                                                          | the module with a request still running at `server.close()`, and a second SIGTERM (exploratory)         | ~40 s   |
| `node src/article-numbers.mjs 22`                                               | prints the numbers the article quotes from your raw files (pass 24 for Node 24)                         | instant |
| `npm run signals`                                                               | does SIGTERM reach the app through `sh -c` / `npm start`?                                               | ~30 s   |
| `sudo env "PATH=$PATH" bash experiments/pid1-namespace.sh`                      | PID 1 behaviour via a Linux PID namespace (needs root)                                                  | ~6 s    |
| `bash docker/run-docker-test.sh`                                                | the same signal checks with real `docker stop` (needs Docker, first run downloads the image)            | ~2 min  |

Each matrix run also writes `results/environment-node<major>.json`, so summaries always show the right Node version.
Matrix runs append to their output file and rewrite the environment files in `results/`. To keep your numbers apart from the recorded ones, write to a new file for each run: `npm run matrix -- --out results/mine.jsonl`, then `node src/report.mjs --raw results/mine.jsonl --name summary-mine`.

## How a scenario works

1. Start one server process (`src/server.mjs`) with a framework and a shutdown strategy.
2. Send **200 requests/second, open loop**. Each request takes 150 ms in the handler, so about
   30 are in flight at any moment. Open loop means failures do not slow the client down,
   which keeps counts comparable.
3. After 1 s, send `SIGTERM`.
4. **Load balancer model:** keep sending for `lag` ms after SIGTERM (0 / 1000 / 2500), as if
   the endpoint were still in the balancer's list. Then stop sending and let in-flight
   requests finish.
5. Count every request that did not return HTTP 200, split into:
   - **in-flight lost**: sent before SIGTERM
   - **new failed**: sent after SIGTERM
6. Record how long the process took to exit. Exit code 1 means it hit the 8 s force-exit
   limit (`FORCED`), a stand-in for the orchestrator's SIGKILL after the grace period.

## Strategies (`STRATEGY` env var)

| Strategy            | What it does                                                             |
| ------------------- | ------------------------------------------------------------------------ |
| `none`              | No handler. Node's default: dies immediately.                            |
| `exit`              | Handler calls `process.exit(0)` straight away.                           |
| `drain`             | `server.close()`, exit when it reports closed. The common guide pattern. |
| `drain-delay`       | Report unready, keep serving for 1500 ms, then `server.close()`.         |
| `drain-delay-close` | As above, plus `Connection: close` on responses while draining.          |
| `native`            | Fastify only: `fastify.close()` immediately.                             |
| `native-delay`      | Fastify only: wait 1500 ms, then `fastify.close()`.                      |
| `module`            | The article's `gracefulShutdown()` from `src/graceful-shutdown.mjs`.     |

## Read the results correctly

- **Keep-alive reuse changes the picture.** A client that reuses connections keeps getting
  served on sockets that are already open after `server.close()`, so a shutdown that is too
  eager can look fine. The `no-keepalive` experiment shows the same strategies with a new
  connection per request. Always report both.
- **The delay must be longer than the load balancer's lag.** With 2500 ms of lag and a
  1500 ms delay, about 200 requests still fail. That is the setup behaving as designed.
- **Counts are small integers.** 3 repetitions per cell. The mechanisms are deterministic,
  but expect a few requests of variation. The `[min-max]` shows it.

## Layout

```
src/server.mjs            the server (all frameworks, all strategies)
src/scenario.mjs          runs one scenario, returns counts
src/run-matrix.mjs        runs the matrix, appends to results/raw.jsonl
src/report.mjs            raw.jsonl -> summary.md + summary.csv
report-module.sh          module runs -> one summary per Node version
src/graceful-shutdown.mjs the shutdown module from the article
src/signal-target.mjs     tiny app used by the signal experiments
experiments/              signal-forwarding.mjs, pid1-namespace.sh, keepalive-hint.mjs, close-idle-connections.mjs, long-request.mjs
docker/                   Dockerfile + run-docker-test.sh
results/                  raw data, summaries, environment files, signals.txt, pid1-namespace.txt, docker-stop.txt, logs
```
