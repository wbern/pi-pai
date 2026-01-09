import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sanitize, buildPrompt, generateWindowName, generateSessionDir } from '../lib.js';

describe('sanitize', () => {
  it('returns empty string for null input', () => {
    expect(sanitize(null)).toBe("");
  });

  it('returns empty string for undefined input', () => {
    expect(sanitize(undefined)).toBe("");
  });

  it('returns empty string for empty string input', () => {
    expect(sanitize("")).toBe("");
  });

  it('allows alphanumeric characters', () => {
    expect(sanitize("abc123XYZ")).toBe("abc123XYZ");
  });

  it('allows dash, underscore, dot, space', () => {
    expect(sanitize("my-project_name.txt file")).toBe("my-project_name.txt file");
  });

  it('removes shell injection characters', () => {
    expect(sanitize("test; rm -rf /")).toBe("test rm -rf ");
  });

  it('removes backticks and dollar signs', () => {
    expect(sanitize("$(whoami)`pwd`")).toBe("whoamipwd");
  });

  it('removes quotes', () => {
    expect(sanitize(`"hello" 'world'`)).toBe("hello world");
  });

  describe('with allowSlash=true', () => {
    it('allows forward slashes', () => {
      expect(sanitize("github.com/user/repo", true)).toBe("github.com/user/repo");
    });

    it('allows @ symbol', () => {
      expect(sanitize("user@example.com", true)).toBe("user@example.com");
    });

    it('removes colon (not in allowed charset)', () => {
      expect(sanitize("git@github.com:user/repo", true)).toBe("git@github.comuser/repo");
    });

    it('still removes dangerous characters', () => {
      expect(sanitize("github.com/user/repo; rm -rf /", true)).toBe("github.com/user/repo rm -rf /");
    });
  });
});

describe('buildPrompt', () => {
  it('returns clone, restart, and instruction when both provided', () => {
    expect(buildPrompt("github.com/user/repo", "fix the bug"))
      .toBe("Clone github.com/user/repo into current directory with 'git clone github.com/user/repo .', then call restart_self to pick up settings, then fix the bug");
  });

  it('returns clone and restart when only repo provided', () => {
    expect(buildPrompt("github.com/user/repo", ""))
      .toBe("Clone github.com/user/repo into current directory with 'git clone github.com/user/repo .', then call restart_self to pick up CLAUDE.md and settings");
  });

  it('returns instruction when only instruction provided', () => {
    expect(buildPrompt("", "research websockets"))
      .toBe("research websockets");
  });

  it('returns empty string when neither provided', () => {
    expect(buildPrompt("", "")).toBe("");
  });

  it('handles null/undefined as falsy', () => {
    expect(buildPrompt(null, undefined)).toBe("");
  });

  it('preserves shell metacharacters in instruction (safe via array args, not shell)', () => {
    // Instructions are natural language and may contain punctuation.
    // Safety relies on spawn({shell: false}) and array args, not sanitization.
    const instruction = "fix bug; echo $PATH | cat /etc/passwd";
    expect(buildPrompt("", instruction)).toBe(instruction);
  });
});

describe('generateWindowName', () => {
  it('returns provided windowName when given', () => {
    expect(generateWindowName("github.com/user/repo", "my-window"))
      .toBe("my-window");
  });

  it('extracts repo name from URL when no windowName', () => {
    expect(generateWindowName("github.com/user/my-project", ""))
      .toBe("my-project");
  });

  it('removes .git suffix from repo name', () => {
    expect(generateWindowName("github.com/user/repo.git", ""))
      .toBe("repo");
  });

  it('sanitizes extracted repo name', () => {
    expect(generateWindowName("github.com/user/repo;bad", ""))
      .toBe("repobad");
  });

  describe('fallback timestamp name', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T10:30:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('generates timestamp-based name when no repo or windowName', () => {
      expect(generateWindowName("", ""))
        .toBe("session-1705314600000");
    });
  });
});

describe('generateSessionDir', () => {
  it('returns /workspace when no repo provided', () => {
    expect(generateSessionDir("")).toBe("/workspace");
  });

  it('returns /workspace when repo is null', () => {
    expect(generateSessionDir(null)).toBe("/workspace");
  });

  describe('with repo', () => {
    beforeEach(() => {
      vi.stubGlobal('crypto', {
        randomUUID: vi.fn(() => 'abc12345-6789-0def-ghij-klmnopqrstuv')
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('generates UUID subdirectory when repo provided', () => {
      expect(generateSessionDir("github.com/user/repo"))
        .toBe("/workspace/abc12345");
    });

    it('uses first segment of UUID', () => {
      expect(generateSessionDir("any-repo"))
        .toBe("/workspace/abc12345");
    });
  });
});
