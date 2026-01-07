#!/bin/bash
set -e

# Project session: full access to ~/Repos
run_project() {
    local prompt="$1"
    docker run -it --rm \
        --init \
        --memory 3g \
        --add-host=host.docker.internal:host-gateway \
        -v ~/Repos:/workspace \
        -v ~/.claude-docker:/home/node/.claude \
        -v ~/.claude-docker/.ssh:/home/node/.ssh:ro \
        -v ~/.claude-docker/.happy:/home/node/.happy \
        -w /workspace \
        -e TERM=xterm-256color \
        -e COLORTERM=truecolor \
        -e TMPDIR=/home/node/.claude/tmp \
        -e CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
        -e GITHUB_PAT="$(cat ~/.claude-docker/.github_token 2>/dev/null)" \
        -e CONTEXT7_TOKEN="$(cat ~/.claude-docker/.context7_token 2>/dev/null)" \
        -e CLAUDE_CONFIG_DIR="/home/node/.claude" \
        claude-code ${prompt:+"$prompt"}
}

# --run "prompt": internal, called by tmux to run project session
if [[ "$1" == "--run" ]]; then
    run_project "$2"
    exit 0
fi

# No args: run control plane (isolated - no repo access, no SSH)
if [[ -z "$1" ]]; then
    docker run -it --rm \
        --init \
        --memory 3g \
        --add-host=host.docker.internal:host-gateway \
        -v ~/.claude-control-plane/workspace:/workspace \
        -v ~/.claude-docker:/home/node/.claude \
        -v ~/.claude-docker/.happy:/home/node/.happy \
        -e TERM=xterm-256color \
        -e COLORTERM=truecolor \
        -e TMPDIR=/home/node/.claude/tmp \
        -e CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
        -e GITHUB_PAT="$(cat ~/.claude-docker/.github_token 2>/dev/null)" \
        -e CONTEXT7_TOKEN="$(cat ~/.claude-docker/.context7_token 2>/dev/null)" \
        -e CLAUDE_CONFIG_DIR="/home/node/.claude" \
        claude-code
    exit 0
fi

# --spawn "prompt" "window_name": MCP entry point for spawning sessions
if [[ "$1" == "--spawn" ]]; then
    PROMPT="$2"
    WINDOW_NAME="${3:-session-$(date +%s)}"
    ESCAPED="${PROMPT//\'/\'\\\'\'}"
    tmux new-window -t main: -n "$WINDOW_NAME" \
        "$HOME/claude-sandbox.sh --run '$ESCAPED'"
    echo "Spawned window '$WINDOW_NAME'"
    exit 0
fi

echo "Usage:"
echo "  $0                              Run control plane (isolated)"
echo "  $0 --spawn 'prompt' 'name'      Spawn project session via MCP"
exit 1
