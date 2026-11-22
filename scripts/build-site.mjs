import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  npm = process.platform === "win32" ? "npm.cmd" : "npm";
execFileSync(
  resolve(root, "source/node_modules/.bin/esbuild"),
  [
    "source/src/backend/helpers.ts",
    "--bundle",
    "--format=esm",
    "--platform=neutral",
    "--outfile=native/helpers.generated.mjs",
  ],
  { cwd: root, stdio: "inherit" },
);
execFileSync(npm, ["run", "build"], {
  cwd: resolve(root, "source"),
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
});
execFileSync(process.execPath, ["scripts/build-original-with-admin.mjs"], {
  cwd: root,
  stdio: "inherit",
});
execFileSync(process.execPath, ["scripts/build-linux.mjs"], {
  cwd: root,
  stdio: "inherit",
});
