try {
  process.loadEnvFile(".env");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
import("./server.mjs")
  .then(({ environment, startServer }) => {
    const env = environment(),
      server = startServer(env);
    server.once("listening", () =>
      console.log("Cafenetyar listening on " + server.address().port),
    );
    const stop = () => server.close(() => process.exit(0));
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
