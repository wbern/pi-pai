/**
 * Pure functions for MCP server - testable without side effects
 */

/**
 * Parse MemAvailable from /proc/meminfo content.
 * @param {string} meminfo - Contents of /proc/meminfo
 * @returns {number} Available memory in MB, or -1 if not found
 */
export function parseMemAvailable(meminfo) {
  if (!meminfo) return -1;
  const match = meminfo.match(/^MemAvailable:\s+(\d+)\s+kB$/m);
  if (!match) return -1;
  return Math.floor(parseInt(match[1], 10) / 1024);
}

/**
 * Parse container count from `docker ps` output.
 * Each non-empty line of output represents one running container.
 * @param {string} dockerPsOutput - Output of `docker ps --filter ... --format ...`
 * @returns {number} Number of running containers
 */
export function parseContainerCount(dockerPsOutput) {
  if (!dockerPsOutput) return 0;
  return dockerPsOutput.split("\n").filter(line => line.trim() !== "").length;
}

/**
 * Convert a string to a URL-friendly slug.
 * @param {string} str - Input string
 * @returns {string} Slugified string (lowercase, spaces to dashes)
 */
export function slugify(str) {
  if (!str) return "";
  return str.toLowerCase().replace(/ /g, "-").replace(/[^a-z0-9-]/g, "").substring(0, 30);
}

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
 * @param {string} sessionName - Session name to slugify (takes priority)
 * @returns {string} Window name to use
 */
export function generateWindowName(repo, windowName, sessionName) {
  if (sessionName) {
    return slugify(sessionName);
  }
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
 * @param {string} repo - Git repository URL (if provided, uses repo slug as prefix)
 * @param {string} sessionName - Session name to use as directory name
 * @returns {string} Directory path (e.g., "/session--a1b2c3d4" or "/repo-name--session-name--a1b2")
 */
export function generateSessionDir(repo, sessionName) {
  const uuid = crypto.randomUUID().split("-")[0];
  if (!repo && !sessionName) {
    return `/session--${uuid}`;
  }
  if (!repo) {
    const suffix = uuid.slice(0, 4);
    return `/${slugify(sessionName)}--${suffix}`;
  }
  const repoName = repo.split("/").pop().replace(".git", "");
  if (sessionName) {
    const suffix = uuid.slice(0, 4);
    return `/${repoName}--${slugify(sessionName)}--${suffix}`;
  }
  return `/${repoName}--${uuid}`;
}
