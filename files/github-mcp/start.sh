#!/bin/bash
# GitHub MCP server via mcp-proxy
# Wraps the official GitHub MCP Docker image and exposes it as HTTP

set -e

PORT="${GITHUB_MCP_PORT:-3101}"
VERSION="${GITHUB_MCP_IMAGE_VERSION:-0.28.1}"

# Run mcp-proxy, wrapping the GitHub MCP Docker image
# GITHUB_PERSONAL_ACCESS_TOKEN is inherited from systemd environment
exec ~/.local/bin/mcp-proxy \
    --port "$PORT" \
    -- docker run -i --rm \
        -e "GITHUB_PERSONAL_ACCESS_TOKEN=${GITHUB_PERSONAL_ACCESS_TOKEN}" \
        "ghcr.io/github/github-mcp-server:${VERSION}"
