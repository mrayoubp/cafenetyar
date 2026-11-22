import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { createHash } from "node:crypto";
const root = process.cwd(),
  dir = resolve(root, "dist/linux"),
  out = resolve(root, "dist/releases");
mkdirSync(out, { recursive: true });
const files = [
  "server.mjs",
  "setup-owner.mjs",
  "app.cjs",
  "backup.mjs",
  "restore-backup.mjs",
  "backup-format.mjs",
  "package.json",
  "README-fa.md",
  ".env.example",
  ".htaccess",
  "nginx.conf.example",
  "cafenetyar.service.example",
  "drizzle",
];
for (const file of files)
  if (!existsSync(resolve(dir, file)))
    throw new Error("Missing release file: " + file + "; run npm run build.");
if (
  /convex\.cloud|convex\.site|@convex-dev\/auth|convex\/react/.test(
    readFileSync(resolve(dir, "server.mjs"), "utf8"),
  )
)
  throw new Error("External backend dependency remains in Linux runtime.");
const archive = resolve(out, "cafenetyar-linux-4.0.0.zip");
rmSync(archive, { force: true });
execFileSync("zip", ["-qr", archive, ...files], { cwd: dir });
const sum = createHash("sha256").update(readFileSync(archive)).digest("hex");
writeFileSync(archive + ".sha256", sum + "  cafenetyar-linux-4.0.0.zip\n");
console.log(archive);
