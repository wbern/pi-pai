#!/bin/bash
# Health check for GitHub MCP server
# Called by github-mcp-watchdog.timer every 30s
# Restarts the service if it fails to respond to a JSON-RPC initialize request

set -euo pipefail

PORT="${GITHUB_MCP_PORT:-3101}"

# Don't fight systemd during restarts — skip if service isn't active
if ! systemctl --user is-active --quiet github-mcp; then
    exit 0
fi

# Send a JSON-RPC initialize request and verify the full chain responds
RESPONSE=$(curl -sf --max-time 10 \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"watchdog","version":"1.0.0"}}}' \
    "http://localhost:${PORT}/mcp" 2>/dev/null) || RESPONSE=""

if echo "$RESPONSE" | grep -q '"jsonrpc"'; then
    echo "Health check passed (port ${PORT})"
    exit 0
fi

echo "Health check FAILED — restarting github-mcp" >&2
systemctl --user restart github-mcp
