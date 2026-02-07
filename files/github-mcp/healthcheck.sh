#!/bin/bash
# Health check for GitHub MCP server
# Called by github-mcp-watchdog.timer every 30s
# Restarts the service if the HTTP server is unresponsive

set -euo pipefail

PORT="${GITHUB_MCP_PORT:-3101}"

# Don't fight systemd during restarts — skip if service isn't active
if ! systemctl --user is-active --quiet github-mcp; then
    exit 0
fi

# Check that the HTTP server is responding (GET /sse returns 405 but proves the server is alive)
HTTP_CODE=$(curl -sf --max-time 10 -o /dev/null -w '%{http_code}' \
    "http://localhost:${PORT}/sse" 2>/dev/null) || HTTP_CODE="000"

if [ "$HTTP_CODE" != "000" ]; then
    echo "Health check passed (port ${PORT})"
    exit 0
fi

echo "Health check FAILED — restarting github-mcp" >&2
systemctl --user restart github-mcp
