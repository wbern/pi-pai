import express from "express";
import { execSync, exec } from "child_process";

const app = express();
const PORT = 3100;
const BEARER_TOKEN = "tmux-local-dev";

app.use(express.json());

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", timeout: 30000 }).trim();
  } catch (e) {
    throw new Error(e.stderr || e.message);
  }
}

const TOOLS = [
  {
    name: "list_sessions",
    description: "List all active tmux windows in the Claude session",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "spawn_session",
    description: "Spawn a new Claude project session. Can clone repos, run tasks, or start blank sessions.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Git URL to clone (e.g., github.com/user/repo)" },
        instruction: { type: "string", description: "Task or instructions for Claude" },
        window_name: { type: "string", description: "Custom window name (auto-generated if not provided)" }
      },
      required: []
    }
  },
  {
    name: "kill_session",
    description: "Kill a tmux window by name or index",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "Window name or index to kill" }
      },
      required: ["target"]
    }
  },
  {
    name: "end_session",
    description: "End a Claude session by window name. Use list_sessions first to find window names.",
    inputSchema: {
      type: "object",
      properties: {
        window: { type: "string", description: "Window name from list_sessions" }
      },
      required: ["window"]
    }
  }
];

const toolHandlers = {
  list_sessions: async () => {
    try {
      const output = run(`tmux list-windows -t main -F "#{window_index}: #{window_name}"`);
      return { content: [{ type: "text", text: output || "No windows found" }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  },

  spawn_session: async ({ repo, instruction, window_name }) => {
    // Build prompt based on inputs
    let prompt = "";
    if (repo && instruction) {
      prompt = `Clone ${repo}, then ${instruction}`;
    } else if (repo) {
      prompt = `Clone ${repo} and explore the codebase`;
    } else if (instruction) {
      prompt = instruction;
    }
    // else blank session

    // Determine window name
    let windowName = window_name;
    if (!windowName) {
      if (repo) {
        windowName = repo.split("/").pop().replace(".git", "");
      } else {
        windowName = `session-${Date.now()}`;
      }
    }

    // Escape for shell
    const escapedPrompt = prompt.replace(/'/g, "'\\''");
    const escapedWindow = windowName.replace(/'/g, "'\\''");

    // Use bash -l for login shell (loads docker group, nvm, PATH, etc.)
    const cmd = `bash -l -c '${process.env.HOME}/claude-sandbox.sh --spawn "${escapedPrompt}" "${escapedWindow}"'`;

    try {
      const result = await new Promise((resolve, reject) => {
        exec(cmd, { timeout: 600000 }, (err, stdout, stderr) => {
          if (err) reject(new Error(stderr || err.message));
          else resolve(stdout);
        });
      });
      console.log("Spawned:", result);
      return { content: [{ type: "text", text: `Spawned "${windowName}". Use list_sessions to see all windows.` }] };
    } catch (e) {
      console.error("Spawn error:", e.message);
      return { content: [{ type: "text", text: `Failed to spawn "${windowName}": ${e.message}` }], isError: true };
    }
  },

  kill_session: async ({ target }) => {
    try {
      run(`tmux kill-window -t "main:${target}"`);
      return { content: [{ type: "text", text: `Killed window: ${target}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  },

  end_session: async ({ window }) => {
    try {
      run(`tmux kill-window -t "main:${window}"`);
      return { content: [{ type: "text", text: `Session "${window}" ended.` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
};

function validateAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${BEARER_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

async function handleJsonRpc(request) {
  const { method, params, id } = request;

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0", id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "tmux-control-plane", version: "1.0.0" }
        }
      };
    case "notifications/initialized":
      return null;
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
    case "tools/call":
      const { name, arguments: args } = params;
      const handler = toolHandlers[name];
      if (!handler) {
        return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${name}` } };
      }
      const result = await handler(args || {});
      return { jsonrpc: "2.0", id, result };
    default:
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}

app.post("/mcp", validateAuth, async (req, res) => {
  try {
    const response = await handleJsonRpc(req.body);
    if (response === null) return res.status(202).end();
    res.json(response);
  } catch (e) {
    res.status(500).json({ jsonrpc: "2.0", id: req.body?.id, error: { code: -32603, message: e.message } });
  }
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`tmux-control-plane running on http://0.0.0.0:${PORT}/mcp`);
});
