/**
 * Pure functions for MCP server - testable without side effects
 */

/**
 * Sanitize input string to prevent injection attacks.
 * Allows alphanumeric, dash, underscore, dot, space.
 * Optionally allows slash and @ for URLs.
 *
 * Security note: allowSlash=true preserves "/" but strips all shell metacharacters
 * that enable command injection (;$`'"|\&><()!*?#). A "/" alone cannot cause
 * injection - it only becomes dangerous with command separators like ";".
 * Example: "repo; rm -rf /" becomes "repo rm -rf /" (harmless malformed URL).
 *
 * @param {string} str - Input string
 * @param {boolean} allowSlash - Allow / and @ characters (for git URLs)
 * @returns {string} Sanitized string
 */
export function sanitize(str, allowSlash = false) {
  if (!str) return "";
  const pattern = allowSlash ? /[^a-zA-Z0-9\-_./@ ]/g : /[^a-zA-Z0-9\-_. ]/g;
  return str.replace(pattern, "");
}

/**
 * Build prompt from repo and instruction inputs.
 * When a repo is specified, instructs to clone into current directory and restart.
 * @param {string} repo - Git repository URL (already sanitized)
 * @param {string} instruction - Task instruction (already sanitized)
 * @returns {string} Constructed prompt
 */
export function buildPrompt(repo, instruction) {
  if (repo && instruction) {
    return `Clone ${repo} into current directory with 'git clone ${repo} .', then call restart_self to pick up settings, then ${instruction}`;
  } else if (repo) {
    return `Clone ${repo} into current directory with 'git clone ${repo} .', then call restart_self to pick up CLAUDE.md and settings`;
  } else if (instruction) {
    return instruction;
  }
  return "";
}

/**
 * Generate window name from repo or use provided name.
 * @param {string} repo - Git repository URL (already sanitized)
 * @param {string} windowName - Custom window name (already sanitized)
 * @returns {string} Window name to use
 */
export function generateWindowName(repo, windowName) {
  if (windowName) {
    return windowName;
  }
  if (repo) {
    return sanitize(repo.split("/").pop().replace(".git", ""));
  }
  return `session-${Date.now()}`;
}

/**
 * Generate a unique session directory path.
 * @param {string} repo - Git repository URL (if provided, generates UUID subdir)
 * @returns {string} Directory path (e.g., "/workspace" or "/workspace/abc123")
 */
export function generateSessionDir(repo) {
  if (!repo) {
    return "/workspace";
  }
  // Generate short UUID (first segment)
  const uuid = crypto.randomUUID().split("-")[0];
  return `/workspace/${uuid}`;
}
