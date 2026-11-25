// Runs the experiment matrix and appends one JSON line per run to results/raw.jsonl.
//
//   node src/run-matrix.mjs                                  # main matrix, keep-alive ON
//   node src/run-matrix.mjs --keepalive false --label no-keepalive --lags 0,1000
//   node src/run-matrix.mjs --frameworks node --strategies drain --lags 0 \
//        --keepalive-ms-list 1000,3000,5000,8000 --force-ms 15000 --label ka-sweep --reps 2
//
// Reps are interleaved (rep 1 of every config, then rep 2 of every config...) so slow
// drift on a shared machine is spread across configs instead of landing on one.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
import { runScenario } from "./scenario.mjs";

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);
const require = createRequire(import.meta.url);

const { values } = parseArgs({
  options: {
    frameworks: { type: "string", default: "node,express,fastify,hono" },
    strategies: {
      type: "string",
      default:
        "none,exit,drain,drain-delay,drain-delay-close,native,native-delay",
    },
    lags: { type: "string", default: "0,1000,2500" },
    reps: { type: "string", default: "3" },
    keepalive: { type: "string", default: "true" },
    "keepalive-ms-list": { type: "string", default: "" },
    "force-ms": { type: "string", default: "8000" },
    label: { type: "string", default: "matrix" },
    out: { type: "string", default: "results/raw.jsonl" },
  },
});

const list = (s) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const frameworks = list(values.frameworks);
const strategies = list(values.strategies);
const lags = list(values.lags).map(Number);
const reps = Number(values.reps);
const keepAlive = values.keepalive !== "false";
const kaList = list(values["keepalive-ms-list"]).map(Number);
const forceMs = Number(values["force-ms"]);

const outPath = path.resolve(root, values.out);
fs.mkdirSync(path.dirname(outPath), { recursive: true });

// Record the environment once so the article can state exact versions.
const pkgVersion = (name) =>
  require(`${root}/node_modules/${name}/package.json`).version;
const environment = JSON.stringify(
  {
    date: new Date().toISOString(),
    node: process.version,
    platform: os.type(),
    frameworks: Object.fromEntries(
      ["express", "fastify", "hono", "@hono/node-server"].map((n) => [
        n,
        pkgVersion(n),
      ]),
    ),
  },
  null,
  2,
);
// One file per Node major, so a later run on another Node version cannot relabel earlier results.
for (const name of [
  "environment.json",
  `environment-node${process.versions.node.split(".")[0]}.json`,
]) {
  fs.writeFileSync(path.resolve(root, "results", name), environment);
}

// Build the config list. "native" only means something for fastify.
const configs = [];
for (const framework of frameworks) {
  for (const strategy of strategies) {
    if (strategy.startsWith("native") && framework !== "fastify") continue;
    for (const lagMs of lags) {
      for (const keepAliveMs of kaList.length ? kaList : [null]) {
        configs.push({ framework, strategy, lagMs, keepAliveMs });
      }
    }
  }
}

const total = configs.length * reps;
console.error(
  `${configs.length} configs x ${reps} reps = ${total} runs (label=${values.label}, keepAlive=${keepAlive})`,
);

let port = 5000 + Math.floor(Math.random() * 2000);
let n = 0;
const startedAt = Date.now();
for (let rep = 1; rep <= reps; rep++) {
  for (const cfg of configs) {
    n++;
    port += 1;
    const result = await runScenario({ ...cfg, port, keepAlive, forceMs });
    fs.appendFileSync(
      outPath,
      JSON.stringify({ label: values.label, rep, ...result }) + "\n",
    );
    const mins = ((Date.now() - startedAt) / 60000).toFixed(1);
    console.error(
      `[${n}/${total} ${mins}min] ${cfg.framework}/${cfg.strategy} lag=${cfg.lagMs}` +
        `${cfg.keepAliveMs ? ` ka=${cfg.keepAliveMs}` : ""} rep=${rep}: ` +
        `inFlightFail=${result.failedInFlight} newFail=${result.failedNew}/${result.sentAfterSigterm} ` +
        `exit=${JSON.stringify(result.serverExit)}`,
    );
  }
}
console.error("done");
