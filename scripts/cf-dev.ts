const environment = { ...process.env };

if (!environment.NODE_EXTRA_CA_CERTS) {
  const systemBundles = [
    "/etc/ssl/certs/ca-certificates.crt",
    "/etc/ssl/certs/ca-bundle.crt",
    "/etc/pki/tls/certs/ca-bundle.crt",
  ];
  for (const path of systemBundles) {
    if (await Bun.file(path).exists()) {
      environment.NODE_EXTRA_CA_CERTS = path;
      break;
    }
  }
}

const wrangler = Bun.spawn(["bunx", "wrangler", "dev", ...Bun.argv.slice(2)], {
  env: environment,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

process.exitCode = await wrangler.exited;
