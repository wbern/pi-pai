#!/bin/bash
# Setup git hooks for pi-pai
# Run this after cloning the repo

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Setting up git hooks for pi-pai..."

# Check for required tools
echo "Checking dependencies..."

if ! command -v gitleaks &> /dev/null; then
    echo "gitleaks not found. Installing via Homebrew..."
    if command -v brew &> /dev/null; then
        brew install gitleaks
    else
        echo "Error: Homebrew not found. Install gitleaks manually:"
        echo "  https://github.com/gitleaks/gitleaks#installing"
        exit 1
    fi
fi

if ! command -v ansible &> /dev/null; then
    echo "Warning: ansible not found. Install with: brew install ansible"
fi

if ! command -v ansible-lint &> /dev/null; then
    echo "Warning: ansible-lint not found. Install with: brew install ansible-lint"
fi

# Install pre-commit hook
echo "Installing pre-commit hook..."
cp "$SCRIPT_DIR/pre-commit" "$REPO_ROOT/.git/hooks/pre-commit"
chmod +x "$REPO_ROOT/.git/hooks/pre-commit"

echo ""
echo "Git hooks installed successfully!"
echo ""
echo "The pre-commit hook will:"
echo "  - Scan staged files for secrets (gitleaks)"
echo "  - Run ansible syntax check"
echo "  - Run ansible-lint (if installed)"
echo ""
echo "To skip hooks temporarily: git commit --no-verify"
