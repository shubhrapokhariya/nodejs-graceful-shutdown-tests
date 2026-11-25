#!/usr/bin/env bash
# Tests the copy-paste shutdown module (src/graceful-shutdown.mjs) on two Node versions.
# Usage: NODE22=/path/to/node22 NODE24=/path/to/node24 ./run-module-tests.sh
set -u
cd "$(dirname "$0")"
N22="${NODE22:-node}"
N24="${NODE24:?set NODE24 to a Node 24 binary}"
for spec in "$N22:node22" "$N24:node24"; do
  bin="${spec%:*}"; tag="${spec##*:}"
  $bin src/run-matrix.mjs --strategies module --lags 0,1000,2500 --reps 2 --label module-$tag --out results/raw-module.jsonl
  $bin src/run-matrix.mjs --strategies module --lags 1000,2500 --reps 2 --keepalive false --label module-nokeepalive-$tag --out results/raw-module.jsonl
done
