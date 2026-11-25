# SIGTERM lab results

Generated 2026-11-24T06:21:51.690Z from 40 runs.

Environment: Node v24.22.3, Linux (WSL2).
Frameworks: express@5.3.0, fastify@5.12.8, hono@4.13.18, @hono/node-server@2.1.8.

Cells show the mean number of failed requests per run, with [min-max] across repetitions when they differ.
Load: 200 requests/s (open loop), each request takes 150 ms server-side, so about 30 requests are in flight when SIGTERM arrives.

## Experiment: module-node24

### Keep-alive client: on, load balancer still sending for 0 ms after SIGTERM

**In-flight requests lost (sent before SIGTERM, no 200 back)**

| strategy | node | express | fastify | hono |
| -------- | ---- | ------- | ------- | ---- |
| module   | 0    | 0       | 0       | 0    |

**Time for the process to exit after SIGTERM (FORCED = hit the 8 s force-exit limit)**

| strategy | node    | express | fastify | hono    |
| -------- | ------- | ------- | ------- | ------- |
| module   | 1508 ms | 1515 ms | 1510 ms | 1509 ms |

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
| module   | 1508 ms | 1510 ms | 1508 ms | 1507 ms |

**What the failures were (mean per run)**

| strategy | node | express | fastify | hono |
| -------- | ---- | ------- | ------- | ---- |
| module   | -    | -       | -       | -    |

### Keep-alive client: on, load balancer still sending for 2500 ms after SIGTERM

**In-flight requests lost (sent before SIGTERM, no 200 back)**

| strategy | node | express | fastify | hono |
| -------- | ---- | ------- | ------- | ---- |
| module   | 0    | 0       | 0       | 0    |

**New requests failed (sent after SIGTERM, about 501 per run)**

| strategy | node            | express         | fastify | hono |
| -------- | --------------- | --------------- | ------- | ---- |
| module   | 199.5 [199-200] | 199.5 [199-200] | 200     | 200  |

**Time for the process to exit after SIGTERM (FORCED = hit the 8 s force-exit limit)**

| strategy | node    | express | fastify | hono    |
| -------- | ------- | ------- | ------- | ------- |
| module   | 1656 ms | 1657 ms | 1655 ms | 1657 ms |

**What the failures were (mean per run)**

| strategy | node             | express          | fastify                        | hono             |
| -------- | ---------------- | ---------------- | ------------------------------ | ---------------- |
| module   | econnrefused 200 | econnrefused 200 | econnrefused 200, econnreset 1 | econnrefused 200 |

## Experiment: module-nokeepalive-node24

### Keep-alive client: off, load balancer still sending for 1000 ms after SIGTERM

**In-flight requests lost (sent before SIGTERM, no 200 back)**

| strategy | node | express | fastify | hono |
| -------- | ---- | ------- | ------- | ---- |
| module   | 0    | 0       | 0       | 0    |

**New requests failed (sent after SIGTERM, about 201 per run)**

| strategy | node | express | fastify | hono |
| -------- | ---- | ------- | ------- | ---- |
| module   | 0    | 0       | 0       | 0    |

**Time for the process to exit after SIGTERM (FORCED = hit the 8 s force-exit limit)**

| strategy | node    | express | fastify | hono    |
| -------- | ------- | ------- | ------- | ------- |
| module   | 1507 ms | 1507 ms | 1508 ms | 1507 ms |

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

| strategy | node            | express         | fastify | hono |
| -------- | --------------- | --------------- | ------- | ---- |
| module   | 200.5 [200-201] | 199.5 [199-200] | 199     | 200  |

**Time for the process to exit after SIGTERM (FORCED = hit the 8 s force-exit limit)**

| strategy | node    | express | fastify | hono    |
| -------- | ------- | ------- | ------- | ------- |
| module   | 1654 ms | 1657 ms | 1659 ms | 1657 ms |

**What the failures were (mean per run)**

| strategy | node                           | express          | fastify          | hono             |
| -------- | ------------------------------ | ---------------- | ---------------- | ---------------- |
| module   | econnrefused 200, econnreset 1 | econnrefused 200 | econnrefused 199 | econnrefused 200 |
