# Notes on the recorded results

Tested on Ubuntu under WSL2, loopback only. Node 22.23.4, 24.22.3 and 26.13.1 were installed with nvm. The Node version and timestamp for each matrix run are recorded in `results/environment-node22.json` and `results/environment-node24.json`.

| File                                                                         | What it holds                                                                                                                                                 |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| results/raw.jsonl, summary.md, summary.csv                                   | Node 22.23.4: main matrix (198 runs), keep-alive OFF client (84 runs) and keepAliveTimeout sweep (8 runs)                                                     |
| results/raw-node24.jsonl, summary-node24.md, summary-node24.csv              | Node 24.22.3: main matrix (198 runs), keepAliveTimeout sweep (8 runs) and keep-alive OFF client (84 runs)                                                     |
| results/raw-module.jsonl, summary-module-node22.md, summary-module-node24.md | The copy-paste module (src/graceful-shutdown.mjs) on Node 22.23.4 and 24.22.3, with and without keep-alive clients (40 runs per version)                      |
| results/keepalive-hint.txt                                                   | experiments/keepalive-hint.mjs and experiments/close-idle-connections.mjs on Node 22.23.4, 24.22.3 and 26.13.1                                                |
| results/long-request.txt                                                     | experiments/long-request.mjs on Node 22.23.4, 24.22.3 and 26.13.1 (exploratory, one run per case)                                                             |
| results/signals.txt                                                          | Signal forwarding through `sh -c` and `npm start` on the Linux host (Node 22.23.4, dash, npm 10.9.9)                                                          |
| results/pid1-namespace.txt                                                   | PID 1 behaviour in a Linux PID namespace                                                                                                                      |
| results/docker-stop.txt                                                      | `docker stop -t 10` with four launch styles, and the container logs showing whether the handler ran. Docker Desktop 29.9.2, image node:22-slim (Node 22.23.5) |
| results/\*.log                                                               | Console output of the runs                                                                                                                                    |

## keepAliveTimeout 1000 ms

A plain Node server exited in about 150 ms with the lab's Node HTTP client, not the roughly 2150 ms the other points predict (150 ms of request time + timeout + 1000 ms buffer). The server advertises `Keep-Alive: timeout=1`, and Node's HTTP agent subtracts `agentKeepAliveTimeoutBuffer` (1000 ms by default, added in v22.20.0 and v24.7.0) from that hint. That leaves no time, so the agent drops the socket right after the response. With `agentKeepAliveTimeoutBuffer` set to 0, or with a raw TCP socket that ignores the hint, exit takes about 2.1 s. `experiments/keepalive-hint.mjs` reproduces both, and its output is in `results/keepalive-hint.txt`.

## Limits of the data

- Each matrix case ran 3 times, the keepAliveTimeout sweep and the module runs 2 times, and `close-idle-connections.mjs` once per mode (exploratory).
- Counts moved by a few requests between runs. Treat small differences as noise.
- Node 26.13.1 was used for the selected keep-alive experiments and the exploratory long-request/second-SIGTERM check. The main framework matrix and full shutdown-module matrix were not run on that version.
- `docker/Dockerfile` uses `node:22-slim`, so the Node version inside the image follows the tag. This run used Node 22.23.5.
- In the Docker run, `npm start` stopped the container in about 0.8 s with exit code 1, and the container log shows no `GOT SIGTERM`. The fast stop came from npm exiting, not from the app's handler running.
- The shell, npm and Docker results depend on the versions listed above and can differ elsewhere.
