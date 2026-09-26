# NLnet CodeSupply — proposal draft

**Status: DRAFT, not submitted.** Deadline found in research: **3 November 2026, 12:00 CET**. The
repository must be public before submitting. The field names follow NLnet's usual proposal form as
remembered, **not verified against the live form**: open https://nlnet.nl/propose/ and
https://nlnet.nl/codesupply/ and adapt. The owner sets the hourly rate and hours.

## Proposal name

Buyer Arena Evidence Protocol: portable, verifiable evidence for software security, supply-chain and
evaluation tools

## Website / wiki

`[public repository URL after launch]`

## Abstract

Software is increasingly written and changed by AI coding agents, and teams decide whether to merge
or release based on the output of many separate tools: secret scanners, dependency scanners, LLM
red-teaming, browser tests. Each tool speaks its own format, results are hard to compare between
runs, and nobody records what data left the machine during an evaluation.

Buyer Arena (Apache-2.0) already normalises the output of Gitleaks, Trivy, garak, Promptfoo, Nuclei
(import-only) and browser journeys into one versioned, append-only, content-addressed record format
(Evidence Protocol v1). Every run keeps a ledger of the hosts it contacted and the providers that
received data. It runs offline-first, with local models, and makes no paid API calls in its tests.

This project turns that working prototype into an open standard with a specification, JSON Schema,
conformance suite, hardened adapters with licence and SBOM evidence, signed evidence bundles, a
reusable privacy-ledger library and a documented method for evaluating AI coding agents. All
deliverables are Apache-2.0 and verifiable in the public repository.

## Relevant prior involvement

`[Owner: background in IT, cybersecurity and AI automation; built Buyer Arena 0.2.0 solo — 166
automated tests, CI on Linux and Windows, 14 integrations. Keep it factual.]`

## Requested amount and use of the budget

`[Owner to confirm amount within €5,000–€50,000 and the hourly rate.]` Illustrative structure:

| #   | Milestone (all public, Apache-2.0)                                                                | Hours | Verifiable result                                     |
| --- | ------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------- |
| 1   | Evidence Protocol 1.0 specification, JSON Schema, versioning policy                               | `[h]` | Spec document + schema + tagged release               |
| 2   | Conformance test suite and reference validator                                                    | `[h]` | CI-run suite; third parties can validate their output |
| 3   | Hardened adapters: Gitleaks, Trivy (with SBOM and licence evidence), garak, Promptfoo, Nuclei     | `[h]` | Adapters with upstream-shaped fixtures and docs       |
| 4   | Signed, content-addressed evidence bundles; cosign verification of scanner binaries               | `[h]` | `verify` command + documentation                      |
| 5   | "What left this machine" privacy ledger as a standalone library                                   | `[h]` | Published package + usage examples                    |
| 6   | Documented method for evaluating AI coding agents in isolated worktrees, with a public case study | `[h]` | Method document + raw evidence of one benchmark       |

No other funding has been received for this work. `[Update if that changes.]`

## Comparison with existing efforts

- **SARIF** standardises static-analysis results. Evidence Protocol covers runtime evidence too
  (browser journeys, LLM probes) and carries provenance, content hashes and the network ledger. A
  SARIF import/export is part of milestone 3. `[Verify the scope claim before submitting.]`
- **OpenTelemetry GenAI** covers traces of model calls, not verdicts or security findings. Buyer
  Arena imports OTel GenAI traces as one evidence source.
- **Promptfoo, garak, Gitleaks and Trivy** produce findings but do not normalise each other's output
  or compare runs. Buyer Arena consumes them rather than replacing them.

## Significant technical challenges

- Mapping heterogeneous severities and confidences into one model without losing the source's meaning.
- Reproducibility and signing of evidence produced by third-party binaries on arbitrary machines.
- Isolating agent-produced code during before/after evaluation without a hosted sandbox.
- Never storing secret values while keeping findings actionable.

## Ecosystem and engagement

Upstream contributions (fixtures and format notes) to the scanner projects, a public specification
repository open to comments, integration examples for GitHub Actions, and outreach to maintainers of
evaluation tools about the conformance suite.
