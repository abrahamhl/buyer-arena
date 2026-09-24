# Security policy

## Reporting

Please report vulnerabilities **privately** through GitHub Security Advisories ("Report a
vulnerability" on the repository's Security tab). Do not open a public issue. We aim to reply
within 5 working days.

## Threat model and built-in controls

| Risk                                        | Control                                                                                                                                                                                                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leaked API keys                             | Keys are read only from the environment, never from flags or config files. They are never written to run records and are redacted from provider errors (`redact()`). CI runs a secret scan (`npm run secrets:scan`).                          |
| Unbounded LLM spend                         | A hard `--budget` is checked _before_ every call against its worst-case cost, alongside `--max-buyers`, `--max-steps`, `--max-parallel` and `--timeout`. Tests run offline, and paid providers are refused.                                   |
| Automation of third-party sites             | Buyers only load the origin the user supplied. Other origins are blocked at the network layer and recorded. There is no crawling. MCP tools accept localhost targets only, unless `BUYER_ARENA_ALLOW_REMOTE=1`.                               |
| Prompt injection from pages into LLM buyers | Page text reaches the model as data inside a fixed JSON action schema. Actions must reference elements that exist on the page. Card fields accept only a test number printed by the site, and passwords are synthetic and masked in evidence. |
| Personal data                               | Personas are synthetic. Calibration accepts aggregates only; the schema is strict and requires a minimum group size of 10.                                                                                                                    |
| Remote exposure                             | The demo store binds to `127.0.0.1`. The MCP server uses stdio only, with no network listener.                                                                                                                                                |

## Handling evidence

Run records, screenshots and traces contain whatever the target pages show. If you test staging
environments that hold sensitive data, treat `.buyer-arena/` as sensitive. It is ignored by git
by default.
