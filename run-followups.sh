#!/usr/bin/env bash
# Follow-up experiments, run one after another (never in parallel: timings share the CPU).
set -u
cd "$(dirname "$0")"
M="node src/run-matrix.mjs"

# A. Fastify: framework-native close() WITH a shutdown delay, to compare against plain close().
# already in the main matrix: $M --frameworks fastify --strategies native-delay --label matrix

# B. Same scenarios, but the client opens a fresh connection per request (no keep-alive reuse).
$M --keepalive false --label no-keepalive --lags 1000,2500 \
   --strategies drain,drain-delay,drain-delay-close,native,native-delay

# C. Why does draining take so long? Sweep the server keepAliveTimeout on plain Node.
$M --frameworks node --strategies drain --lags 0 --keepalive-ms-list 1000,3000,5000,8000 \
   --force-ms 15000 --label ka-sweep --reps 2
