// Bounded ownership and teardown for one local run.
//
// A run registers only the resources it creates: a temporary directory, an
// owned child process group, an HTTP server or a timer. Teardown closes those
// exact handles in reverse order. It never scans for or kills unowned work.
// Directories are accepted only under the operating system's temporary root.
import { realpathSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";

export const ownedRunSchema = "composer.owned-resources/1";

export class OwnedResourceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "OwnedResourceError";
    this.code = code;
  }
}

function within(root, path) {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith(".." + sep) && rel !== ".." && !isAbsolute(rel));
}

function signal(child, group, name) {
  try {
    if (group) process.kill(-child.pid, name);
    else child.kill(name);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolveExit) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("exit", onExit);
      resolveExit(value);
    };
    const onExit = () => finish(true);
    child.once("exit", onExit);
    const timer = setTimeout(() => finish(false), Math.max(1, timeoutMs));
    timer.unref?.();
  });
}

async function stopProcess(entry, { graceMs, timeoutMs }) {
  const child = entry.handle;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  signal(child, entry.group, "SIGTERM");
  if (await waitForExit(child, graceMs)) return;
  signal(child, entry.group, "SIGKILL");
  if (!(await waitForExit(child, Math.max(1000, timeoutMs - graceMs))))
    throw new OwnedResourceError(
      "process-stuck",
      "Owned process " + child.pid + " did not exit within the teardown bound.",
    );
}

function closeServer(server, timeoutMs) {
  return new Promise((resolveClose, rejectClose) => {
    const timer = setTimeout(() => {
      try {
        server.closeAllConnections?.();
      } catch {
        // The bounded rejection below is the useful result.
      }
      rejectClose(
        new OwnedResourceError(
          "server-timeout",
          "Owned server did not close within the teardown bound.",
        ),
      );
    }, Math.max(1, timeoutMs));
    timer.unref?.();
    try {
      server.close((error) => {
        clearTimeout(timer);
        if (error && error.code !== "ERR_SERVER_NOT_RUNNING") rejectClose(error);
        else resolveClose();
      });
    } catch (error) {
      clearTimeout(timer);
      rejectClose(error);
    }
  });
}

/**
 * Create a run-scoped registry. `signal` belongs to this run; `report` is a
 * mutable, truthful record of what was released and what failed.
 */
export function createOwnedRun({
  label = "run",
  tempRoot = tmpdir(),
  graceMs = 750,
  teardownTimeoutMs = 5000,
} = {}) {
  if (!/^[a-z0-9][a-z0-9-]{0,48}$/.test(label))
    throw new OwnedResourceError(
      "invalid-label",
      "Owned run label must be a short lowercase identifier.",
    );
  const root = realpathSync(resolve(tempRoot));
  const controller = new AbortController();
  const entries = [];
  const report = {
    schema: ownedRunSchema,
    label,
    status: "open",
    reason: null,
    resources: [],
    failures: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  let closed = false;
  let teardownPromise = null;
  let signalHandlers = null;

  const register = (kind, id, handle, extra = {}) => {
    if (closed)
      throw new OwnedResourceError(
        "run-closed",
        "Cannot register " + kind + " after teardown started.",
      );
    const entry = { kind, id, state: "active", ...extra, handle };
    const record = { kind, id, state: "active", ...extra };
    entry.record = record;
    entries.push(entry);
    report.resources.push(record);
    return handle;
  };

  const run = {
    label,
    signal: controller.signal,
    report,
    /** Register a directory created by this run and return its real path. */
    directory(path, { id } = {}) {
      const actual = realpathSync(resolve(path));
      if (!within(root, actual))
        throw new OwnedResourceError(
          "directory-outside-temp-root",
          "Refusing to own a directory outside the selected temporary root.",
        );
      return register("directory", id ?? actual, actual);
    },
    /** Register an HTTP server created by this run. */
    server(server, { id } = {}) {
      if (!server || typeof server.close !== "function")
        throw new OwnedResourceError("invalid-server", "Owned server must expose close().");
      return register("server", id ?? "server", server);
    },
    /** Register an already-created child. Use group only for detached children. */
    process(child, { id, group = false } = {}) {
      if (!child || !Number.isSafeInteger(child.pid) || child.pid <= 0)
        throw new OwnedResourceError(
          "invalid-process",
          "Owned process must expose a positive PID.",
        );
      return register("process", id ?? String(child.pid), child, {
        group,
        pid: child.pid,
      });
    },
    /** Spawn a detached child whose exact process group belongs to this run. */
    spawn(command, args = [], options = {}) {
      const child = spawn(command, args, {
        ...options,
        detached: true,
        stdio: options.stdio ?? "ignore",
      });
      return run.process(child, { id: options.id, group: true });
    },
    /** Register a timer so it cannot outlive the run. */
    timer(timer, { id } = {}) {
      return register("timer", id ?? "timer", timer);
    },
    /** Wait that rejects when the run is aborted. */
    wait(ms) {
      return new Promise((resolveWait, rejectWait) => {
        const timer = setTimeout(() => {
          run.signal.removeEventListener("abort", onAbort);
          resolveWait();
        }, ms);
        timer.unref?.();
        const onAbort = () => {
          clearTimeout(timer);
          rejectWait(
            run.signal.reason instanceof Error
              ? run.signal.reason
              : new OwnedResourceError("aborted", "Owned run was cancelled."),
          );
        };
        if (run.signal.aborted) onAbort();
        else run.signal.addEventListener("abort", onAbort, { once: true });
      });
    },
    /** Explicit cancellation used by timeouts and signal handlers. */
    abort(reason) {
      if (!run.signal.aborted) controller.abort(reason);
    },
    /** Idempotent, bounded teardown in reverse registration order. */
    teardown({ reason = "complete", signal: receivedSignal = null } = {}) {
      if (teardownPromise) return teardownPromise;
      closed = true;
      report.status = "closing";
      report.reason = reason;
      report.signal = receivedSignal;
      teardownPromise = (async () => {
        for (const entry of [...entries].reverse()) {
          try {
            if (entry.kind === "timer") clearTimeout(entry.handle);
            else if (entry.kind === "server")
              await closeServer(entry.handle, teardownTimeoutMs);
            else if (entry.kind === "process")
              await stopProcess(entry, {
                graceMs,
                timeoutMs: teardownTimeoutMs,
              });
            else if (entry.kind === "directory")
              rmSync(entry.handle, { recursive: true, force: true });
            entry.state = "released";
            entry.record.state = "released";
          } catch (error) {
            entry.state = "failed";
            entry.record.state = "failed";
            report.failures.push({
              id: entry.id,
              kind: entry.kind,
              error: error?.message ?? String(error),
            });
          }
        }
        report.status = report.failures.length ? "incomplete" : "clean";
        report.finishedAt = new Date().toISOString();
        return report;
      })();
      return teardownPromise;
    },
    /** Install bounded SIGINT/SIGTERM cleanup. The callback runs before exit. */
    installSignalHandlers({ onSignal } = {}) {
      if (signalHandlers) return run;
      signalHandlers = new Map();
      for (const [name, code] of [
        ["SIGINT", 130],
        ["SIGTERM", 143],
      ]) {
        const handler = () => {
          run.abort(
            new OwnedResourceError("cancelled", "Owned run received " + name + "."),
          );
          void run
            .teardown({ reason: "signal", signal: name })
            .then(() => onSignal?.(report, name))
            .catch((error) => {
              process.stderr.write(
                "Owned run cleanup failed: " + (error?.message ?? error) + "\n",
              );
            })
            .finally(() => process.exit(code));
        };
        process.once(name, handler);
        signalHandlers.set(name, handler);
      }
      return run;
    },
    removeSignalHandlers() {
      if (!signalHandlers) return;
      for (const [name, handler] of signalHandlers) process.off(name, handler);
      signalHandlers = null;
    },
  };
  return run;
}

/**
 * Run a task with one owned registry and a bounded deadline. Cleanup runs on
 * success, failure, timeout and cancellation; the thrown timeout is explicit.
 */
export async function withOwnedResources(options, task) {
  if (typeof task !== "function")
    throw new OwnedResourceError("invalid-task", "withOwnedResources needs a task.");
  const { timeoutMs, onReport, ...runOptions } = options ?? {};
  const run = createOwnedRun(runOptions);
  let failure = null;
  let timedOut = false;
  let timer = null;
  run.installSignalHandlers();
  try {
    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        run.report.timeoutMs = timeoutMs;
        run.abort(
          new OwnedResourceError(
            "timeout",
            "Owned run exceeded its " + timeoutMs + " ms deadline.",
          ),
        );
        void run.teardown({ reason: "timeout" });
      }, timeoutMs);
      timer.unref?.();
    }
    return await task(run);
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    run.removeSignalHandlers();
    await run.teardown({
      reason: timedOut ? "timeout" : failure ? "failure" : "complete",
    });
    onReport?.(run.report);
  }
}
