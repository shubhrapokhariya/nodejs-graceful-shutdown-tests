#!/usr/bin/env bash
# Experiment 4 (needs Docker): how long does `docker stop` really take, per startup style?
#
# `docker stop -t 10` sends SIGTERM, waits 10s, then SIGKILL (exit code 137).
#   ~0-1s, exit 0 or 143  -> the app received SIGTERM and stopped
#   ~10s,  exit 137       -> SIGTERM never reached / was ignored by the app
#
# Run from the project root:   bash docker/run-docker-test.sh

set -u
cd "$(dirname "$0")/.."
IMG=sigterm-lab-signal
docker build -q -t "$IMG" -f docker/Dockerfile . >/dev/null || { echo "build failed"; exit 1; }

run_case() {
  local label="$1" handle="$2"; shift 2
  local flags=() cmd=()
  while [ $# -gt 0 ]; do
    if [ "$1" = "--" ]; then shift; cmd=("$@"); break; fi
    flags+=("$1"); shift
  done
  local name="sigterm-lab-$$-$RANDOM"
  docker run -d --name "$name" -e HANDLE="$handle" "${flags[@]}" "$IMG" "${cmd[@]}" >/dev/null
  sleep 2
  local start end elapsed code
  start=$(date +%s.%N)
  docker stop -t 10 "$name" >/dev/null
  end=$(date +%s.%N)
  elapsed=$(awk -v a="$start" -v b="$end" 'BEGIN { printf "%.1f", b - a }')
  code=$(docker inspect -f '{{.State.ExitCode}}' "$name")
  printf '%-34s handler=%s  stop took %5ss  exit code %s\n' "$label" "$handle" "$elapsed" "$code"
  docker rm -f "$name" >/dev/null
}

for handle in 1 0; do
  run_case 'exec form: node app.js'            "$handle" -- node src/signal-target.mjs
  run_case 'shell form: sh -c "node app.js"'   "$handle" -- sh -c 'node src/signal-target.mjs'
  run_case 'npm start'                          "$handle" -- npm start --silent
  run_case 'exec form + docker run --init'     "$handle" --init -- node src/signal-target.mjs
done
