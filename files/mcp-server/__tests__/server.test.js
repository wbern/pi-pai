import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sanitize, buildPrompt, generateWindowName, generateSessionDir, slugify, parseMemAvailable, parseContainerCount, toSshUrl } from '../lib.js';

describe('sanitize', () => {
  it.each([null, undefined, ""])('returns empty string for falsy input: %s', (input) => {
    expect(sanitize(input)).toBe("");
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

  it('output only contains allowed characters', () => {
    const dangerous = "test;`$()'\"|\\&><*?#\n\t";
    const result = sanitize(dangerous);
    expect(result).toMatch(/^[a-zA-Z0-9\-_. ]*$/);
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

describe('toSshUrl', () => {
  it('converts github.com/user/repo to SSH format', () => {
    expect(toSshUrl("github.com/user/repo")).toBe("git@github.com:user/repo.git");
  });

  it('converts https://github.com/user/repo to SSH format', () => {
    expect(toSshUrl("https://github.com/user/repo")).toBe("git@github.com:user/repo.git");
  });

  it('strips .git suffix before converting', () => {
    expect(toSshUrl("github.com/user/repo.git")).toBe("git@github.com:user/repo.git");
  });

  it('converts http:// URLs too', () => {
    expect(toSshUrl("http://github.com/user/repo")).toBe("git@github.com:user/repo.git");
  });

  it('returns non-GitHub URLs unchanged', () => {
    expect(toSshUrl("gitlab.com/user/repo")).toBe("gitlab.com/user/repo");
  });

  it('returns already-SSH URLs unchanged', () => {
    expect(toSshUrl("git@github.com:user/repo.git")).toBe("git@github.com:user/repo.git");
  });

  it.each([null, undefined, ""])('returns empty string for falsy input: %s', (input) => {
    expect(toSshUrl(input)).toBe("");
  });
});

describe('buildPrompt', () => {
  it('returns clone with SSH URL, restart, and instruction when both provided', () => {
    expect(buildPrompt("github.com/user/repo", "fix the bug"))
      .toBe("Clone github.com/user/repo into current directory with 'git clone git@github.com:user/repo.git .', then call restart_self to pick up settings, then fix the bug");
  });

  it('returns clone with SSH URL and restart when only repo provided', () => {
    expect(buildPrompt("github.com/user/repo", ""))
      .toBe("Clone github.com/user/repo into current directory with 'git clone git@github.com:user/repo.git .', then call restart_self to pick up CLAUDE.md and settings");
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
  it('slugifies and uses sessionName when provided', () => {
    expect(generateWindowName("github.com/user/repo", "my-window", "My Project Name"))
      .toBe("my-project-name");
  });

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

describe('slugify', () => {
  it('converts mixed case to lowercase and replaces spaces with dashes', () => {
    expect(slugify("My Project Name")).toBe("my-project-name");
  });

  it('truncates output to 30 characters max', () => {
    expect(slugify("This Is A Very Long Session Name That Exceeds Limit")).toBe("this-is-a-very-long-session-na");
  });

  it('removes special characters keeping only alphanumeric and dashes', () => {
    expect(slugify("My Project! @#$%^&*()")).toBe("my-project-");
  });

  it.each([null, undefined, ""])('returns empty string for falsy input: %s', (input) => {
    expect(slugify(input)).toBe("");
  });
});

describe('generateSessionDir', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'abc12345-6789-0def-ghij-klmnopqrstuv')
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(["", null])('returns /session--UUID when repo is falsy and no sessionName: %s', (input) => {
    expect(generateSessionDir(input)).toBe("/session--abc12345");
  });

  it('uses slugified sessionName with suffix when no repo', () => {
    expect(generateSessionDir("", "Research WebSockets"))
      .toBe("/research-websockets--abc1");
  });

  it('uses repo name, slugified sessionName, and short suffix', () => {
    expect(generateSessionDir("github.com/user/pi-pai", "Add Contributing MD"))
      .toBe("/pi-pai--add-contributing-md--abc1");
  });

  it('generates repo--UUID directory when repo provided without sessionName', () => {
    expect(generateSessionDir("github.com/user/repo"))
      .toBe("/repo--abc12345");
  });
});

describe('parseMemAvailable', () => {
  const MEMINFO = [
    "MemTotal:        3791264 kB",
    "MemFree:          142536 kB",
    "MemAvailable:    1048576 kB",
    "Buffers:          123456 kB",
  ].join("\n");

  it('parses MemAvailable from /proc/meminfo content', () => {
    expect(parseMemAvailable(MEMINFO)).toBe(1024);
  });

  it('returns -1 for empty input', () => {
    expect(parseMemAvailable("")).toBe(-1);
  });

  it.each([null, undefined])('returns -1 for falsy input: %s', (input) => {
    expect(parseMemAvailable(input)).toBe(-1);
  });

  it('returns -1 when MemAvailable line is missing', () => {
    expect(parseMemAvailable("MemTotal:  3791264 kB\nMemFree:  142536 kB")).toBe(-1);
  });

  it('floors to integer MB', () => {
    // 999 kB = 0.975 MB -> floors to 0
    expect(parseMemAvailable("MemAvailable:      999 kB")).toBe(0);
  });
});

describe('parseContainerCount', () => {
  it('counts non-empty lines', () => {
    expect(parseContainerCount("container1\ncontainer2\ncontainer3")).toBe(3);
  });

  it('returns 0 for empty string', () => {
    expect(parseContainerCount("")).toBe(0);
  });

  it.each([null, undefined])('returns 0 for falsy input: %s', (input) => {
    expect(parseContainerCount(input)).toBe(0);
  });

  it('ignores blank lines', () => {
    expect(parseContainerCount("container1\n\n\ncontainer2\n")).toBe(2);
  });

  it('returns 1 for single container', () => {
    expect(parseContainerCount("my-container")).toBe(1);
  });
});
