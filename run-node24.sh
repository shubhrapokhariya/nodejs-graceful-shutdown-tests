#!/usr/bin/env bash
# Same experiments on a second Node version. Usage: NODE24=/path/to/node24 ./run-node24.sh
set -u
cd "$(dirname "$0")"
NODE_BIN="${NODE24:?set NODE24 to a Node 24 binary}"
$NODE_BIN src/run-matrix.mjs --label matrix-node24 --out results/raw-node24.jsonl
cp results/environment.json results/environment-node24.json
$NODE_BIN src/run-matrix.mjs --frameworks node --strategies drain --lags 0 --keepalive-ms-list 1000,3000,5000,8000 --force-ms 15000 --label ka-sweep-node24 --reps 2 --out results/raw-node24.jsonl
$NODE_BIN src/run-matrix.mjs --keepalive false --label no-keepalive-node24 --lags 1000,2500 --strategies drain,drain-delay,drain-delay-close,native,native-delay --out results/raw-node24.jsonl
