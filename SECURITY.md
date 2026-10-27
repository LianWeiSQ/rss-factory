# Security policy

CSS Factory is a customized distribution of MrRSS. Security fixes are maintained on the current branch; this repository does not promise a separate commercial support service or fixed response SLA.

## Report a concern

Use private vulnerability reporting from this repository's [Security tab](https://github.com/LianWeiSQ/rss-factory/security) if enabled. If a private channel is not available, open an [issue](https://github.com/LianWeiSQ/rss-factory/issues) requesting a reporting contact **without publishing exploit details, personal data or credentials**. Reports about this distribution should not be sent to an upstream contributor's personal email address.

Include the commit/version, platform, affected operation, redacted reproduction steps and expected impact. Never attach a real database, API key, IMAP password, sync credentials or unredacted settings response.

## Current trust boundaries

- Desktop builds provide a loopback API while the app runs. Loopback access is a machine boundary, not a per-user account system.
- Server mode serves the reader and API, and has **no built-in user login**. Bind to `127.0.0.1` or protect the entire page and API with an authenticated gateway. HTTPS alone does not authenticate a caller.
- Article HTML is untrusted and must pass the application's content preparation and sanitization path. Do not bypass this path when changing presentation.
- Custom feed scripts execute under the application user's OS permissions. Working directories and timeouts do not make them a complete sandbox.
- Translation, AI, synchronization and article export send data to the services the user configures. Feed fetching, optional remote advertisement configuration and the website's external resources also involve network requests; local storage is not a promise of zero network traffic.
- Saved credentials use the existing machine-bound encrypted format for compatibility. Copying a database to another machine may require re-entering credentials. A compromised running application or OS account can still access secrets it is allowed to use.

## Maintenance and deployment

Use a low-privilege service account, restrict filesystem access, keep dependencies current, and maintain verified backups separate from the working data. Do not run two application instances or versions against the same library during migration. Keep personal data and built artifacts out of Git.

See [server mode](docs/SERVER_MODE/README.md), [data directories](docs/DATA_DIRECTORY.md) and [project conventions](AGENTS.md) for the actual deployment and development boundaries.
