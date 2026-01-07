#!/bin/bash
set -e

echo "=== Upgrading Claude Code ==="

cd ~/claude-sandbox-image
docker build --pull --no-cache -t claude-code .

echo ""
echo "Version: $(docker run --rm claude-code claude --version)"
