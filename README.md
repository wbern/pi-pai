# Pi Infrastructure

Ansible playbook for deploying a Claude Code server on Raspberry Pi.

## What This Deploys

- **Docker-sandboxed Claude Code** with `--dangerously-skip-permissions`
- **tmux session management** with auto-start via systemd
- **MCP control plane** for spawning and managing sessions
- **SSH key isolation** (keys stay inside Docker containers)
- **happy-coder integration** for mobile access

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
- Ubuntu 24 LTS Server
- SSH access configured
- Tailscale installed (optional but recommended)

## Quick Start

1. **Clone this repo:**
   ```bash
   git clone https://github.com/YOUR_USER/pi-infra.git
   cd pi-infra
   ```

2. **Configure inventory:**
   ```bash
   # Edit group_vars/all/vars.yml
   # Set your Tailscale IP and username
   ```

3. **Configure secrets:**
   ```bash
   # Edit group_vars/all/vault.yml with your tokens
   # Then encrypt it:
   ansible-vault encrypt group_vars/all/vault.yml
   ```

4. **Run the playbook:**
   ```bash
   ansible-playbook playbook.yml --ask-vault-pass
   ```

## Directory Structure

```
pi-infra/
├── ansible.cfg              # Ansible configuration
├── playbook.yml             # Main deployment playbook
├── inventory/
│   └── hosts.yml            # Pi host definition
├── group_vars/
│   └── all/
│       ├── vars.yml         # Configuration variables
│       └── vault.yml        # Encrypted secrets
├── files/
│   ├── scripts/             # Shell scripts
│   ├── systemd/             # systemd unit files
│   ├── configs/             # Configuration files
│   ├── docker/              # Dockerfile
│   ├── mcp-server/          # MCP control plane server
│   └── docs/                # CLAUDE.md context files
└── templates/               # Jinja2 templates
```

## Available Tags

Run specific parts of the playbook:

```bash
# Just deploy scripts
ansible-playbook playbook.yml --tags scripts

# Rebuild Docker image
ansible-playbook playbook.yml --tags docker

# Update MCP server
ansible-playbook playbook.yml --tags mcp

# Update systemd services
ansible-playbook playbook.yml --tags systemd
```

## Post-Deployment

**SSH into your Pi and authenticate Claude:**
```bash
ssh claude-shell
~/claude-sandbox.sh
# Follow the login prompts, then /exit
```

**Generate SSH keys for git:**
```bash
ssh-keygen -t ed25519 -C "claude-pi" -f ~/.claude-docker/.ssh/id_ed25519 -N ""
cat ~/.claude-docker/.ssh/id_ed25519.pub
# Add to GitHub: https://github.com/settings/keys
```

**Add MCP servers (from within Claude session):**
```bash
# Press ! for bash, then:
claude mcp add -t http github https://api.githubcopilot.com/mcp \
  -H "Authorization: Bearer \${GITHUB_PAT}"
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

## Related

- [Claude Code In My Pocket](https://kendev.se/articles/raspberry-pi-claude-server) - The article this playbook is based on
- [Claude Code Docs](https://code.claude.com/docs)
- [happy-coder](https://happy.engineering) - Mobile access to Claude Code
