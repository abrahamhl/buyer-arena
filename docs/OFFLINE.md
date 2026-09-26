# Offline first

Buyer Arena is useful with no paid API and no network. Offline is a **global network policy**,
enforced in one place ([`src/policy/network.ts`](../src/policy/network.ts)) and recorded in
every artifact.

## Modes

| Mode      | Allowed                                                                                                                                                                                                                                                                                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `offline` | loopback only (localhost, 127.0.0.0/8, ::1). Local models, localhost targets, local repositories, cached catalogs, reports, deterministic buyers, local browser, local security tools that need no network. **Refused:** cloud models, public URLs, remote metadata refresh, package registries, adapter network access, and any paid provider even behind a loopback proxy |
| `local`   | loopback + private network: 10/8, 172.16/12, 192.168/16, 169.254/16, 100.64/10, fc00::/7, fe80::/10, and names in `BUYER_ARENA_PRIVATE_HOSTS`                                                                                                                                                                                                                               |
| `hybrid`  | `local` + public hosts **only** for model calls to the providers you select (`--allow-provider anthropic openrouter`) and for catalog metadata                                                                                                                                                                                                                              |
| `online`  | any host, within each feature's own safety rules                                                                                                                                                                                                                                                                                                                            |

Hosts are classified **without DNS** (resolving would itself be network access, and a public name
can resolve anywhere): names are public unless they are `localhost`/`*.localhost` or declared
private.

## Choosing a mode

`--network <mode>` > `BUYER_ARENA_OFFLINE=1` > `BUYER_ARENA_NETWORK` > `buyer-arena.yaml`
(`network: { mode, allow_providers }`) > default. An explicit choice is **strict**. The default
is `local`, non-strict: it widens only for a target you named on that command (a public URL, a
cloud `--buyer`), prints `▲ network ONLINE: browser → shop.example (explicitly requested…)`, and
records the escalation. Nothing escalates implicitly: redirects, npm audit and adapters cannot.

## What every run records

`session.json › network`, launch reports and `agent-eval.json` carry:
`policy`, `effective_mode`, `escalations`, `hosts` (class, purposes, count), `providers`
(provider, model, host, local/cloud/delegated, calls, kinds of data sent — never the data),
`adapters`, `denied`, and `stayed_local`. The terminal prints one line, e.g.
`network LOCAL · nothing left this machine`.

## A completely offline run with a local model

```bash
ollama pull llama3.1                                   # once, while online
buyer-arena --network offline doctor --models          # ollama reachable on 127.0.0.1
buyer-arena --network offline demo-store --variant candidate --port 4001 &
buyer-arena --network offline run --url http://127.0.0.1:4001 \
  --success-text "trial is active" --buyer ollama:llama3.1 --size 5
```

The deterministic default needs no model at all: `buyer-arena --network offline demo`.

## Limits of the guarantee

- Sidecar engines (Browser Use, Stagehand) and external tools run in their own processes; Buyer
  Arena cannot firewall them. Under `offline` a sidecar only starts when you assert
  `BUYER_ARENA_ENGINE_OFFLINE_SAFE=1` (e.g. Browser Use with Ollama). Trivy under `offline`/`local`
  runs with its offline flags and a cached database.
- Use an OS-level firewall or a network namespace when you need a hard boundary.
