#!/usr/bin/env bash
# Splits results/raw-module.jsonl by Node version and writes one summary per version,
# so each summary header shows the right Node version.
set -eu
cd "$(dirname "$0")"
for v in 22 24; do
  node -e '
    const fs=require("fs"); const v=process.argv[1];
    const rows=fs.readFileSync("results/raw-module.jsonl","utf8").trim().split("\n")
      .filter(l=>(JSON.parse(l).serverLogHead.match(/node=v(\d+)/)||[])[1]===v);
    fs.writeFileSync(`results/raw-module-node${v}.jsonl`, rows.join("\n")+"\n");
  ' "$v"
  node src/report.mjs --raw "results/raw-module-node$v.jsonl" --env "results/environment-node$v.json" --name "summary-module-node$v"
done
