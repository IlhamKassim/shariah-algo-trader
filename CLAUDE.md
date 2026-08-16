## Agent skills

### Issue tracker

Issues live in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Development & Contribution Workflow

- Refer to `CONTRIBUTING.md` for full contribution guidelines.
- **Branching**: `main` is production. Always develop on feature/fix branches (`feature/*`, `fix/*`).
- **Tests**: Always run and verify `uv run pytest` before committing or merging.
- **Safety**: Never hardcode or commit secrets/API keys. Use paper trading credentials for development.
- **Compliance**: Adhere strictly to Shariah-compliant constraints (long-only spot positions, no leverage/margin/options/shorting, strictly within ETF Eligible Universe).

