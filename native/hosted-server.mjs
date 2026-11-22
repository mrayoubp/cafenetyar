import app from "./composed-server.mjs";
import payload from "./installer-package.generated.mjs";
import { installerDownload, installerPage } from "./installer-download.mjs";
export default {
  fetch(request, env, ctx) {
    if (new URL(request.url).pathname === "/downloads/installer")
      return installerPage(request, env, payload);
    if (
      new URL(request.url).pathname === "/downloads/cafenetyar-linux-4.0.0.zip"
    )
      return installerDownload(request, env, payload);
    return app.fetch(request, env, ctx);
  },
};
