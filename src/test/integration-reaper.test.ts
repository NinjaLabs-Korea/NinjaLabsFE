import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { alive, PIDS_FILE, readPids, reapStale, TMP_PREFIX, writePids } from "../../integration/lib/reaper.mjs";

// The integration harness (integration/run-all.mjs) leaves processes behind when it is SIGKILLed; the reaper must clean those
// runs up and must never touch the run of a live harness.
const roots: string[] = [];
const makeRoot = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reaper-test-"));
  roots.push(root);
  return root;
};
const makeRun = (root: string, name: string, patch: Record<string, unknown>) => {
  const dir = path.join(root, `${TMP_PREFIX}${name}`);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, PIDS_FILE), JSON.stringify({ groups: [], ...patch }));
  return dir;
};
const deadPid = () => {
  const child = spawn(process.execPath, ["-e", "0"]);
  return new Promise<number>((resolve) => child.on("exit", () => resolve(child.pid as number)));
};

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("integration reaper", () => {
  it("deletes the dir of a dead harness and kills its recorded process group", async () => {
    const root = makeRoot();
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: true, stdio: "ignore" });
    child.unref();
    const dir = makeRun(root, "dead", { harnessPid: await deadPid(), groups: [child.pid] });
    expect(alive(child.pid as number)).toBe(true);

    expect(reapStale({ tmp: root })).toEqual([dir]);
    expect(fs.existsSync(dir)).toBe(false);
    await new Promise((r) => setTimeout(r, 200));
    expect(alive(child.pid as number)).toBe(false);
  });

  it("leaves the run of a live harness alone", () => {
    const root = makeRoot();
    const dir = makeRun(root, "live", { harnessPid: process.pid });
    expect(reapStale({ tmp: root })).toEqual([]);
    expect(fs.existsSync(dir)).toBe(true);
  });

  it("ignores unrelated dirs and fresh dirs that have no pids file yet", () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, "something-else"));
    const fresh = path.join(root, `${TMP_PREFIX}fresh`);
    fs.mkdirSync(fresh);
    expect(reapStale({ tmp: root })).toEqual([]);
    expect(fs.existsSync(fresh)).toBe(true);
  });

  it("keeps a dir marked kept on startup reaps, but removes it with includeKept (--reap)", async () => {
    const root = makeRoot();
    const dir = makeRun(root, "kept", { harnessPid: await deadPid(), kept: true });
    expect(reapStale({ tmp: root })).toEqual([]);
    expect(fs.existsSync(dir)).toBe(true);
    expect(reapStale({ tmp: root, includeKept: true })).toEqual([dir]);
    expect(fs.existsSync(dir)).toBe(false);
  });

  it("never signals a recycled pid that is not Postgres", async () => {
    const root = makeRoot();
    const bystander = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
    const dir = makeRun(root, "pgpid", { harnessPid: await deadPid() });
    fs.mkdirSync(path.join(dir, "pg"));
    fs.writeFileSync(path.join(dir, "pg", "postmaster.pid"), `${bystander.pid}\n`);
    try {
      reapStale({ tmp: root });
      await new Promise((r) => setTimeout(r, 200));
      expect(alive(bystander.pid as number)).toBe(true);
    } finally {
      bystander.kill("SIGKILL");
    }
  });

  it("merges pid records instead of replacing them", () => {
    const dir = makeRun(makeRoot(), "merge", { harnessPid: 1, pgData: "/x/pg" });
    writePids(dir, { groups: [42] });
    expect(readPids(dir)).toMatchObject({ pgData: "/x/pg", groups: [42] });
  });
});
