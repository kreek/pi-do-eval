import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EvalServer } from "../src/server.js";

const tempDirs: string[] = [];
const servers: EvalServer[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-do-eval-server-"));
  tempDirs.push(dir);
  return dir;
}

function getPort(): number {
  return 10000 + Math.floor(Math.random() * 50000);
}

function httpGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      })
      .on("error", reject);
  });
}

function sseCollect(url: string, count: number, timeoutMs = 3000): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const events: unknown[] = [];
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`SSE timeout: got ${events.length}/${count} events`));
    }, timeoutMs);

    const req = http.get(url, (res) => {
      let buffer = "";
      res.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const block of lines) {
          const match = block.match(/^data: (.+)$/m);
          const payload = match?.[1];
          if (payload) {
            events.push(JSON.parse(payload));
            if (events.length >= count) {
              clearTimeout(timer);
              req.destroy();
              resolve(events);
            }
          }
        }
      });
    });
    req.on("error", (err) => {
      if (events.length >= count) return;
      clearTimeout(timer);
      reject(err);
    });
  });
}

/** Collect all SSE events replayed within a time window. */
function sseCollectAll(url: string, waitMs = 500): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const events: unknown[] = [];
    const req = http.get(url, (res) => {
      let buffer = "";
      res.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const block of lines) {
          const match = block.match(/^data: (.+)$/m);
          const payload = match?.[1];
          if (payload) events.push(JSON.parse(payload));
        }
      });
    });
    req.on("error", (err) => {
      if (events.length > 0) return; // destroyed after timeout
      reject(err);
    });
    setTimeout(() => {
      req.destroy();
      resolve(events);
    }, waitMs);
  });
}

function rawHttpRequest(port: number, rawPath: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: rawPath, method: "GET" }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

afterEach(() => {
  for (const s of servers.splice(0)) s.stop();
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("EvalServer", () => {
  it("serves viewer.html at /", async () => {
    const dir = makeTempDir();
    const port = getPort();
    const server = new EvalServer(dir, port);
    servers.push(server);
    server.start();

    // Give server time to start
    await new Promise((r) => setTimeout(r, 100));

    const { status, body } = await httpGet(`http://localhost:${port}/`);
    expect(status).toBe(200);
    expect(body).toContain("Pi, do Eval");
  });

  it("serves viewer assets", async () => {
    const dir = makeTempDir();
    const port = getPort();
    const server = new EvalServer(dir, port);
    servers.push(server);
    server.start();

    await new Promise((r) => setTimeout(r, 100));

    const css = await httpGet(`http://localhost:${port}/viewer.css`);
    const js = await httpGet(`http://localhost:${port}/viewer.js`);

    expect(css.status).toBe(200);
    expect(css.body).toContain(":root");
    expect(js.status).toBe(200);
    expect(js.body).toContain("createEvalViewer");
  });

  it("serves run files from /runs/", async () => {
    const dir = makeTempDir();
    const runsPath = path.join(dir, "runs", "test-run");
    fs.mkdirSync(runsPath, { recursive: true });
    fs.writeFileSync(path.join(runsPath, "report.json"), JSON.stringify({ meta: { trial: "test" } }));

    const port = getPort();
    const server = new EvalServer(dir, port);
    servers.push(server);
    server.start();
    await new Promise((r) => setTimeout(r, 100));

    const { status, body } = await httpGet(`http://localhost:${port}/runs/test-run/report.json`);
    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({ meta: { trial: "test" } });
  });

  it("returns 404 for missing files", async () => {
    const dir = makeTempDir();
    const port = getPort();
    const server = new EvalServer(dir, port);
    servers.push(server);
    server.start();
    await new Promise((r) => setTimeout(r, 100));

    const { status } = await httpGet(`http://localhost:${port}/runs/nope/report.json`);
    expect(status).toBe(404);
  });

  it("blocks path traversal", async () => {
    const dir = makeTempDir();
    const port = getPort();
    const server = new EvalServer(dir, port);
    servers.push(server);
    server.start();
    await new Promise((r) => setTimeout(r, 100));

    const { status } = await httpGet(`http://localhost:${port}/runs/../../../etc/passwd`);
    // Node's URL parser normalizes the path, so it resolves to /etc/passwd which is outside runs/
    // The server returns 403 if ".." is in the raw path, or 404 if the normalized path doesn't exist
    expect([403, 404]).toContain(status);
  });

  it("delivers SSE events and replays on connect", async () => {
    const dir = makeTempDir();
    fs.mkdirSync(path.join(dir, "runs"), { recursive: true });
    fs.writeFileSync(path.join(dir, "runs", "index.json"), JSON.stringify([]));

    const port = getPort();
    const server = new EvalServer(dir, port);
    servers.push(server);
    server.start();
    await new Promise((r) => setTimeout(r, 100));

    // Emit an event before connecting
    server.emit({
      type: "run_started",
      timestamp: Date.now(),
      dir: "test-run",
      trial: "example",
      variant: "default",
    });

    // Connect and collect: should get index_updated (from init) + run_started (replay)
    const events = await sseCollect(`http://localhost:${port}/events`, 2);
    expect(events).toHaveLength(2);
    expect((events[0] as { type: string }).type).toBe("index_updated");
    expect((events[1] as { type: string }).type).toBe("run_started");
  });

  // -- Issue: Unbounded event history -----------------------------------------

  it("prunes events before the latest index_updated on replay", async () => {
    const dir = makeTempDir();
    fs.mkdirSync(path.join(dir, "runs"), { recursive: true });
    fs.writeFileSync(path.join(dir, "runs", "index.json"), JSON.stringify([]));

    const port = getPort();
    const server = new EvalServer(dir, port);
    servers.push(server);
    server.start();
    await new Promise((r) => setTimeout(r, 100));

    // Emit 50 progress events (plus the initial index_updated from start)
    for (let i = 0; i < 50; i++) {
      server.emit({
        type: "run_progress",
        timestamp: Date.now(),
        dir: `run-${i}`,
        durationMs: i * 1000,
        toolCount: i,
        fileCount: 0,
      });
    }

    // Emit a fresh index_updated — everything before it is now stale
    server.emit({
      type: "index_updated",
      timestamp: Date.now(),
      runs: [
        {
          dir: "final",
          trial: "t",
          variant: "v",
          status: "completed",
          overall: 1,
          durationMs: 1000,
          startedAt: new Date().toISOString(),
          workerModel: "test",
        },
      ],
    });

    // Emit 3 more progress events after the snapshot
    for (let i = 0; i < 3; i++) {
      server.emit({
        type: "run_progress",
        timestamp: Date.now(),
        dir: `run-post-${i}`,
        durationMs: i * 100,
        toolCount: i,
        fileCount: 0,
      });
    }

    // A new client connecting should only get: latest index_updated + 3 post-events = 4
    const events = await sseCollectAll(`http://localhost:${port}/events`, 600);
    expect(events).toHaveLength(4);
    expect((events[0] as { type: string }).type).toBe("index_updated");
    expect((events[0] as { runs: unknown[] }).runs).toHaveLength(1);
  });

  // -- Issue: Path traversal hardening ----------------------------------------

  it("blocks path traversal via raw HTTP requests bypassing URL normalization", async () => {
    const dir = makeTempDir();
    fs.mkdirSync(path.join(dir, "runs"), { recursive: true });
    // Place a sensitive file adjacent to runs/
    fs.writeFileSync(path.join(dir, "secret.txt"), "top-secret-data");

    const port = getPort();
    const server = new EvalServer(dir, port);
    servers.push(server);
    server.start();
    await new Promise((r) => setTimeout(r, 100));

    // Raw request — Node's URL constructor normalizes this, but we verify
    // the server also does resolved-path validation as defense in depth
    const { status, body } = await rawHttpRequest(port, "/runs/../secret.txt");
    expect(body).not.toContain("top-secret-data");
    expect([403, 404]).toContain(status);
  });

  it("blocks access when resolved path escapes runs directory", async () => {
    const dir = makeTempDir();
    const runsPath = path.join(dir, "runs");
    fs.mkdirSync(runsPath, { recursive: true });

    // Create a symlink inside runs/ pointing outside
    const outsideDir = makeTempDir();
    fs.writeFileSync(path.join(outsideDir, "leaked.json"), JSON.stringify({ secret: true }));
    try {
      fs.symlinkSync(outsideDir, path.join(runsPath, "escape-link"));
    } catch {
      // Symlinks may not be available; skip test
      return;
    }

    const port = getPort();
    const server = new EvalServer(dir, port);
    servers.push(server);
    server.start();
    await new Promise((r) => setTimeout(r, 100));

    const { status, body } = await httpGet(`http://localhost:${port}/runs/escape-link/leaked.json`);
    expect(body).not.toContain("secret");
    expect([403, 404]).toContain(status);
  });

  // -- Issue: Polling fallback cleanup ----------------------------------------

  it("stop() prevents further polling events from being emitted", async () => {
    const dir = makeTempDir();
    fs.mkdirSync(path.join(dir, "runs"), { recursive: true });

    const port = getPort();
    const server = new EvalServer(dir, port);
    servers.push(server);
    server.start();
    await new Promise((r) => setTimeout(r, 100));

    // Record event count, then stop
    const countBefore = server.eventCount;
    server.stop();

    // Wait and verify no new events arrive (polling interval should be cleared)
    await new Promise((r) => setTimeout(r, 600));
    expect(server.eventCount).toBe(countBefore);
  });

  // -- Issue: run_completed overall score -------------------------------------

  it("run_completed from file watcher includes overall score", async () => {
    const dir = makeTempDir();
    const runDir = path.join(dir, "runs", "scored-run");
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(dir, "runs", "index.json"), JSON.stringify([]));

    const port = getPort();
    const server = new EvalServer(dir, port);
    servers.push(server);
    server.start();
    await new Promise((r) => setTimeout(r, 100));

    // Connect SSE first
    const eventsPromise = sseCollect(`http://localhost:${port}/events`, 2, 5000);

    // Write a report.json — the watcher should emit run_completed with the real score
    await new Promise((r) => setTimeout(r, 200));
    fs.writeFileSync(
      path.join(runDir, "report.json"),
      JSON.stringify({ meta: { status: "completed", durationMs: 5000 }, scores: { overall: 0.85 } }),
    );

    const events = await eventsPromise;
    const completed = events.find(
      (event): event is { type: "run_completed"; overall?: number } =>
        typeof event === "object" && event !== null && "type" in event && event.type === "run_completed",
    );
    expect(completed).toBeDefined();
    if (!completed) {
      throw new Error("Expected a run_completed event");
    }
    expect(completed.overall).toBe(0.85);
  });
});
