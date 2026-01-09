# Pi-Pai

[![Ansible Lint](https://github.com/KenDev-AB/pi-pai/actions/workflows/lint.yml/badge.svg)](https://github.com/KenDev-AB/pi-pai/actions/workflows/lint.yml)

> **Alpha** - This project has been tested on Raspberry Pi 4 but is still under active development. Contributions welcome!

Ansible playbook for deploying an autonomous Claude Code server on Raspberry Pi 4.

Based on [Claude Code In My Pocket](https://kendev.se/articles/raspberry-pi-claude-server).

## What This Deploys

- **Docker-sandboxed Claude Code** with `--dangerously-skip-permissions`
- **tmux session management** with auto-start via systemd
- **MCP control plane** for spawning and managing sessions
- **SSH key isolation** (keys stay inside Docker containers)
- **happy-coder integration** for mobile access

## Pi Setup

Before running Ansible, you need a Pi with Ubuntu installed. See the [full guide](https://kendev.se/articles/raspberry-pi-claude-server) for details.

**Quick version:**

1. **Flash Ubuntu Server 24.04 LTS** using [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
   - Choose "Other general-purpose OS" → "Ubuntu" → "Ubuntu Server 24.04 LTS (64-bit)"
   - Click "Edit Settings" (or gear icon) to pre-configure:
     - Hostname (e.g., `claude-pi`)
     - Username and password
     - WiFi credentials
     - Enable SSH with your public key

2. **Boot the Pi** and find its IP:
   ```bash
   ping claude-pi.local
   # or check your router's DHCP leases
   ```

3. **Verify SSH access:**
   ```bash
   ssh your-username@claude-pi.local
   ```

## Prerequisites

**On your local machine:**
```bash
# macOS
brew install ansible

# Linux (Debian/Ubuntu)
sudo apt install ansible
```

**For OAuth token setup** (step 5 below) - requires [Node.js](https://nodejs.org/):
```bash
npm install -g @anthropic-ai/claude-code
npm install -g happy-coder
```

**On your Pi:**
- Ubuntu 24 LTS Server (see Pi Setup above)
- SSH access configured

## Quick Start

1. **Clone this repo:**
   ```bash
   git clone https://github.com/KenDev-AB/pi-pai.git
   cd pi-pai
   ```

2. **Set up dev environment:**
   ```bash
   make setup
   ```

3. **Configure your Pi connection** by creating `group_vars/all/zzz_local.yml`:
   ```yaml
   # Local overrides (gitignored)
   pi_host: "claude-pi.local"  # or Tailscale IP like "100.x.x.x"
   pi_user: "your-username"    # the user you created in Pi Imager
   ```

4. **Configure and encrypt secrets:**
   ```bash
   # Edit group_vars/all/vault.yml with your tokens:
   nano group_vars/all/vault.yml
   ```

   Available secrets (all optional - leave placeholders if not using):
   - `vault_github_pat`: Auto-uploads SSH keys to GitHub (requires `admin:public_key` scope)
   - `vault_tailscale_authkey`: Auto-joins Tailscale network
   - `vault_mcp_bearer_token`: Secures the MCP server (generate with `openssl rand -hex 32`)
   - `vault_context7_token`: Context7 API token for documentation lookups

   ```bash
   # Encrypt the file (required - you'll choose a password):
   ansible-vault encrypt group_vars/all/vault.yml
   ```

   > **Note:** Encryption is required before deploy. The tokens inside are optional -
   > leave placeholders if you prefer to configure GitHub SSH keys and Tailscale manually.

5. **Authenticate locally** (required - tokens are copied to Pi during deploy):
   ```bash
   make auth         # Runs claude then happy - complete both OAuth flows
   make copy-tokens  # Copies tokens to .tokens/ for deployment
   ```

   > **Note:** Without valid OAuth tokens, the Claude Code service won't function.

6. **Run the playbook:**
   ```bash
   make deploy
   ```

## Directory Structure

```
pi-pai/
├── ansible.cfg              # Ansible configuration
├── playbook.yml             # Main deployment playbook
├── inventory/
│   ├── hosts.yml            # Pi host definition (uses vars from group_vars)
│   └── test.yml             # Local VM testing inventory
├── group_vars/all/
│   ├── vars.yml             # Default configuration (template)
│   ├── vault.yml            # Secrets template (encrypt after editing)
│   └── zzz_local.yml        # Your overrides (create this, gitignored)
├── files/
│   ├── scripts/             # Static shell scripts
│   ├── systemd/             # Static systemd services
│   ├── configs/             # settings.json, ssh_config, tmux.conf
│   ├── mcp-server/          # package.json, start.sh
│   └── docs/                # CLAUDE.md context files
├── templates/               # Jinja2 templates (use vars from group_vars)
│   ├── Dockerfile.j2        # Docker image
│   ├── server.js.j2         # MCP server
│   ├── mcp.json.j2          # MCP config
│   ├── claude-sandbox.sh.j2 # Main sandbox script
│   ├── claude-attach.sh.j2  # tmux attach helper
│   ├── claude-tmux.service.j2  # systemd service
│   └── bashrc_greeting.j2   # Login greeting
├── scripts/
│   ├── setup-hooks.sh       # Git hooks installer
│   ├── pre-commit           # Pre-commit hook (secrets + syntax check)
│   └── verify-handlers.sh   # Verify all notify handlers are defined
├── docs/
│   └── TESTING.md           # Local VM testing guide
├── molecule/default/        # Molecule test scenario (OrbStack)
│   ├── molecule.yml         # Test configuration
│   ├── create.yml           # VM creation
│   ├── destroy.yml          # VM cleanup
│   └── verify.yml           # Verification + restart tests
├── .tokens/                 # OAuth tokens (created by make copy-tokens, gitignored)
├── .github/workflows/       # GitHub Actions CI (lint, secrets scan, syntax check)
├── .ansible-lint            # Ansible-lint configuration
├── Makefile                 # Common commands
├── requirements.txt         # Python deps (molecule)
├── .gitleaks.toml           # Secrets scanner config
├── AGENTS.md                # Agent onboarding and session workflow
├── CLAUDE.md                # Context for Claude Code sessions
└── ARCHITECTURE.md          # Technical architecture details
```

## Make Targets

```bash
make setup      # Install git hooks + molecule
make lint       # Syntax check + handler verification + secrets scan
make deploy     # Deploy to Pi (requires vault encryption + tokens)
make test       # Deploy to OrbStack test VM (requires vault encryption + tokens)
make clean      # Delete test VM

# Molecule (full test lifecycle)
make test-full  # create → converge → verify → destroy
make create     # Create VM only
make converge   # Run playbook on existing VM
make verify     # Run verification checks
make destroy    # Destroy VM

# OAuth tokens (required - deploy will fail without these)
make auth         # Authenticate claude then happy locally
make copy-tokens  # Copy tokens to .tokens/ for deployment
```

## Available Tags

Run specific parts of the playbook:

```bash
# Example: run only Docker tasks
ansible-playbook playbook.yml --ask-vault-pass --ask-become-pass --tags docker
```

| Tag | Description |
|-----|-------------|
| `packages` | System packages (git, tmux, etc.) |
| `performance` | CPU governor and swap settings |
| `tailscale` | Tailscale VPN setup |
| `docker` | Docker install and image build |
| `nodejs` | Node.js, nvm, and pnpm |
| `directories` | Create required directories |
| `configs` | Config files (tmux, SSH, settings.json) |
| `tokens` | OAuth token deployment |
| `ssh-key` | Generate and upload SSH keys |
| `scripts` | Shell scripts (claude-sandbox.sh, etc.) |
| `docs` | CLAUDE.md context files |
| `mcp` | MCP server setup |
| `secrets` | Deploy secrets to Pi |
| `systemd` | Systemd service setup |
| `tmux` | tmux plugins |
| `shell` | Shell config (bashrc greeting) |
| `host-claude` | Claude Code on host (not in Docker) |
| `cleanup` | Remove old files (skipped by default, must explicitly specify) |

## Usage

**Connect to Claude on your Pi:**
```bash
ssh your-username@claude-pi.local
~/claude-attach.sh  # Attach to the tmux session
```

**From mobile (via happy-coder):**
Your Pi appears in the happy-coder app if tokens were configured. See [happy-coder docs](https://happy.engineering).

**Keyboard shortcuts in tmux:**
- `Ctrl-b d` - Detach (leave session running)
- `Ctrl-b 1/2/3` - Switch windows
- `Ctrl-b c` - New window

## Post-Deployment

After a successful deploy, these optional steps may enhance your setup:

**1. SSH keys for git** (automated if `vault_github_pat` has `admin:public_key` scope)

If you need to add manually (run on Pi):
```bash
cat ~/.claude-docker/.ssh/id_ed25519.pub
# Add to https://github.com/settings/keys
```

**2. Add GitHub MCP** (from within a Claude session on Pi):
```bash
# Press ! for bash, then:
claude mcp add github \
  --transport http \
  --url https://api.githubcopilot.com/mcp/ \
  --header "Authorization: Bearer \${GITHUB_PAT}"
```

**3. Install tmux plugins** (on Pi):
```bash
# Attach to tmux, then press Ctrl-b I
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Raspberry Pi                                               │
│                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │ Control Plane   │    │ Project Session │                │
│  │ (Docker)        │    │ (Docker)        │                │
│  │                 │    │                 │                │
│  │ - No repo access│    │ - Full ~/Repos  │                │
│  │ - No SSH keys   │    │ - SSH keys      │                │
│  │ - MCP tools     │    │ - Git access    │                │
│  └────────┬────────┘    └─────────────────┘                │
│           │                                                 │
│           │ HTTP                                            │
│           ▼                                                 │
│  ┌─────────────────┐                                       │
│  │ MCP Server      │                                       │
│  │ (localhost:3100)│                                       │
│  │                 │                                       │
│  │ spawn_session() │                                       │
│  │ list_sessions() │                                       │
│  │ kill_session()  │                                       │
│  │ end_session()   │                                       │
│  │ restart_self()  │                                       │
│  └─────────────────┘                                       │
│                                                             │
│  ┌─────────────────────┐                                   │
│  │ tmux session        │                                   │
│  │ (main)              │                                   │
│  │                     │                                   │
│  │ window 1: ctrl      │                                   │
│  │ window 2: portfolio │                                   │
│  │ window 3: research  │                                   │
│  └─────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
```

## Updating

**Update Claude Code:**
```bash
make deploy  # Or with tags:
ansible-playbook playbook.yml --ask-vault-pass --ask-become-pass --tags docker
# Or on the Pi directly:
~/upgrade-claude.sh
```

**Update MCP server:**
```bash
ansible-playbook playbook.yml --ask-vault-pass --ask-become-pass --tags mcp
# Service restarts automatically via handlers if files changed
```

## Troubleshooting

**"vault.yml is not encrypted" error:**
```bash
ansible-vault encrypt group_vars/all/vault.yml
```

**"OAuth tokens not found" error:**
```bash
make auth         # Complete OAuth flows
make copy-tokens  # Copy to .tokens/
```

**Check service status** (run on Pi):
```bash
systemctl --user status claude-tmux
systemctl --user status tmux-control-plane
journalctl --user -u claude-tmux -f
```

**MCP server logs** (run on Pi):
```bash
journalctl --user -u tmux-control-plane -f
```

**Test MCP endpoint** (run on Pi):
```bash
curl -s http://localhost:3100/health
```

**Service keeps restarting** (run on Pi):
```bash
# Check if OAuth tokens are valid
ls -la ~/.claude-docker/.credentials.json
```
If tokens are missing, re-copy from your local machine:
```bash
make copy-tokens
ansible-playbook playbook.yml --ask-vault-pass --ask-become-pass --tags tokens
```

## Testing

See [docs/TESTING.md](docs/TESTING.md) for local VM testing with OrbStack.

## Related

- [Source article](https://kendev.se/articles/raspberry-pi-claude-server) - Full guide this playbook is based on
- [Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code)
- [happy-coder](https://happy.engineering) - Mobile access to Claude Code
