# Architecture

Technical architecture for pi-pai, based on [Claude Code In My Pocket](https://kendev.se/articles/raspberry-pi-claude-server).

## Overview

An Ansible playbook that deploys an autonomous Claude Code server on Raspberry Pi 4.

**Goal:** Run Claude Code with `--dangerously-skip-permissions` while maintaining security through Docker isolation. Users interact via SSH, mobile (happy-coder), or spawn sessions remotely via MCP.

## Repository Structure

```
pi-pai/
├── ansible.cfg              # Ansible settings (inventory path)
├── playbook.yml             # Main deployment playbook with tagged tasks
├── inventory/
│   ├── hosts.yml            # Pi host definition (uses vars from group_vars)
│   └── test.yml             # Local VM testing inventory
├── group_vars/all/
│   ├── vars.yml             # Configuration defaults
│   ├── vault.yml            # Secrets template (encrypt with ansible-vault)
│   └── zzz_local.yml        # Your overrides (create this, gitignored)
├── files/
│   ├── scripts/             # Static shell scripts (upgrade-claude.sh, etc.)
│   ├── systemd/             # Static systemd services
│   ├── configs/             # Static config files (tmux, ssh, settings)
│   ├── mcp-server/          # MCP server static files (package.json, start.sh)
│   └── docs/                # CLAUDE.md context files for each environment
├── templates/               # Jinja2 templates (variable substitution)
│   ├── Dockerfile.j2        # Docker image
│   ├── server.js.j2         # MCP server
│   ├── claude-sandbox.sh.j2 # Main sandbox script
│   ├── claude-attach.sh.j2  # tmux attach helper
│   └── claude-tmux.service.j2  # systemd service
├── molecule/default/        # Molecule test scenario (OrbStack)
├── scripts/                 # Development scripts (pre-commit, setup-hooks)
├── docs/                    # Project documentation
├── .github/workflows/       # GitHub Actions CI
├── .ansible-lint            # Ansible-lint configuration
└── Makefile                 # Common commands
```

## Architecture

### Three-Tier Isolation Model

```
┌─────────────────────────────────────────────────────────────────┐
│  Raspberry Pi 4 (Ubuntu 24 LTS Server)                          │
│                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────┐          │
│  │ Control Plane        │    │ Project Session      │          │
│  │ (Docker)             │    │ (Docker)             │          │
│  │                      │    │                      │          │
│  │ • ~/.claude-control- │    │ • ~/Repos mounted    │          │
│  │   plane/workspace    │    │ • SSH keys mounted   │          │
│  │ • NO repo access     │    │ • Full git access    │          │
│  │ • NO SSH keys        │    │ • --dangerously-skip │          │
│  │ • MCP tools only     │    │                      │          │
│  └──────────┬───────────┘    └──────────────────────┘          │
│             │                                                   │
│             │ HTTP (host.docker.internal:3100)                  │
│             ▼                                                   │
│  ┌──────────────────────┐                                      │
│  │ MCP Server (Host)    │                                      │
│  │ tmux-control-plane   │                                      │
│  │                      │                                      │
│  │ • spawn_session()    │──▶ tmux new-window + claude-sandbox  │
│  │ • list_sessions()    │                                      │
│  │ • kill_session()     │                                      │
│  │ • end_session()      │                                      │
│  └──────────────────────┘                                      │
│                                                                 │
│  ┌──────────────────────┐                                      │
│  │ tmux session: main   │                                      │
│  │                      │                                      │
│  │ window 1: ctrl       │ ◀── Control plane (systemd starts)   │
│  │ window 2: portfolio  │ ◀── Project session (MCP spawned)    │
│  │ window 3: research   │ ◀── Project session (MCP spawned)    │
│  └──────────────────────┘                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Why Docker Over Native Sandboxing?

Claude Code has built-in sandboxing (bubblewrap/seccomp) but:
1. **Known bugs** - Settings not reliably enforced, sandbox escapes without prompts
2. **Philosophical issue** - Agent shouldn't guard itself

Docker provides real OS-level isolation the agent cannot escape.

### SSH Key Isolation

**Critical design decision:** The host never touches git. SSH keys exist only inside Docker containers. When the control plane wants to clone a repo, it passes the URL as an instruction to a project session, which handles cloning internally.

## Key Design Decisions

### spawn_session API

The MCP server accepts a flexible API:

```javascript
spawn_session({ repo, instruction, window_name })
```

- `repo` only → "Clone {repo} and explore the codebase"
- `instruction` only → Just run the instruction
- Both → "Clone {repo}, then {instruction}"
- Neither → Blank session

Window names auto-generate from repo name or timestamp if not provided.

### .mcp.json Handling

- **Project sessions** use user-level MCPs added via `claude mcp add` (persisted in ~/.claude-docker)
- **Control plane** uses workspace-level `.mcp.json` at `~/.claude-control-plane/workspace/.mcp.json`
- Only the control plane needs the tmux-control-plane MCP configured

### tmux Targeting

**Bug fixed:** Use `tmux new-window -t main:` (trailing colon) to target the session, not `-t main` which targets a window named "main".

**Bug fixed:** Quote window names in kill commands: `tmux kill-window -t "main:${target}"` to handle names with spaces.

## Current State

**Completed:**
- All scripts extracted from article
- All configs extracted
- Systemd services (user scope, with lingering enabled)
- MCP server with spawn/list/kill/end tools
- Main playbook with tagged tasks (idempotent)
- Templates for variable substitution
- README with usage instructions
- Tailscale auto-setup with authkey
- SSH key generation and GitHub upload via API
- OAuth token deployment from local machine
- GitHub Actions CI (lint, secrets scan, syntax check)
- Molecule testing with OrbStack
- Tested on Raspberry Pi 4

**Manual post-deploy:**
- GitHub MCP setup (one-time `claude mcp add` command)

## Key Files

| File | Purpose |
|------|---------|
| `playbook.yml` | Main entry point - all tasks with tags |
| `group_vars/all/vars.yml` | Default configuration (don't edit - use zzz_local.yml) |
| `group_vars/all/zzz_local.yml` | **Create this** - Your Pi host, username overrides |
| `group_vars/all/vault.yml` | **Encrypt** - GitHub PAT, Tailscale authkey, Context7 token |
| `templates/claude-sandbox.sh.j2` | Main launcher - routes to control plane or project session |
| `templates/server.js.j2` | MCP server template (uses vars for port/token/session name) |
| `templates/claude-tmux.service.j2` | Starts tmux + control plane on boot |
| `files/systemd/tmux-control-plane.service` | Starts MCP server on boot |

## Running the Playbook

```bash
# Prerequisites on Mac
brew install ansible
npm install -g @anthropic-ai/claude-code happy-coder

# Setup and authenticate
make setup        # Install git hooks
make auth         # Complete OAuth flows
make copy-tokens  # Export to .tokens/

# Encrypt vault (required)
ansible-vault encrypt group_vars/all/vault.yml

# Full deployment
make deploy       # Or: ansible-playbook playbook.yml --ask-vault-pass --ask-become-pass

# Specific tags
ansible-playbook playbook.yml --ask-vault-pass --ask-become-pass --tags docker
ansible-playbook playbook.yml --ask-vault-pass --ask-become-pass --tags mcp
```

## Post-Deployment Manual Steps

OAuth tokens are now copied automatically during deployment (from `.tokens/` on your local machine).

1. **SSH keys for git:** (automated if `vault_github_pat` has `admin:public_key` scope)

   If automated setup failed or you need to add manually:
   ```bash
   cat ~/.claude-docker/.ssh/id_ed25519.pub
   # Add to https://github.com/settings/keys
   ```

2. **Add GitHub MCP (from within Claude session):**
   ```bash
   # Press ! for bash shell
   claude mcp add github \
     --transport http \
     --url https://api.githubcopilot.com/mcp/ \
     --header "Authorization: Bearer \${GITHUB_PAT}"
   # exit back to Claude, /mcp to verify
   ```

3. **Install tmux plugins:**
   ```bash
   # Attach to tmux, then Ctrl-b I to install
   ```

## Common Pitfalls

1. **Docker group not applied** - Reboot after adding user to docker group (playbook handles this but won't take effect until reboot)

2. **nvm not in PATH** - The MCP server uses `start.sh` wrapper that sources nvm

3. **Systemd user services** - Require `loginctl enable-linger` to start at boot (playbook handles this)

4. **tmux attach vs new-session** - We use `attach-session` in SSH config so systemd is the sole session creator

5. **EXDEV errors** - Claude Code plugin installs fail if /tmp is different filesystem. We set `TMPDIR=/home/node/.claude/tmp`

## Testing

Manual verification after deployment:

```bash
# On Pi
systemctl --user status claude-tmux
systemctl --user status tmux-control-plane
curl -s http://localhost:3100/health  # Should return {"status":"ok"}
tmux ls                                # Should show "main" session

# Test MCP from control plane
# Ask Claude: "List my tmux sessions"
# Ask Claude: "Spawn a session to research WebSocket patterns"
```

## Related

- **Source article:** [Claude Code In My Pocket](https://kendev.se/articles/raspberry-pi-claude-server)
- **This repo:** [KenDev-AB/pi-pai](https://github.com/KenDev-AB/pi-pai)
- **happy-coder:** https://happy.engineering (mobile access)
- **Claude Code docs:** https://docs.anthropic.com/en/docs/claude-code
