/**
 * Session registry — persists project session metadata to disk so sessions
 * can be restored after reboot. Uses atomic write (write-to-tmp-then-rename)
 * to prevent corruption on power loss.
 */

import { readFileSync, writeFileSync, renameSync, unlinkSync } from "fs";
import { dirname, join } from "path";

const REGISTRY_VERSION = 1;

/**
 * Read and parse the registry file. Returns empty registry on missing/corrupt file.
 * @param {string} registryPath - Absolute path to sessions.json
 * @returns {{ version: number, sessions: Object }}
 */
export function loadRegistry(registryPath) {
  try {
    const data = JSON.parse(readFileSync(registryPath, "utf8"));
    if (data && data.version === REGISTRY_VERSION && typeof data.sessions === "object") {
      return data;
    }
  } catch {
    // Missing, corrupt, or wrong version — start fresh
  }
  return { version: REGISTRY_VERSION, sessions: {} };
}

/**
 * Atomically write registry to disk (write to tmp file, then rename).
 * @param {string} registryPath - Absolute path to sessions.json
 * @param {{ version: number, sessions: Object }} registry
 */
export function saveRegistry(registryPath, registry) {
  const dir = dirname(registryPath);
  const tmpFile = join(dir, `.sessions.tmp.${process.pid}`);
  try {
    writeFileSync(tmpFile, JSON.stringify(registry, null, 2) + "\n", "utf8");
    renameSync(tmpFile, registryPath);
  } catch (e) {
    // Clean up tmp file on failure
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
    throw e;
  }
}

/**
 * Add a session entry to the registry.
 * @param {string} registryPath
 * @param {string} windowName - tmux window name (key)
 * @param {string} dir - Session directory path (e.g. /repo--session--hash)
 * @param {string} repo - Git repo URL (may be empty)
 */
export function addSession(registryPath, windowName, dir, repo) {
  const registry = loadRegistry(registryPath);
  registry.sessions[windowName] = {
    dir,
    repo: repo || "",
    window_name: windowName,
    created_at: new Date().toISOString(),
  };
  saveRegistry(registryPath, registry);
}

/**
 * Remove a session entry from the registry.
 * @param {string} registryPath
 * @param {string} windowName - tmux window name to remove
 */
export function removeSession(registryPath, windowName) {
  const registry = loadRegistry(registryPath);
  delete registry.sessions[windowName];
  saveRegistry(registryPath, registry);
}

/**
 * Get all session entries.
 * @param {string} registryPath
 * @returns {Object} Map of windowName -> session info
 */
export function getAllSessions(registryPath) {
  return loadRegistry(registryPath).sessions;
}

/**
 * Reconcile registry with live tmux windows — prune entries whose
 * windows no longer exist (handles manual kills, crashes).
 * @param {string} registryPath
 * @param {string[]} liveTmuxWindows - Array of active tmux window names
 * @returns {string[]} List of pruned window names
 */
export function reconcile(registryPath, liveTmuxWindows) {
  const registry = loadRegistry(registryPath);
  const live = new Set(liveTmuxWindows);
  const pruned = [];
  for (const name of Object.keys(registry.sessions)) {
    if (!live.has(name)) {
      delete registry.sessions[name];
      pruned.push(name);
    }
  }
  if (pruned.length > 0) {
    saveRegistry(registryPath, registry);
  }
  return pruned;
}
