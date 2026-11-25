// Aggregates results/raw.jsonl into results/summary.md and results/summary.csv.
//   node src/report.mjs
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    raw: { type: "string", default: "results/raw.jsonl" },
    env: { type: "string", default: "results/environment.json" },
    name: { type: "string", default: "summary" },
  },
});

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);
const raw = fs
  .readFileSync(path.join(root, args.raw), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const env = fs.existsSync(path.join(root, args.env))
  ? JSON.parse(fs.readFileSync(path.join(root, args.env), "utf8"))
  : {};

const STRATEGY_ORDER = [
  "none",
  "exit",
  "drain",
  "native",
  "drain-delay",
  "drain-delay-close",
  "native-delay",
  "module",
];
const FRAMEWORK_ORDER = ["node", "express", "fastify", "hono"];
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const keyOf = (r) =>
  [
    r.label,
    r.keepAlive,
    r.keepAliveMs ?? "",
    r.lagMs,
    r.strategy,
    r.framework,
  ].join("|");
const groups = new Map();
for (const r of raw) {
  const k = keyOf(r);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}

const fmtCount = (vals) => {
  const m = mean(vals);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  if (hi === 0) return "0";
  return lo === hi ? `${m.toFixed(0)}` : `${m.toFixed(1)} [${lo}-${hi}]`;
};

function fmtExit(runs) {
  const forced = runs.filter(
    (r) => r.serverExit.hung || r.serverExit.code === 1,
  ).length;
  if (forced) return `FORCED ${forced}/${runs.length}`;
  if (runs.every((r) => r.serverExit.signal))
    return `killed (${runs[0].serverExit.signal})`;
  return `${Math.round(median(runs.map((r) => r.serverExit.afterSigtermMs)))} ms`;
}

const tallyNonOk = (runs) => {
  const t = {};
  for (const r of runs) {
    for (const part of [r.outcomesBefore, r.outcomesAfter]) {
      for (const [k, v] of Object.entries(part))
        if (k !== "ok") t[k] = (t[k] ?? 0) + v;
    }
  }
  const e = Object.entries(t).sort((a, b) => b[1] - a[1]);
  return e.length
    ? e.map(([k, v]) => `${k} ${(v / runs.length).toFixed(0)}`).join(", ")
    : "-";
};

const labels = [...new Set(raw.map((r) => r.label))];
const lines = [];
lines.push("# SIGTERM lab results", "");
lines.push(
  `Generated ${new Date().toISOString()} from ${raw.length} runs.`,
  "",
  `Environment: Node ${env.node}, ${env.platform}.`,
  `Frameworks: ${Object.entries(env.frameworks ?? {})
    .map(([k, v]) => `${k}@${v}`)
    .join(", ")}.`,
  "",
  "Cells show the mean number of failed requests per run, with [min-max] across repetitions when they differ.",
  "Load: 200 requests/s (open loop), each request takes 150 ms server-side, so about 30 requests are in flight when SIGTERM arrives.",
  "",
);

const csv = [
  "label,keepAlive,keepAliveMs,lagMs,strategy,framework,runs,failedInFlightMean,failedNewMean,sentAfterMean,exitMedianMs,forcedRuns",
];

for (const label of labels) {
  const rows = raw.filter((r) => r.label === label);
  const keepAlives = [...new Set(rows.map((r) => r.keepAlive))];
  const kaMsList = [...new Set(rows.map((r) => r.keepAliveMs ?? ""))];
  const lags = [...new Set(rows.map((r) => r.lagMs))].sort((a, b) => a - b);
  const frameworks = FRAMEWORK_ORDER.filter((f) =>
    rows.some((r) => r.framework === f),
  );
  const strategies = STRATEGY_ORDER.filter((s) =>
    rows.some((r) => r.strategy === s),
  );

  lines.push(`## Experiment: ${label}`, "");

  for (const keepAlive of keepAlives) {
    for (const kaMs of kaMsList) {
      for (const lag of lags) {
        const sel = (fw, st) =>
          groups.get([label, keepAlive, kaMs, lag, st, fw].join("|"));
        const any = frameworks.some((fw) =>
          strategies.some((st) => sel(fw, st)),
        );
        if (!any) continue;
        const heading =
          `Keep-alive client: ${keepAlive ? "on" : "off"}` +
          (kaMs ? `, server keepAliveTimeout override: ${kaMs} ms` : "") +
          `, load balancer still sending for ${lag} ms after SIGTERM`;
        lines.push(`### ${heading}`, "");

        const table = (title, cell) => {
          lines.push(
            `**${title}**`,
            "",
            `| strategy | ${frameworks.join(" | ")} |`,
            `|---|${frameworks.map(() => "---").join("|")}|`,
          );
          for (const st of strategies) {
            const cells = frameworks.map((fw) => {
              const runs = sel(fw, st);
              return runs ? cell(runs) : "n/a";
            });
            if (cells.every((c) => c === "n/a")) continue;
            lines.push(`| ${st} | ${cells.join(" | ")} |`);
          }
          lines.push("");
        };

        table(
          "In-flight requests lost (sent before SIGTERM, no 200 back)",
          (runs) => fmtCount(runs.map((r) => r.failedInFlight)),
        );
        if (lag > 0) {
          const sent = Math.round(
            mean(
              raw
                .filter((r) => r.label === label && r.lagMs === lag)
                .map((r) => r.sentAfterSigterm),
            ),
          );
          table(
            `New requests failed (sent after SIGTERM, about ${sent} per run)`,
            (runs) => fmtCount(runs.map((r) => r.failedNew)),
          );
        }
        table(
          "Time for the process to exit after SIGTERM (FORCED = hit the 8 s force-exit limit)",
          fmtExit,
        );
        table("What the failures were (mean per run)", tallyNonOk);
      }
    }
  }
}

for (const [k, runs] of groups) {
  const r0 = runs[0];
  csv.push(
    [
      r0.label,
      r0.keepAlive,
      r0.keepAliveMs ?? "",
      r0.lagMs,
      r0.strategy,
      r0.framework,
      runs.length,
      mean(runs.map((r) => r.failedInFlight)).toFixed(2),
      mean(runs.map((r) => r.failedNew)).toFixed(2),
      mean(runs.map((r) => r.sentAfterSigterm)).toFixed(1),
      runs.every((r) => r.serverExit.afterSigtermMs !== undefined)
        ? Math.round(median(runs.map((r) => r.serverExit.afterSigtermMs)))
        : "",
      runs.filter((r) => r.serverExit.hung || r.serverExit.code === 1).length,
    ].join(","),
  );
}

fs.writeFileSync(path.join(root, `results/${args.name}.md`), lines.join("\n"));
fs.writeFileSync(
  path.join(root, `results/${args.name}.csv`),
  csv.join("\n") + "\n",
);
console.log(
  `wrote results/${args.name}.md and results/${args.name}.csv (${raw.length} runs)`,
);
