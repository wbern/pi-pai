# Pi-Pai Makefile

.PHONY: setup lint syntax deploy test test-full verify create destroy clean auth copy-tokens

# First-time setup after cloning
setup:
	@./scripts/setup-hooks.sh
	@echo "Installing molecule (optional, for full test suite)..."
	pip install -q -r requirements.txt 2>/dev/null || echo "  Skipped (use: pip install -r requirements.txt)"

# Run all linters
lint:
	@echo "Running syntax check..."
	ansible-playbook playbook.yml --syntax-check
	@echo "Running handler verification..."
	./scripts/verify-handlers.sh
	@echo "Running secrets scan..."
	gitleaks detect --config .gitleaks.toml --verbose
	@echo "Running ansible-lint (optional)..."
	@ansible-lint playbook.yml 2>/dev/null || echo "  Skipped (install: pip install ansible-lint)"

# Quick syntax check only
syntax:
	ansible-playbook playbook.yml --syntax-check

# Deploy to Pi (production)
deploy:
	@echo ""
	@# Verify vault.yml exists
	@if [ ! -f group_vars/all/vault.yml ]; then \
		echo "ERROR: group_vars/all/vault.yml not found."; \
		echo ""; \
		echo "Create it from the example:"; \
		echo "  cp group_vars/all/vault.yml.example group_vars/all/vault.yml"; \
		echo "  # Edit with your secrets, then encrypt:"; \
		echo "  ansible-vault encrypt group_vars/all/vault.yml"; \
		echo ""; \
		exit 1; \
	fi
	@# Verify vault.yml is encrypted
	@if ! head -1 group_vars/all/vault.yml 2>/dev/null | grep -q '^\$$ANSIBLE_VAULT'; then \
		echo "ERROR: group_vars/all/vault.yml is not encrypted."; \
		echo ""; \
		echo "Encrypt it first:"; \
		echo "  ansible-vault encrypt group_vars/all/vault.yml"; \
		echo ""; \
		exit 1; \
	fi
	@# Verify OAuth tokens exist
	@if [ ! -f .tokens/.claude/.credentials.json ]; then \
		echo "ERROR: OAuth tokens not found in .tokens/"; \
		echo ""; \
		echo "Run these commands first:"; \
		echo "  make auth         # Complete OAuth flows"; \
		echo "  make copy-tokens  # Copy tokens to .tokens/"; \
		echo ""; \
		exit 1; \
	fi
	@echo "You will be prompted for:"
	@echo "  1. Vault password - decrypts secrets in vault.yml"
	@echo "  2. BECOME password - your Pi's sudo password"
	@echo ""
	ansible-playbook playbook.yml --ask-vault-pass --ask-become-pass

# Deploy to test VM (OrbStack)
test:
	$(call ensure_test_vault)
	@# Verify OAuth tokens exist
	@if [ ! -f .tokens/.claude/.credentials.json ]; then \
		echo "ERROR: OAuth tokens not found in .tokens/"; \
		echo ""; \
		echo "Run these commands first:"; \
		echo "  make auth         # Complete OAuth flows"; \
		echo "  make copy-tokens  # Copy tokens to .tokens/"; \
		echo ""; \
		exit 1; \
	fi
	ansible-playbook playbook.yml -i inventory/test.yml \
		--vault-password-file=/tmp/.vault_pass \
		--extra-vars @molecule/default/vault.test.yml

# Destroy test VM
clean:
	orb delete ubuntu -f 2>/dev/null || true

# --- Molecule targets (full test lifecycle) ---

# Helper to ensure TEST vault exists (separate from user's vault.yml)
# Creates molecule/default/vault.test.yml with dummy values, never touches vault.yml
define ensure_test_vault
	@if [ ! -f molecule/default/vault.test.yml ]; then \
		echo "Creating vault.test.yml for testing..."; \
		cp group_vars/all/vault.yml.example molecule/default/vault.test.yml; \
	fi
	@if ! head -1 molecule/default/vault.test.yml 2>/dev/null | grep -q '^\$$ANSIBLE_VAULT'; then \
		echo "Encrypting vault.test.yml with test password..."; \
		echo "pi-pai-test" > /tmp/.vault_pass && \
		ansible-vault encrypt molecule/default/vault.test.yml --vault-password-file=/tmp/.vault_pass; \
	else \
		echo "pi-pai-test" > /tmp/.vault_pass; \
	fi
endef

# Full test: create → converge → verify → destroy
test-full:
	$(call ensure_test_vault)
	ANSIBLE_VAULT_PASSWORD_FILE=/tmp/.vault_pass molecule test

# Create VM only
create:
	molecule create

# Run playbook against existing VM
converge:
	$(call ensure_test_vault)
	ANSIBLE_VAULT_PASSWORD_FILE=/tmp/.vault_pass molecule converge

# Run verification checks
verify:
	$(call ensure_test_vault)
	ANSIBLE_VAULT_PASSWORD_FILE=/tmp/.vault_pass molecule verify

# Destroy VM
destroy:
	molecule destroy

# --- OAuth token management ---

# Authenticate locally (claude first, then happy)
auth:
	@echo ""
	@echo "=== OAuth Authentication ==="
	@echo ""
	@MISSING=""; \
	command -v claude >/dev/null 2>&1 || MISSING="$$MISSING claude"; \
	command -v happy >/dev/null 2>&1 || MISSING="$$MISSING happy"; \
	if [ -n "$$MISSING" ]; then \
		echo "ERROR: Missing required tools:$$MISSING"; \
		echo ""; \
		echo "Install with:"; \
		echo "  npm install -g @anthropic-ai/claude-code"; \
		echo "  npm install -g happy-coder"; \
		echo ""; \
		exit 1; \
	fi
	@echo "Step 1: Claude Code"
	@echo "If already authenticated, type /exit immediately."
	@echo "If not, complete OAuth in browser, then /exit."
	@echo ""
	@printf "Starting in 3..."; sleep 1; printf "\rStarting in 2..."; sleep 1; printf "\rStarting in 1..."; sleep 1; printf "\r                \r"
	@echo ""
	@claude || true
	@echo ""
	@echo "Step 2: Happy Coder"
	@echo "If already authenticated, type /exit immediately."
	@echo "If not, complete OAuth in browser, then /exit."
	@echo ""
	@printf "Starting in 3..."; sleep 1; printf "\rStarting in 2..."; sleep 1; printf "\rStarting in 1..."; sleep 1; printf "\r                \r"
	@echo ""
	@happy || true
	@echo ""
	@echo "=== Authentication Complete ==="
	@echo ""
	@echo "Tokens are stored in:"
	@# macOS stores Claude credentials in Keychain, Linux uses file
	@if [ "$$(uname)" = "Darwin" ]; then \
		if security find-generic-password -s "Claude Code-credentials" -w >/dev/null 2>&1; then \
			echo "  ✓ macOS Keychain (Claude Code-credentials)"; \
		else \
			echo "  ✗ macOS Keychain (Claude Code-credentials) (MISSING!)"; \
		fi; \
	else \
		if [ -f ~/.claude/.credentials.json ]; then \
			echo "  ✓ ~/.claude/.credentials.json"; \
		else \
			echo "  ✗ ~/.claude/.credentials.json (MISSING!)"; \
		fi; \
	fi
	@test -f ~/.happy/access.key && echo "  ✓ ~/.happy/access.key" || echo "  ✗ ~/.happy/access.key (MISSING!)"
	@echo ""
	@echo "Next step: run 'make copy-tokens' to copy them for deployment"
	@echo ""

# Copy local OAuth tokens to .tokens/ for deployment
copy-tokens:
	@echo ""
	@echo "Copying tokens (this may take a moment on macOS)..."
	@echo ""
	@# Check Happy tokens exist (file-based on all platforms)
	@if [ ! -d ~/.happy ]; then \
		echo "ERROR: Missing ~/.happy directory"; \
		echo "Run 'make auth' first to authenticate."; \
		exit 1; \
	fi
	@# Check Claude tokens exist (Keychain on macOS, file on Linux)
	@if [ "$$(uname)" = "Darwin" ]; then \
		if ! security find-generic-password -s "Claude Code-credentials" -w >/dev/null 2>&1; then \
			echo "ERROR: Claude credentials not found in macOS Keychain"; \
			echo "Run 'make auth' first to authenticate."; \
			exit 1; \
		fi; \
	else \
		if [ ! -f ~/.claude/.credentials.json ]; then \
			echo "ERROR: Missing ~/.claude/.credentials.json"; \
			echo "Run 'make auth' first to authenticate."; \
			exit 1; \
		fi; \
	fi
	@mkdir -p .tokens/.claude
	@# On macOS, extract credentials from Keychain to file (Pi runs Linux, needs file)
	@if [ "$$(uname)" = "Darwin" ]; then \
		security find-generic-password -s "Claude Code-credentials" -w > .tokens/.claude/.credentials.json && \
		echo "✓ Exported Claude credentials from Keychain"; \
	else \
		cp ~/.claude/.credentials.json .tokens/.claude/.credentials.json && \
		echo "✓ Copied Claude credentials file"; \
	fi
	@# Copy other Claude config files if they exist
	@test -f ~/.claude/settings.json && cp ~/.claude/settings.json .tokens/.claude/ 2>/dev/null || true
	@test -f ~/.claude/settings.local.json && cp ~/.claude/settings.local.json .tokens/.claude/ 2>/dev/null || true
	@mkdir -p .tokens/.happy
	@cp ~/.happy/access.key .tokens/.happy/ && echo "✓ Copied Happy tokens"
	@echo ""
	@echo "Tokens ready in .tokens/ - run 'make deploy' to deploy"
