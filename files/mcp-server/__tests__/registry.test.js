import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadRegistry, saveRegistry, addSession, removeSession, getAllSessions, reconcile } from '../registry.js';

let tmpDir;
let registryPath;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'registry-test-'));
  registryPath = join(tmpDir, 'sessions.json');
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('loadRegistry', () => {
  it('returns empty registry when file does not exist', () => {
    const reg = loadRegistry(registryPath);
    expect(reg).toEqual({ version: 1, sessions: {} });
  });

  it('returns empty registry on corrupt JSON', () => {
    writeFileSync(registryPath, '{not valid json');
    const reg = loadRegistry(registryPath);
    expect(reg).toEqual({ version: 1, sessions: {} });
  });

  it('returns empty registry on wrong version', () => {
    writeFileSync(registryPath, JSON.stringify({ version: 99, sessions: {} }));
    const reg = loadRegistry(registryPath);
    expect(reg).toEqual({ version: 1, sessions: {} });
  });

  it('returns empty registry when sessions is not an object', () => {
    writeFileSync(registryPath, JSON.stringify({ version: 1, sessions: "bad" }));
    const reg = loadRegistry(registryPath);
    expect(reg).toEqual({ version: 1, sessions: {} });
  });

  it('loads valid registry file', () => {
    const data = {
      version: 1,
      sessions: { "my-repo": { dir: "/my-repo--a1b2", repo: "github.com/u/r", window_name: "my-repo", created_at: "2026-01-01T00:00:00Z" } }
    };
    writeFileSync(registryPath, JSON.stringify(data));
    const reg = loadRegistry(registryPath);
    expect(reg).toEqual(data);
  });
});

describe('saveRegistry', () => {
  it('writes valid JSON to disk', () => {
    const data = { version: 1, sessions: { test: { dir: "/test" } } };
    saveRegistry(registryPath, data);
    const read = JSON.parse(readFileSync(registryPath, 'utf8'));
    expect(read).toEqual(data);
  });

  it('overwrites existing file atomically', () => {
    saveRegistry(registryPath, { version: 1, sessions: { a: { dir: "/a" } } });
    saveRegistry(registryPath, { version: 1, sessions: { b: { dir: "/b" } } });
    const read = JSON.parse(readFileSync(registryPath, 'utf8'));
    expect(read.sessions).toHaveProperty('b');
    expect(read.sessions).not.toHaveProperty('a');
  });

  it('throws and cleans up tmp file when directory does not exist', () => {
    const badPath = join(tmpDir, 'nonexistent', 'subdir', 'sessions.json');
    expect(() => saveRegistry(badPath, { version: 1, sessions: {} })).toThrow();
  });
});

describe('addSession', () => {
  it('adds a session to empty registry', () => {
    addSession(registryPath, 'my-repo', '/my-repo--abc1', 'github.com/user/repo');
    const reg = loadRegistry(registryPath);
    expect(reg.sessions['my-repo']).toMatchObject({
      dir: '/my-repo--abc1',
      repo: 'github.com/user/repo',
      window_name: 'my-repo',
    });
    expect(reg.sessions['my-repo'].created_at).toBeTruthy();
  });

  it('adds multiple sessions', () => {
    addSession(registryPath, 'repo-a', '/a--1234', 'github.com/u/a');
    addSession(registryPath, 'repo-b', '/b--5678', 'github.com/u/b');
    const reg = loadRegistry(registryPath);
    expect(Object.keys(reg.sessions)).toEqual(['repo-a', 'repo-b']);
  });

  it('defaults repo to empty string when not provided', () => {
    addSession(registryPath, 'blank', '/session--uuid', '');
    const reg = loadRegistry(registryPath);
    expect(reg.sessions['blank'].repo).toBe('');
  });
});

describe('removeSession', () => {
  it('removes an existing session', () => {
    addSession(registryPath, 'my-repo', '/my-repo--abc1', 'github.com/u/r');
    removeSession(registryPath, 'my-repo');
    const reg = loadRegistry(registryPath);
    expect(reg.sessions).toEqual({});
  });

  it('is a no-op for non-existent session', () => {
    addSession(registryPath, 'keep', '/keep--1234', '');
    removeSession(registryPath, 'does-not-exist');
    const reg = loadRegistry(registryPath);
    expect(Object.keys(reg.sessions)).toEqual(['keep']);
  });
});

describe('getAllSessions', () => {
  it('returns empty object for new registry', () => {
    expect(getAllSessions(registryPath)).toEqual({});
  });

  it('returns all sessions', () => {
    addSession(registryPath, 'a', '/a--1', '');
    addSession(registryPath, 'b', '/b--2', '');
    const sessions = getAllSessions(registryPath);
    expect(Object.keys(sessions)).toEqual(['a', 'b']);
  });
});

describe('reconcile', () => {
  it('prunes sessions not in live window list', () => {
    addSession(registryPath, 'alive', '/alive--1', '');
    addSession(registryPath, 'dead', '/dead--2', '');
    const pruned = reconcile(registryPath, ['alive', 'main']);
    expect(pruned).toEqual(['dead']);
    const reg = loadRegistry(registryPath);
    expect(Object.keys(reg.sessions)).toEqual(['alive']);
  });

  it('returns empty array when all sessions are live', () => {
    addSession(registryPath, 'a', '/a--1', '');
    addSession(registryPath, 'b', '/b--2', '');
    const pruned = reconcile(registryPath, ['a', 'b', 'main']);
    expect(pruned).toEqual([]);
  });

  it('handles empty registry', () => {
    const pruned = reconcile(registryPath, ['main']);
    expect(pruned).toEqual([]);
  });

  it('prunes all sessions when no live windows match', () => {
    addSession(registryPath, 'x', '/x--1', '');
    addSession(registryPath, 'y', '/y--2', '');
    const pruned = reconcile(registryPath, ['main']);
    expect(pruned).toEqual(['x', 'y']);
    const reg = loadRegistry(registryPath);
    expect(reg.sessions).toEqual({});
  });
});
