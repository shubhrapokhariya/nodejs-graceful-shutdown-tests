# SIGTERM lab results

Generated 2026-11-24T06:21:51.596Z from 40 runs.

Environment: Node v22.23.4, Linux (WSL2).
Frameworks: express@5.3.0, fastify@5.12.8, hono@4.13.18, @hono/node-server@2.1.8.

Cells show the mean number of failed requests per run, with [min-max] across repetitions when they differ.
Load: 200 requests/s (open loop), each request takes 150 ms server-side, so about 30 requests are in flight when SIGTERM arrives.

## Experiment: module-node22

### Keep-alive client: on, load balancer still sending for 0 ms after SIGTERM

**In-flight requests lost (sent before SIGTERM, no 200 back)**

| strategy | node | express | fastify | hono |
| -------- | ---- | ------- | ------- | ---- |
| module   | 0    | 0       | 0       | 0    |

**Time for the process to exit after SIGTERM (FORCED = hit the 8 s force-exit limit)**

| strategy | node    | express | fastify | hono    |
| -------- | ------- | ------- | ------- | ------- |
| module   | 1512 ms | 1512 ms | 1513 ms | 1512 ms |

**What the failures were (mean per run)**

| strategy | node | express | fastify | hono |
| -------- | ---- | ------- | ------- | ---- |
| module   | -    | -       | -       | -    |

### Keep-alive client: on, load balancer still sending for 1000 ms after SIGTERM

**In-flight requests lost (sent before SIGTERM, no 200 back)**

| strategy | node | express | fastify | hono |
| -------- | ---- | ------- | ------- | ---- |
| module   | 0    | 0       | 0       | 0    |

**New requests failed (sent after SIGTERM, about 200 per run)**

| strategy | node | express | fastify | hono |
| -------- | ---- | ------- | ------- | ---- |
| module   | 0    | 0       | 0       | 0    |

**Time for the process to exit after SIGTERM (FORCED = hit the 8 s force-exit limit)**

| strategy | node    | express | fastify | hono    |
| -------- | ------- | ------- | ------- | ------- |
| module   | 1514 ms | 1514 ms | 1513 ms | 1513 ms |

**What the failures were (mean per run)**

| strategy | node | express | fastify | hono |
| -------- | ---- | ------- | ------- | ---- |
| module   | -    | -       | -       | -    |

### Keep-alive client: on, load balancer still sending for 2500 ms after SIGTERM

**In-flight requests lost (sent before SIGTERM, no 200 back)**

| strategy | node | express | fastify | hono |
| -------- | ---- | ------- | ------- | ---- |
| module   | 0    | 0       | 0       | 0    |

**New requests failed (sent after SIGTERM, about 500 per run)**

| strategy | node            | express         | fastify | hono            |
| -------- | --------------- | --------------- | ------- | --------------- |
| module   | 199.5 [199-200] | 203.0 [199-207] | 200     | 200.0 [199-201] |

**Time for the process to exit after SIGTERM (FORCED = hit the 8 s force-exit limit)**

| strategy | node    | express | fastify | hono    |
| -------- | ------- | ------- | ------- | ------- |
| module   | 1657 ms | 1749 ms | 1653 ms | 1654 ms |

**What the failures were (mean per run)**

| strategy | node             | express          | fastify                        | hono                           |
| -------- | ---------------- | ---------------- | ------------------------------ | ------------------------------ |
| module   | econnrefused 200 | econnrefused 203 | econnrefused 199, econnreset 1 | econnrefused 200, econnreset 1 |

## Experiment: module-nokeepalive-node22

### Keep-alive client: off, load balancer still sending for 1000 ms after SIGTERM

**In-flight requests lost (sent before SIGTERM, no 200 back)**

| strategy | node | express | fastify | hono |
| -------- | ---- | ------- | ------- | ---- |
| module   | 0    | 0       | 0       | 0    |

**New requests failed (sent after SIGTERM, about 200 per run)**

| strategy | node | express | fastify | hono |
| -------- | ---- | ------- | ------- | ---- |
| module   | 0    | 0       | 0       | 0    |

**Time for the process to exit after SIGTERM (FORCED = hit the 8 s force-exit limit)**

| strategy | node    | express | fastify | hono    |
| -------- | ------- | ------- | ------- | ------- |
| module   | 1513 ms | 1508 ms | 1509 ms | 1510 ms |

**What the failures were (mean per run)**

| strategy | node | express | fastify | hono |
| -------- | ---- | ------- | ------- | ---- |
| module   | -    | -       | -       | -    |

### Keep-alive client: off, load balancer still sending for 2500 ms after SIGTERM

**In-flight requests lost (sent before SIGTERM, no 200 back)**

| strategy | node | express | fastify | hono |
| -------- | ---- | ------- | ------- | ---- |
| module   | 0    | 0       | 0       | 0    |

**New requests failed (sent after SIGTERM, about 501 per run)**

| strategy | node            | express | fastify         | hono |
| -------- | --------------- | ------- | --------------- | ---- |
| module   | 200.5 [200-201] | 200     | 200.5 [200-201] | 200  |

**Time for the process to exit after SIGTERM (FORCED = hit the 8 s force-exit limit)**

| strategy | node    | express | fastify | hono    |
| -------- | ------- | ------- | ------- | ------- |
| module   | 1653 ms | 1655 ms | 1655 ms | 1656 ms |

**What the failures were (mean per run)**

| strategy | node                           | express                        | fastify                        | hono             |
| -------- | ------------------------------ | ------------------------------ | ------------------------------ | ---------------- |
| module   | econnrefused 200, econnreset 1 | econnrefused 200, econnreset 1 | econnrefused 200, econnreset 1 | econnrefused 200 |
