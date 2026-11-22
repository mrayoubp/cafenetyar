import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const archive = readFileSync("dist/releases/cafenetyar-linux-4.0.0.zip");
writeFileSync(
  "native/installer-package.generated.mjs",
  "export default " +
    JSON.stringify({
      base64: archive.toString("base64"),
      sha256: createHash("sha256").update(archive).digest("hex"),
    }) +
    ";\n",
);
execFileSync(
  "source/node_modules/.bin/esbuild",
  [
    "native/hosted-server.mjs",
    "--bundle",
    "--format=esm",
    "--platform=browser",
    "--target=es2022",
    "--outfile=dist/server/index.js",
  ],
  { stdio: "inherit" },
);
console.log(
  "Hosted installer packaged:",
  archive.length,
  "bytes; independent Linux server excludes the hosted download payload.",
);
