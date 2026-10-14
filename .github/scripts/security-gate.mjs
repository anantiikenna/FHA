// Dependency security gate (AGENTS.md §36 Step 7 — branch flow).
// Compares `npm audit --json` against a committed baseline of KNOWN
// advisories. Passes only when no NEW advisory appears; existing ones are
// tracked in .github/security-baseline.json for later remediation.
// Pure Node — no installs required. Run from anywhere:
//   node .github/scripts/security-gate.mjs           → gate (exit 1 on new vulns)
//   node .github/scripts/security-gate.mjs --update  → rewrite the baseline

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const webDir = join(repoRoot, "web");
const baselinePath = join(repoRoot, ".github", "security-baseline.json");
const SEVERITY_ORDER = ["info", "low", "moderate", "high", "critical"];

function currentAdvisories() {
  let out = "";
  try {
    out = execFileSync("npm", ["audit", "--json"], {
      cwd: webDir,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      shell: process.platform === "win32",
    });
  } catch (err) {
    // npm audit exits non-zero when vulnerabilities exist — expected.
    if (err.stdout && err.stdout.trim().startsWith("{")) {
      out = err.stdout;
    } else {
      console.error(`::error::npm audit failed or returned no JSON: ${err.message}`);
      process.exit(1);
    }
  }

  let report;
  try {
    report = JSON.parse(out);
  } catch {
    console.error("::error::Could not parse npm audit JSON output.");
    process.exit(1);
  }

  const found = new Map();
  for (const [pkg, info] of Object.entries(report.vulnerabilities ?? {})) {
    for (const via of info.vias ?? info.via ?? []) {
      if (!via || typeof via !== "object" || !via.url) continue;
      const id = via.url.split("/").filter(Boolean).pop();
      if (!found.has(id)) {
        found.set(id, {
          id,
          severity: via.severity ?? info.severity ?? "unknown",
          title: via.title ?? pkg,
          packages: [],
        });
      }
      const entry = found.get(id);
      if (!entry.packages.includes(pkg)) entry.packages.push(pkg);
    }
  }
  return found;
}

function loadBaseline() {
  try {
    const list = JSON.parse(readFileSync(baselinePath, "utf8"));
    return new Map(list.map((a) => [a.id, a]));
  } catch {
    return null;
  }
}

const current = currentAdvisories();

if (process.argv.includes("--update")) {
  const list = [...current.values()].sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(baselinePath, JSON.stringify(list, null, 2) + "\n");
  console.log(`Baseline updated: ${list.length} known advisories recorded.`);
  process.exit(0);
}

const baseline = loadBaseline();
if (!baseline) {
  console.error(
    "::error::.github/security-baseline.json missing — generate it with: node .github/scripts/security-gate.mjs --update"
  );
  process.exit(1);
}

const newOnes = [...current.values()].filter((a) => !baseline.has(a.id));
const fixed = [...baseline.keys()].filter((id) => !current.has(id));

if (newOnes.length > 0) {
  newOnes.sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(b.severity) - SEVERITY_ORDER.indexOf(a.severity)
  );
  console.error(`::error::${newOnes.length} NEW dependency advisory(ies) found — fix them or review before merging:`);
  for (const a of newOnes) {
    console.error(`  [${a.severity.toUpperCase()}] ${a.title} (${a.packages.join(", ")}) — ${a.id}`);
  }
  process.exit(1);
}

if (fixed.length > 0) {
  console.log(
    `::notice::${fixed.length} baseline advisory(ies) no longer present — run --update to shrink the baseline: ${fixed.join(", ")}`
  );
}
console.log(
  `Security gate OK: ${current.size} known advisory(ies) (all in baseline), 0 new.`
);
