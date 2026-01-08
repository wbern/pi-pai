#!/bin/bash
# Verify all notify handlers in playbook.yml are defined
# Run with: ./scripts/verify-handlers.sh

set -e

PLAYBOOK="playbook.yml"
ERRORS=0

echo "Checking handler definitions in $PLAYBOOK..."

# Extract handler names (lines with "- name:" after "handlers:")
DEFINED_HANDLERS=$(awk '/^  handlers:/,0 { if (/- name:/) print }' "$PLAYBOOK" | sed 's/.*- name: //')

# Extract notify references - both list format and single line
# List format: "notify:\n  - Handler Name"
NOTIFY_LIST=$(awk '/notify:/{getline; while(/^[[:space:]]+-/){gsub(/^[[:space:]]+-[[:space:]]*/,""); print; getline}}' "$PLAYBOOK")
# Single line format: "notify: Handler Name"
NOTIFY_SINGLE=$(grep -E "^\s+notify: [A-Z]" "$PLAYBOOK" 2>/dev/null | sed 's/.*notify: //' || true)

ALL_NOTIFIES=$(echo -e "$NOTIFY_LIST\n$NOTIFY_SINGLE" | sort -u | grep -v "^$" || true)

echo ""
echo "Defined handlers:"
echo "$DEFINED_HANDLERS" | while read -r h; do [ -n "$h" ] && echo "  - $h"; done

echo ""
echo "Notify references:"
echo "$ALL_NOTIFIES" | while read -r n; do [ -n "$n" ] && echo "  - $n"; done

echo ""
echo "Checking all notify references have matching handlers..."

while IFS= read -r notify; do
    [ -z "$notify" ] && continue
    if echo "$DEFINED_HANDLERS" | grep -qF "$notify"; then
        echo "  ✓ $notify"
    else
        echo "  ✗ $notify (UNDEFINED!)"
        ERRORS=$((ERRORS + 1))
    fi
done <<< "$ALL_NOTIFIES"

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "All handlers are properly defined!"
    exit 0
else
    echo "ERROR: $ERRORS undefined handler(s) found!"
    exit 1
fi
