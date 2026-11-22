import { execFileSync } from "node:child_process";
import { mkdirSync, copyFileSync, cpSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root = process.cwd(),
  output = resolve(root, "dist/linux");
mkdirSync(output, { recursive: true });
execFileSync(
  "source/node_modules/.bin/esbuild",
  [
    "linux/server.mjs",
    "--bundle",
    "--format=esm",
    "--platform=node",
    "--target=node24",
    "--outfile=" + output + "/server.mjs",
  ],
  { stdio: "inherit" },
);
for (const file of [
  "setup-owner.mjs",
  "app.cjs",
  "backup.mjs",
  "restore-backup.mjs",
  ".env.example",
  ".htaccess",
  "nginx.conf.example",
  "cafenetyar.service.example",
])
  copyFileSync("linux/" + file, output + "/" + file);
cpSync("drizzle", output + "/drizzle", { recursive: true });
const { BACKUP_TABLES } = await import("../native/backup.mjs");
writeFileSync(
  output + "/backup-format.mjs",
  "export const BACKUP_TABLES=" + JSON.stringify(BACKUP_TABLES) + ";\n",
);
writeFileSync(
  output + "/package.json",
  JSON.stringify(
    {
      name: "cafenetyar-linux",
      version: "4.0.0",
      private: true,
      type: "module",
      engines: { node: ">=24" },
      scripts: {
        start: "node --env-file-if-exists=.env server.mjs",
        "owner:create": "node --env-file-if-exists=.env setup-owner.mjs",
        backup: "node --env-file-if-exists=.env backup.mjs",
        restore: "node --env-file-if-exists=.env restore-backup.mjs",
      },
    },
    null,
    2,
  ) + "\n",
);
try {
  copyFileSync("docs/LINUX-HOSTING.md", output + "/README-fa.md");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
console.log("Independent Linux package ready:", output);
