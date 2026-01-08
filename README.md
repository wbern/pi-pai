# Pi-Pai

> **Pre-Alpha** - This project is under active development and not yet tested on real hardware. Use at your own risk. Contributions welcome!

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
   - Click the gear icon to pre-configure:
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

4. **Update inventory** with your Pi's hostname/IP (see Quick Start below)

## Prerequisites

**On your Mac:**
```bash
# Install Ansible
brew install ansible

# Create vault password file
echo "your-secure-password" > ~/.vault_pass
chmod 600 ~/.vault_pass

# Or use --ask-vault-pass when running playbooks
```

**On your Pi:**
- Ubuntu 24 LTS Server (see Pi Setup above)
- SSH access configured
- Tailscale installed (optional - playbook can install it)

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

3. **Configure your Pi connection** in `group_vars/all/vars.yml`:
   ```yaml
   pi_host: "claude-pi.local"  # or Tailscale IP like "100.x.x.x"
   pi_user: "your-username"    # the user you created in Pi Imager
   ```

4. **Configure secrets:**
   ```bash
   # Edit group_vars/all/vault.yml with your tokens
   # Then encrypt it:
   ansible-vault encrypt group_vars/all/vault.yml
   ```

5. **Authenticate locally** (tokens are copied to Pi during deploy):
   ```bash
   make auth         # Runs claude then happy - complete both OAuth flows
   make copy-tokens  # Copies tokens to .tokens/ for deployment
   ```

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
│   ├── vars.yml             # Configuration variables (pi_host, pi_user, etc.)
│   └── vault.yml            # Encrypted secrets (GitHub PAT, Tailscale key)
├── files/
│   ├── scripts/             # Static shell scripts
│   ├── systemd/             # Static systemd services
│   ├── configs/             # settings.json, ssh_config
│   ├── mcp-server/          # package.json, start.sh
│   └── docs/                # CLAUDE.md context files
├── templates/               # Jinja2 templates (use vars from group_vars)
│   ├── server.js.j2         # MCP server
│   ├── Dockerfile.j2        # Docker image
│   ├── mcp.json.j2          # MCP config
│   ├── claude-sandbox.sh.j2 # Main sandbox script
│   ├── claude-attach.sh.j2  # tmux attach helper
│   └── claude-tmux.service.j2  # systemd service
├── scripts/
│   ├── setup-hooks.sh       # Git hooks installer
│   └── pre-commit           # Pre-commit hook (secrets + lint + vault check)
├── docs/
│   └── TESTING.md           # Local VM testing guide
├── molecule/default/        # Molecule test scenario (OrbStack)
│   ├── molecule.yml         # Test configuration
│   ├── create.yml           # VM creation + token copy
│   ├── destroy.yml          # VM cleanup
│   └── verify.yml           # Verification checks
├── .tokens/                 # OAuth tokens for testing (gitignored)
├── Makefile                 # Common commands
├── requirements.txt         # Python deps (molecule)
└── .gitleaks.toml           # Secrets scanner config
```

## Make Targets

```bash
make setup      # Install git hooks + gitleaks + molecule
make lint       # Run ansible-lint + syntax check + secrets scan
make deploy     # Deploy to Pi (prompts for vault password)
make test       # Deploy to OrbStack test VM (quick)
make clean      # Delete test VM

# Molecule (full test lifecycle)
make test-full  # create → converge → verify → destroy
make create     # Create VM only
make converge   # Run playbook on existing VM
make verify     # Run verification checks
make destroy    # Destroy VM

# OAuth tokens (required before deploy)
make auth         # Authenticate claude then happy locally
make copy-tokens  # Copy tokens to .tokens/ for deployment
```

## Available Tags

Run specific parts of the playbook:

```bash
ansible-playbook playbook.yml --tags scripts    # Deploy shell scripts
ansible-playbook playbook.yml --tags docker     # Rebuild Docker image
ansible-playbook playbook.yml --tags mcp        # Update MCP server
ansible-playbook playbook.yml --tags systemd    # Update systemd services
ansible-playbook playbook.yml --tags tailscale  # Install/auth Tailscale
ansible-playbook playbook.yml --tags ssh-key    # Generate SSH key + upload to GitHub
```

## Post-Deployment

OAuth tokens are copied automatically during deploy. These optional steps may still be needed:

**1. SSH keys for git** (automated if `vault_github_pat` has `admin:public_key` scope)

If you need to add manually:
```bash
cat ~/.claude-docker/.ssh/id_ed25519.pub
# Add to https://github.com/settings/keys
```

**2. Add GitHub MCP (from within Claude session):**
```bash
# Press ! for bash, then:
claude mcp add -t http github https://api.githubcopilot.com/mcp \
  -H "Authorization: Bearer \${GITHUB_PAT}"
```

**3. Install tmux plugins:**
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
│  │ (host:3100)     │                                       │
│  │                 │                                       │
│  │ spawn_session() │                                       │
│  │ list_sessions() │                                       │
│  │ kill_session()  │                                       │
│  └─────────────────┘                                       │
│                                                             │
│  ┌─────────────────┐                                       │
│  │ tmux session    │                                       │
│  │ (main)          │                                       │
│  │                 │                                       │
│  │ window 1: ctrl  │                                       │
│  │ window 2: repo1 │                                       │
│  │ window 3: repo2 │                                       │
│  └─────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
```

## Updating

**Update Claude Code:**
```bash
ansible-playbook playbook.yml --tags docker
# Or on the Pi directly:
~/upgrade-claude.sh
```

**Update MCP server:**
```bash
ansible-playbook playbook.yml --tags mcp
ssh claude-shell 'systemctl --user restart tmux-control-plane'
```

## Troubleshooting

**Check service status:**
```bash
ssh claude-shell
systemctl --user status claude-tmux
systemctl --user status tmux-control-plane
journalctl --user -u claude-tmux -f
```

**MCP server logs:**
```bash
journalctl --user -u tmux-control-plane -f
```

**Test MCP endpoint:**
```bash
curl -s http://localhost:3100/health
```

## Testing

See [docs/TESTING.md](docs/TESTING.md) for local VM testing with OrbStack.

## Related

- [Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code)
- [happy-coder](https://happy.engineering) - Mobile access to Claude Code
