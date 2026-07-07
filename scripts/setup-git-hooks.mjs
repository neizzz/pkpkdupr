import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const runGit = (args) =>
  spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

if (process.env.CI) {
  process.exit(0);
}

if (!existsSync(path.join(repoRoot, ".git"))) {
  process.exit(0);
}

const insideWorkTree = runGit(["rev-parse", "--is-inside-work-tree"]);
if (insideWorkTree.status !== 0 || insideWorkTree.stdout.trim() !== "true") {
  process.exit(0);
}

const currentHooksPath = runGit(["config", "--get", "core.hooksPath"]);
if (currentHooksPath.status === 0 && currentHooksPath.stdout.trim() === ".githooks") {
  process.exit(0);
}

const setHooksPath = runGit(["config", "core.hooksPath", ".githooks"]);
if (setHooksPath.status !== 0) {
  const details = (setHooksPath.stderr || setHooksPath.stdout).trim();
  console.warn(
    `[setup-git-hooks] core.hooksPath 설정을 건너뜁니다${
      details ? `: ${details}` : "."
    }`,
  );
  process.exit(0);
}

console.log("[setup-git-hooks] core.hooksPath를 .githooks로 설정했습니다.");
