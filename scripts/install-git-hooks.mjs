// Runs from frontend `pnpm install` (prepare). Points this clone at .githooks/ so commit-msg strips agent attribution.
// Never fails the install: CI, Docker builds and downloads without .git skip silently.
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hook = resolve(root, ".githooks/commit-msg");

try {
  if (process.env.CI || !existsSync(resolve(root, ".git")) || !existsSync(hook)) {
    process.exit(0);
  }
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: root, stdio: "ignore" });
  chmodSync(hook, 0o755);
} catch {
  // Hook install is a convenience; CI (pr-rules) is the enforcement.
}
