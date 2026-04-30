import app from "./app.js";

const port = Number(process.env.PORT ?? 8082);

app.listen(port, () => {
  console.log(`[license-server] Listening on port ${port}`);
  console.log(`[license-server] Admin token: ${process.env.ADMIN_TOKEN ?? "changeme (set ADMIN_TOKEN env var)"}`);
});
