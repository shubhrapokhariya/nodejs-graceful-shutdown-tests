# SIGTERM lab results

Generated 2026-11-23T14:38:25.090Z from 290 runs.

Environment: Node v22.23.4, Linux (WSL2).
Frameworks: express@5.3.0, fastify@5.12.8, hono@4.13.18, @hono/node-server@2.1.8.

Cells show the mean number of failed requests per run, with [min-max] across repetitions when they differ.
Load: 200 requests/s (open loop), each request takes 150 ms server-side, so about 30 requests are in flight when SIGTERM arrives.

## Experiment: matrix

### Keep-alive client: on, load balancer still sending for 0 ms after SIGTERM

**In-flight requests lost (sent before SIGTERM, no 200 back)**

| strategy          | node | express | fastify      | hono         |
| ----------------- | ---- | ------- | ------------ | ------------ |
| none              | 30   | 30      | 29.7 [29-30] | 30           |
| exit              | 29   | 30      | 29.3 [29-30] | 29.7 [29-30] |
| drain             | 0    | 0       | 0            | 0            |
| native            | n/a  | n/a     | 0            | n/a          |
| drain-delay       | 0    | 0       | 0            | 0            |
| drain-delay-close | 0    | 0       | 0            | 0            |
| native-delay      | n/a  | n/a     | 0            | n/a          |

**Time for the process to exit after SIGTERM (FORCED = hit the 8 s force-exit limit)**

| strategy          | node             | express          | fastify          | hono             |
| ----------------- | ---------------- | ---------------- | ---------------- | ---------------- |
| none              | killed (SIGTERM) | killed (SIGTERM) | killed (SIGTERM) | killed (SIGTERM) |
| exit              | 7 ms             | 7 ms             | 7 ms             | 6 ms             |
| drain             | 6161 ms          | 6161 ms          | FORCED 3/3       | 6162 ms          |
| native            | n/a              | n/a              | FORCED 3/3       | n/a              |
| drain-delay       | 1512 ms          | 1514 ms          | 1513 ms          | 1512 ms          |
| drain-delay-close | 1512 ms          | 1514 ms          | 1513 ms          | 1510 ms          |
| native-delay      | n/a              | n/a              | 1517 ms          | n/a              |

**What the failures were (mean per run)**

| strategy          | node          | express       | fastify       | hono          |
| ----------------- | ------------- | ------------- | ------------- | ------------- |
| none              | econnreset 30 | econnreset 30 | econnreset 30 | econnreset 30 |
| exit              | econnreset 29 | econnreset 30 | econnreset 29 | econnreset 30 |
| drain             | -             | -             | -             | -             |
| native            | n/a           | n/a           | -             | n/a           |
| drain-delay       | -             | -             | -             | -             |
| drain-delay-close | -             | -             | -             | -             |
| native-delay      | n/a           | n/a           | -             | n/a           |

### Keep-alive client: on, load balancer still sending for 1000 ms after SIGTERM

**In-flight requests lost (sent before SIGTERM, no 200 back)**

| strategy          | node         | express | fastify      | hono         |
| ----------------- | ------------ | ------- | ------------ | ------------ |
| none              | 30           | 30      | 30           | 29.7 [29-30] |
| exit              | 29.3 [29-30] | 29      | 29.3 [29-30] | 29.7 [29-30] |
| drain             | 0            | 0       | 0            | 0            |
| native            | n/a          | n/a     | 0            | n/a          |
| drain-delay       | 0            | 0       | 0            | 0            |
| drain-delay-close | 0            | 0       | 0            | 0            |
| native-delay      | n/a          | n/a     | 0            | n/a          |

**New requests failed (sent after SIGTERM, about 201 per run)**

| strategy          | node            | express         | fastify         | hono            |
| ----------------- | --------------- | --------------- | --------------- | --------------- |
| none              | 200.7 [200-201] | 200.7 [200-201] | 200.7 [200-201] | 200.3 [200-201] |
| exit              | 200.3 [200-201] | 201             | 200.7 [200-201] | 200             |
| drain             | 7               | 7               | 7               | 7               |
| native            | n/a             | n/a             | 199.7 [199-200] | n/a             |
| drain-delay       | 0               | 0               | 0               | 0               |
| drain-delay-close | 0               | 0               | 0               | 0               |
| native-delay      | n/a             | n/a             | 0               | n/a             |

**Time for the process to exit after SIGTERM (FORCED = hit the 8 s force-exit limit)**

| strategy          | node             | express          | fastify          | hono             |
| ----------------- | ---------------- | ---------------- | ---------------- | ---------------- |
| none              | killed (SIGTERM) | killed (SIGTERM) | killed (SIGTERM) | killed (SIGTERM) |
| exit              | 7 ms             | 8 ms             | 7 ms             | 7 ms             |
| drain             | 7158 ms          | 7165 ms          | FORCED 3/3       | 7158 ms          |
| native            | n/a              | n/a              | 162 ms           | n/a              |
| drain-delay       | 1511 ms          | 1512 ms          | 1513 ms          | 1511 ms          |
| drain-delay-close | 1511 ms          | 1510 ms          | 1513 ms          | 1513 ms          |
| native-delay      | n/a              | n/a              | 1514 ms          | n/a              |

**What the failures were (mean per run)**

| strategy          | node                            | express                         | fastify                         | hono                            |
| ----------------- | ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| none              | econnrefused 200, econnreset 31 | econnrefused 200, econnreset 31 | econnrefused 199, econnreset 31 | econnrefused 199, econnreset 31 |
| exit              | econnrefused 199, econnreset 31 | econnrefused 199, econnreset 31 | econnrefused 199, econnreset 31 | econnrefused 199, econnreset 31 |
| drain             | econnrefused 7                  | econnrefused 7                  | econnrefused 7, econnreset 0    | econnrefused 7, econnreset 0    |
| native            | n/a                             | n/a                             | econnrefused 170, http503 30    | n/a                             |
| drain-delay       | -                               | -                               | -                               | -                               |
| drain-delay-close | -                               | -                               | -                               | -                               |
| native-delay      | n/a                             | n/a                             | -                               | n/a                             |

### Keep-alive client: on, load balancer still sending for 2500 ms after SIGTERM

**In-flight requests lost (sent before SIGTERM, no 200 back)**

| strategy          | node         | express      | fastify | hono         |
| ----------------- | ------------ | ------------ | ------- | ------------ |
| none              | 30           | 30           | 30      | 30           |
| exit              | 29.7 [29-30] | 29.3 [29-30] | 29      | 29.3 [29-30] |
| drain             | 0            | 0            | 0       | 0            |
| native            | n/a          | n/a          | 0       | n/a          |
| drain-delay       | 0            | 0            | 0       | 0            |
| drain-delay-close | 0            | 0            | 0       | 0            |
| native-delay      | n/a          | n/a          | 0       | n/a          |

**New requests failed (sent after SIGTERM, about 501 per run)**

| strategy          | node            | express         | fastify         | hono            |
| ----------------- | --------------- | --------------- | --------------- | --------------- |
| none              | 500.3 [500-501] | 500.3 [500-501] | 500.3 [500-501] | 500.3 [500-501] |
| exit              | 500.7 [500-501] | 500.7 [500-501] | 500.3 [500-501] | 500.3 [500-501] |
| drain             | 22.3 [16-34]    | 19.0 [17-23]    | 17              | 17              |
| native            | n/a             | n/a             | 499.7 [499-500] | n/a             |
| drain-delay       | 7               | 4.7 [0-7]       | 4.7 [0-7]       | 4.7 [0-7]       |
| drain-delay-close | 200.7 [200-201] | 199.7 [199-200] | 199.7 [199-200] | 200             |
| native-delay      | n/a             | n/a             | 199.7 [199-200] | n/a             |

**Time for the process to exit after SIGTERM (FORCED = hit the 8 s force-exit limit)**

| strategy          | node             | express          | fastify          | hono             |
| ----------------- | ---------------- | ---------------- | ---------------- | ---------------- |
| none              | killed (SIGTERM) | killed (SIGTERM) | killed (SIGTERM) | killed (SIGTERM) |
| exit              | 7 ms             | 7 ms             | 8 ms             | 8 ms             |
| drain             | FORCED 3/3       | FORCED 3/3       | FORCED 3/3       | FORCED 3/3       |
| native            | n/a              | n/a              | 161 ms           | n/a              |
| drain-delay       | 8659 ms          | 8663 ms          | FORCED 3/3       | 8660 ms          |
| drain-delay-close | 1651 ms          | 1658 ms          | 1656 ms          | 1658 ms          |
| native-delay      | n/a              | n/a              | 1662 ms          | n/a              |

**What the failures were (mean per run)**

| strategy          | node                            | express                         | fastify                                    | hono                            |
| ----------------- | ------------------------------- | ------------------------------- | ------------------------------------------ | ------------------------------- |
| none              | econnrefused 499, econnreset 31 | econnrefused 499, econnreset 31 | econnrefused 499, econnreset 31            | econnrefused 499, econnreset 31 |
| exit              | econnrefused 499, econnreset 31 | econnrefused 499, econnreset 31 | econnrefused 499, econnreset 30            | econnrefused 498, econnreset 31 |
| drain             | econnrefused 22, econnreset 0   | econnrefused 18, econnreset 1   | econnrefused 17, econnreset 0              | econnrefused 17, econnreset 0   |
| native            | n/a                             | n/a                             | econnrefused 469, http503 30, econnreset 0 | n/a                             |
| drain-delay       | econnrefused 6, econnreset 1    | econnrefused 4, econnreset 0    | econnrefused 5                             | econnrefused 5                  |
| drain-delay-close | econnrefused 200, econnreset 1  | econnrefused 200                | econnrefused 200                           | econnrefused 200                |
| native-delay      | n/a                             | n/a                             | econnrefused 169, http503 31               | n/a                             |

## Experiment: no-keepalive

### Keep-alive client: off, load balancer still sending for 1000 ms after SIGTERM

**In-flight requests lost (sent before SIGTERM, no 200 back)**

| strategy          | node | express | fastify | hono |
| ----------------- | ---- | ------- | ------- | ---- |
| drain             | 0    | 0       | 0       | 0    |
| native            | n/a  | n/a     | 0       | n/a  |
| drain-delay       | 0    | 0       | 0       | 0    |
| drain-delay-close | 0    | 0       | 0       | 0    |
| native-delay      | n/a  | n/a     | 0       | n/a  |

**New requests failed (sent after SIGTERM, about 201 per run)**

| strategy          | node | express         | fastify         | hono            |
| ----------------- | ---- | --------------- | --------------- | --------------- |
| drain             | 200  | 200.7 [200-201] | 200.3 [199-201] | 200.7 [200-201] |
| native            | n/a  | n/a             | 200.3 [200-201] | n/a             |
| drain-delay       | 0    | 0               | 0               | 0               |
| drain-delay-close | 0    | 0               | 0               | 0               |
| native-delay      | n/a  | n/a             | 0               | n/a             |

**Time for the process to exit after SIGTERM (FORCED = hit the 8 s force-exit limit)**

| strategy          | node    | express | fastify | hono    |
| ----------------- | ------- | ------- | ------- | ------- |
| drain             | 157 ms  | 156 ms  | 152 ms  | 151 ms  |
| native            | n/a     | n/a     | 152 ms  | n/a     |
| drain-delay       | 1509 ms | 1512 ms | 1511 ms | 1519 ms |
| drain-delay-close | 1515 ms | 1511 ms | 1519 ms | 1514 ms |
| native-delay      | n/a     | n/a     | 1510 ms | n/a     |

**What the failures were (mean per run)**

| strategy          | node                           | express                        | fastify                                   | hono                           |
| ----------------- | ------------------------------ | ------------------------------ | ----------------------------------------- | ------------------------------ |
| drain             | econnrefused 199, econnreset 1 | econnrefused 200, econnreset 1 | econnrefused 200, econnreset 1            | econnrefused 200, econnreset 1 |
| native            | n/a                            | n/a                            | econnrefused 199, econnreset 1, http503 0 | n/a                            |
| drain-delay       | -                              | -                              | -                                         | -                              |
| drain-delay-close | -                              | -                              | -                                         | -                              |
| native-delay      | n/a                            | n/a                            | -                                         | n/a                            |

### Keep-alive client: off, load balancer still sending for 2500 ms after SIGTERM

**In-flight requests lost (sent before SIGTERM, no 200 back)**

| strategy          | node | express | fastify | hono |
| ----------------- | ---- | ------- | ------- | ---- |
| drain             | 0    | 0       | 0       | 0    |
| native            | n/a  | n/a     | 0       | n/a  |
| drain-delay       | 0    | 0       | 0       | 0    |
| drain-delay-close | 0    | 0       | 0       | 0    |
| native-delay      | n/a  | n/a     | 0       | n/a  |

**New requests failed (sent after SIGTERM, about 500 per run)**

| strategy          | node            | express         | fastify         | hono            |
| ----------------- | --------------- | --------------- | --------------- | --------------- |
| drain             | 500             | 500.3 [500-501] | 500.3 [500-501] | 500.0 [499-501] |
| native            | n/a             | n/a             | 500.7 [500-501] | n/a             |
| drain-delay       | 199.7 [199-200] | 200.3 [200-201] | 199             | 200             |
| drain-delay-close | 199.7 [199-200] | 199.7 [199-200] | 200.0 [199-201] | 200             |
| native-delay      | n/a             | n/a             | 200.3 [199-201] | n/a             |

**Time for the process to exit after SIGTERM (FORCED = hit the 8 s force-exit limit)**

| strategy          | node    | express | fastify | hono    |
| ----------------- | ------- | ------- | ------- | ------- |
| drain             | 152 ms  | 153 ms  | 153 ms  | 152 ms  |
| native            | n/a     | n/a     | 153 ms  | n/a     |
| drain-delay       | 1653 ms | 1654 ms | 1657 ms | 1657 ms |
| drain-delay-close | 1656 ms | 1659 ms | 1656 ms | 1655 ms |
| native-delay      | n/a     | n/a     | 1653 ms | n/a     |

**What the failures were (mean per run)**

| strategy          | node                           | express                        | fastify                                   | hono                           |
| ----------------- | ------------------------------ | ------------------------------ | ----------------------------------------- | ------------------------------ |
| drain             | econnrefused 499, econnreset 1 | econnrefused 500, econnreset 1 | econnrefused 499, econnreset 1            | econnrefused 499, econnreset 1 |
| native            | n/a                            | n/a                            | econnrefused 500, econnreset 1            | n/a                            |
| drain-delay       | econnrefused 199, econnreset 1 | econnrefused 200, econnreset 1 | econnrefused 199                          | econnrefused 200, econnreset 0 |
| drain-delay-close | econnrefused 199, econnreset 0 | econnrefused 200               | econnrefused 199, econnreset 1            | econnrefused 200, econnreset 0 |
| native-delay      | n/a                            | n/a                            | econnrefused 200, econnreset 0, http503 0 | n/a                            |

## Experiment: ka-sweep

### Keep-alive client: on, server keepAliveTimeout override: 1000 ms, load balancer still sending for 0 ms after SIGTERM

**In-flight requests lost (sent before SIGTERM, no 200 back)**

| strategy | node |
| -------- | ---- |
| drain    | 0    |

**Time for the process to exit after SIGTERM (FORCED = hit the 8 s force-exit limit)**

| strategy | node   |
| -------- | ------ |
| drain    | 154 ms |

**What the failures were (mean per run)**

| strategy | node |
| -------- | ---- |
| drain    | -    |

### Keep-alive client: on, server keepAliveTimeout override: 3000 ms, load balancer still sending for 0 ms after SIGTERM

**In-flight requests lost (sent before SIGTERM, no 200 back)**

| strategy | node |
| -------- | ---- |
| drain    | 0    |

**Time for the process to exit after SIGTERM (FORCED = hit the 8 s force-exit limit)**

| strategy | node    |
| -------- | ------- |
| drain    | 4159 ms |

**What the failures were (mean per run)**

| strategy | node |
| -------- | ---- |
| drain    | -    |

### Keep-alive client: on, server keepAliveTimeout override: 5000 ms, load balancer still sending for 0 ms after SIGTERM

**In-flight requests lost (sent before SIGTERM, no 200 back)**

| strategy | node |
| -------- | ---- |
| drain    | 0    |

**Time for the process to exit after SIGTERM (FORCED = hit the 8 s force-exit limit)**

| strategy | node    |
| -------- | ------- |
| drain    | 6161 ms |

**What the failures were (mean per run)**

| strategy | node |
| -------- | ---- |
| drain    | -    |

### Keep-alive client: on, server keepAliveTimeout override: 8000 ms, load balancer still sending for 0 ms after SIGTERM

**In-flight requests lost (sent before SIGTERM, no 200 back)**

| strategy | node |
| -------- | ---- |
| drain    | 0    |

**Time for the process to exit after SIGTERM (FORCED = hit the 8 s force-exit limit)**

| strategy | node    |
| -------- | ------- |
| drain    | 9158 ms |

**What the failures were (mean per run)**

| strategy | node |
| -------- | ---- |
| drain    | -    |
