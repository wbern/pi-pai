# Testing the Playbook

This guide walks through testing the Ansible playbook against a virtual Pi using OrbStack.

## Prerequisites

- macOS with Apple Silicon (or Intel)
- Homebrew installed
- Ansible installed: `brew install ansible`
- Ansible lint: `brew install ansible-lint` (optional but recommended)

## Step 0: Validate playbook syntax

Before running against a VM, verify the playbook is valid:

```bash
make lint
```

Or run individually:
```bash
ansible-playbook playbook.yml --syntax-check  # Syntax check
ansible-lint playbook.yml                      # Best practices
gitleaks detect --config .gitleaks.toml       # Secrets scan
```

All checks should pass with no errors.

## Step 1: Install OrbStack

```bash
brew install orbstack
```

Open OrbStack to complete setup:
```bash
open -a OrbStack
```

## Step 2: Create the test VM

In OrbStack UI:
1. Select **Linux**
2. Set Distribution: **Ubuntu**
3. Set Version: **24.04 LTS**
4. Set Architecture: **arm64**
5. Click **Create**

Or via CLI:
```bash
orb create ubuntu:24.04 pi-test
```

## Step 3: Get VM info

View in OrbStack UI or run:
```bash
orb list
```

Note the machine name (e.g., `ubuntu`). OrbStack provides:
- Domain: `<name>.orb.local`
- SSH access with your Mac username

## Step 4: Configure SSH access

OrbStack shares your Mac's `.ssh` directory but SSH server isn't installed by default.

Enter the VM:
```bash
orb -m ubuntu bash
```

Install SSH server:
```bash
sudo apt update && sudo apt install -y openssh-server
sudo systemctl enable --now ssh
```

Exit and verify SSH works:
```bash
exit
ssh ubuntu.orb.local
```

If you see "host key changed" error (after recreating VM):
```bash
ssh-keygen -R ubuntu.orb.local
ssh ubuntu.orb.local
```

## Step 5: Test Ansible connectivity

Test that Ansible can reach the VM:
```bash
ansible -i inventory/test.yml pi -m ping
```

Expected output: `pi | SUCCESS => { ... "ping": "pong" }`

## Step 6: Run the playbook

```bash
make test
```

Or explicitly:
```bash
ansible-playbook -i inventory/test.yml playbook.yml
```

Expected: All tasks complete with `failed=0`.

## Step 7: Verify deployment

Run these checks to verify the deployment:

```bash
# MCP server health
ssh ubuntu.orb.local 'curl -s http://localhost:3100/health'
# Expected: {"status":"ok"}

# Services enabled
ssh ubuntu.orb.local 'systemctl --user is-enabled tmux-control-plane claude-tmux'
# Expected: enabled (twice)

# Docker image exists
ssh ubuntu.orb.local 'docker images claude-code --format "{{.Repository}}:{{.Tag}}"'
# Expected: claude-code:latest

# SSH key generated
ssh ubuntu.orb.local 'test -f ~/.claude-docker/.ssh/id_ed25519 && echo "SSH key exists"'
# Expected: SSH key exists

# Scripts are executable
ssh ubuntu.orb.local 'test -x ~/claude-sandbox.sh && echo "Scripts executable"'
# Expected: Scripts executable

# Tailscale installed (if authkey was provided)
ssh ubuntu.orb.local 'which tailscale && tailscale --version | head -1'
# Expected: /usr/bin/tailscale and version number

# Directory structure
ssh ubuntu.orb.local 'ls -d ~/Repos ~/.claude-docker ~/.claude-control-plane ~/tmux-control-plane 2>/dev/null | wc -l'
# Expected: 4
```

**Note:** `claude-tmux` requires OAuth tokens. If tokens weren't copied during deployment, the service will restart continuously. See [OAuth Token Setup](#oauth-token-setup-required).

## Resetting the VM

To start fresh:
```bash
make clean                    # Delete the VM
orb create ubuntu:24.04 ubuntu  # Create a new one
```

After recreating, repeat Step 4 (SSH setup) and clear known hosts:
```bash
ssh-keygen -R ubuntu.orb.local
```

## OAuth Token Setup (Required)

OAuth tokens from Claude Code and happy-coder are account-bound, not machine-bound. You authenticate locally, then tokens are copied to the Pi/VM during deployment.

### Step 1: Authenticate locally

```bash
make auth
```

This runs `claude` first (complete OAuth, then `/exit`), then `happy` (complete OAuth, then Ctrl+C). Both tools must be installed:
```bash
npm install -g @anthropic-ai/claude-code
npm install -g happy-coder
```

### Step 2: Copy tokens to .tokens/

```bash
make copy-tokens
```

This copies:
- `~/.claude/` → `.tokens/.claude/` (Claude Code credentials)
- `~/.happy/` → `.tokens/.happy/` (happy-coder credentials)

The `.tokens/` directory is gitignored and claudeignored for security.

### Step 3: Run molecule test

```bash
make test       # Uses molecule to test deployment
```

Or use molecule directly:
```bash
make converge   # Run playbook on existing VM
make verify     # Run verification checks
```

The playbook automatically copies tokens from `.tokens/` to the target during the converge phase. Deployment will fail if `.tokens/.claude` is missing.

### Token Security Notes

- Tokens in `.tokens/` are gitignored - never commit them
- Tokens are also in `.claudeignore` so AI assistants can't read them
- OAuth tokens can be revoked from the respective service dashboards
- Delete `.tokens/` when done: `rm -rf .tokens/`

## Notes

- Test inventory is at `inventory/test.yml` (uses your Mac username and default SSH key)
- The vault file has placeholder values - fine for testing
- OrbStack is free for personal use (Pro trial banner is for team features)
