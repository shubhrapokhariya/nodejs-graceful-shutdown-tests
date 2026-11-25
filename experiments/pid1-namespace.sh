#!/usr/bin/env bash
# Experiment 3 (no Docker): does a Node process running as PID 1 obey SIGTERM?
#
# A container's first process is PID 1 inside its own PID namespace. Linux gives PID 1
# special treatment: a signal sent from outside the namespace is dropped unless the
# process installed a handler for it. `unshare --pid` reproduces that without Docker.
#
# Needs: Linux, util-linux `unshare`, and root (or unprivileged user namespaces).
# Run:   bash experiments/pid1-namespace.sh

set -u
cd "$(dirname "$0")/.."

if ! unshare --pid --fork --mount-proc true 2>/dev/null; then
  echo "unshare --pid is not permitted here (try with sudo). Skipping."
  exit 2
fi

printf '%-12s %-45s\n' "HANDLER" "RESULT 2s after SIGTERM from outside the namespace"
for handle in 1 0; do
  log="$(mktemp)"
  HANDLE=$handle unshare --pid --fork --mount-proc node src/signal-target.mjs >"$log" 2>&1 &
  unshare_pid=$!
  sleep 1.2
  app_pid="$(pgrep -P "$unshare_pid" node | head -1)"
  if [ -z "$app_pid" ]; then
    echo "could not find the app process"; kill "$unshare_pid" 2>/dev/null; continue
  fi
  inside_pid="$(grep -o 'pid=[0-9]*' "$log" | head -1)"
  kill -TERM "$app_pid"
  sleep 2
  if kill -0 "$app_pid" 2>/dev/null; then
    result="STILL RUNNING (SIGTERM was ignored; would need SIGKILL)"
    kill -KILL "$app_pid" 2>/dev/null
  else
    result="stopped"
    grep -q 'GOT SIGTERM' "$log" && result="stopped (handler ran)"
  fi
  printf '%-12s %-45s (app saw itself as %s)\n' "HANDLE=$handle" "$result" "$inside_pid"
  wait "$unshare_pid" 2>/dev/null
  rm -f "$log"
done
