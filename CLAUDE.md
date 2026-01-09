# CLAUDE.md

Project context for Claude Code sessions.

## Project Overview

Ansible playbook deploying an autonomous Claude Code server on Raspberry Pi 4. Based on [Claude Code In My Pocket](https://kendev.se/articles/raspberry-pi-claude-server).

## Quick Commands

```bash
make lint        # Syntax check + handler verification + secrets scan
make test        # Deploy to OrbStack VM (requires vault + tokens)
make deploy      # Deploy to Pi (requires vault + tokens, prompts for sudo)
make auth        # OAuth flow for claude + happy
make copy-tokens # Export tokens for deployment
```

## Key Requirements

### Ansible

- **Idempotency**: All tasks must be idempotent. Use `when:` guards with checks before shell/command tasks.
- **Secrets**: Use `no_log: true` AND `diff: false` for any task handling secrets.
- **Tags**: All tasks should have appropriate tags for selective runs.

### OAuth Tokens

- macOS stores Claude credentials in **Keychain**, not files
- `make copy-tokens` exports from Keychain to `.tokens/.claude/.credentials.json`
- Pi runs Linux and needs the file-based credentials
- Flow: `make auth` → `make copy-tokens` → `make deploy`

### Testing

- Use `make test` for OrbStack VM testing (requires encrypted vault + tokens)
- Use `make test-full` for full Molecule lifecycle
- Verify with `make verify` after converge
- CI runs on every PR via GitHub Actions (lint, secrets scan, syntax check)

## Architecture

```
┌─────────────────────────────────────────┐
│  Pi (Ubuntu 24 LTS)                     │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ Control     │  │ Project     │      │
│  │ Plane       │  │ Session     │      │
│  │ (Docker)    │  │ (Docker)    │      │
│  │ - No repos  │  │ - ~/Repos   │      │
│  │ - No SSH    │  │ - SSH keys  │      │
│  │ - MCP tools │  │ - Git access│      │
│  └──────┬──────┘  └─────────────┘      │
│         │ HTTP localhost:3100           │
│         ▼                               │
│  ┌─────────────┐                       │
│  │ MCP Server  │ spawn/list/kill/restart│
│  └─────────────┘                       │
│         │                               │
│         ▼                               │
│  ┌─────────────┐                       │
│  │ tmux: main  │ windows per session   │
│  └─────────────┘                       │
└─────────────────────────────────────────┘
```

## File Organization

- `templates/` - Jinja2 templates (use variables from group_vars)
- `files/` - Static files copied as-is
- `group_vars/all/vars.yml` - Configuration defaults
- `group_vars/all/vault.yml` - Secrets (encrypt with ansible-vault)
- `group_vars/all/zzz_local.yml` - Your overrides (create this, gitignored)

## Common Pitfalls

1. **Docker group**: Requires reboot after first deploy
2. **nvm in PATH**: MCP server uses `start.sh` wrapper that sources nvm
3. **tmux targeting**: Use `-t main:` (trailing colon) for session, not `-t main`
4. **EXDEV errors**: Plugin installs fail if /tmp is different filesystem

## Code Style

- No meta-commentary about development process in code or commits
- Keep solutions simple and focused
- Prefer editing existing files over creating new ones

## Related Docs

- [AGENTS.md](AGENTS.md) - Agent onboarding and session workflow
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture details
