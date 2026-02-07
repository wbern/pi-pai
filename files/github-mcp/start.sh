#!/bin/bash
# GitHub MCP server via mcp-proxy
# Wraps the official GitHub MCP Docker image and exposes it as HTTP

set -e

PORT="${GITHUB_MCP_PORT:-3101}"
VERSION="${GITHUB_MCP_IMAGE_VERSION:-0.28.1}"

# Create env file to avoid token in process list
ENV_FILE=$(mktemp)
trap 'rm -f "$ENV_FILE"' EXIT
echo "GITHUB_PERSONAL_ACCESS_TOKEN=${GITHUB_PERSONAL_ACCESS_TOKEN}" > "$ENV_FILE"

# Run mcp-proxy, wrapping the GitHub MCP Docker image
exec ~/.local/bin/mcp-proxy \
    --port "$PORT" \
    -- docker run -i --rm \
        --env-file "$ENV_FILE" \
        "ghcr.io/github/github-mcp-server:${VERSION}"
