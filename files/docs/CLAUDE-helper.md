# Claude Helper Instance

This is a human-in-the-loop Claude for system administration tasks. NOT sandboxed.

## What This Is

A helper instance for setting up and managing the **autonomous agents** that live in `~/Repos`. Those run sandboxed in Docker with `--dangerously-skip-permissions`.

This instance runs on the host with normal permissions - use it for:
- Installing/configuring Claude Code plugins
- Managing systemd services
- Updating Docker images
- SSH key management
- System configuration

## Architecture

```
~/                          <- YOU ARE HERE (helper, human-in-loop)
├── Repos/                  <- Autonomous agents live here (Docker sandboxed)
├── claude-sandbox.sh       <- Spawns sandboxed sessions
├── upgrade-claude.sh       <- Rebuilds Docker image
├── tmux-control-plane/     <- MCP server for session orchestration
└── .claude-docker/         <- Credentials for sandboxed instances
```

## Key Services

| Service | Purpose | Check |
|---------|---------|-------|
| `claude-tmux` | Main tmux session with Claude | `systemctl --user status claude-tmux` |
| `tmux-control-plane` | MCP server for spawning sessions | `systemctl --user status tmux-control-plane` |

## Common Tasks

### Install a Claude Code plugin

Third-party plugins require registering the marketplace first. Example with [chief-wiggum](https://github.com/jes5199/chief-wiggum):

```bash
# On the host - clone the marketplace
git clone --depth 1 https://github.com/jes5199/chief-wiggum.git \
  ~/.claude-docker/plugins/marketplaces/chief-wiggum

# Register in known_marketplaces.json
cat > ~/.claude-docker/plugins/known_marketplaces.json << 'EOF'
{
  "chief-wiggum": {
    "source": {
      "source": "github",
      "repo": "jes5199/chief-wiggum"
    },
    "installLocation": "/home/node/.claude/plugins/marketplaces/chief-wiggum",
    "lastUpdated": "2026-01-06T00:00:00.000Z"
  }
}
EOF
```

Then inside a Claude session:

```bash
/plugin install chief-wiggum
```

### Install custom slash commands

```bash
~/claude-sandbox-shell.sh
# Inside the container:
npx @wbern/claude-instructions --scope=user
```

### Restart services
```bash
systemctl --user restart claude-tmux
systemctl --user restart tmux-control-plane
```

### Update Claude Code
```bash
~/upgrade-claude.sh
```

## Important Paths

- **Sandboxed credentials:** `~/.claude-docker/`
- **Plugin config:** `~/.claude-docker/plugins/`
- **Control plane MCP config:** `~/.claude-control-plane/workspace/.mcp.json`
- **Systemd services:** `~/.config/systemd/user/`
- **tmux config:** `~/.tmux.conf`

## DO NOT

- Run `--dangerously-skip-permissions` here (that's for sandboxed instances)
- Modify files in `~/Repos` directly (spawn a sandboxed session instead)
