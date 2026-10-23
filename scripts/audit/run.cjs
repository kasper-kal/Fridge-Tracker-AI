/**
 * Runs the audit instruments one after another and prints one verdict per
 * instrument plus a total. Exit code is 0 only when every instrument passed.
 *
 * Usage: node scripts/audit/run.cjs [--only=layout,icons,consistency,wording]
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const INSTRUMENTS = [
  ["dead-name + breakpoints", "styles.cjs"],
  ["layout + icons + consistency + wording", "browser.cjs"],
];

const extra = process.argv.slice(2);

const results = [];
for (const [label, file] of INSTRUMENTS) {
  console.log(`\n=== ${label} (${file}) ===`);
  const started = Date.now();
  const run = spawnSync(process.execPath, [path.join(__dirname, file), ...extra], {
    stdio: "inherit",
    env: process.env,
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  results.push({ label, file, code: run.status ?? 2, seconds });
}

console.log("\n=== summary ===");
for (const result of results) {
  console.log(
    `${result.code === 0 ? "PASS" : "FAIL"}  ${String(result.seconds).padStart(5)}s  ${result.label}`,
  );
}
const failed = results.filter((result) => result.code !== 0);
if (failed.length) {
  console.log(`\n${failed.length} of ${results.length} instruments report findings.`);
} else {
  console.log(`\nAll ${results.length} instruments pass.`);
}
process.exitCode = failed.length ? 1 : 0;
