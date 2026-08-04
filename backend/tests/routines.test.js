/**
 * Routines service tests — using actual service behaviour.
 *
 * - createRoutine requires a valid prompt string (not name).
 * - recordRoutineRun does NOT include runCount — it stores in `runs` array.
 *
 * Uses Node's native test runner (node:test + node:assert).
 */
const assert = require("node:assert/strict");
const { describe, test, after } = require("node:test");
const {
  listRoutines,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  recordRoutineRun,
} = require("../services/routines");

// Store IDs created during tests so we can clean them up after
const createdIds = [];

describe("routines service", () => {
  after(() => {
    createdIds.forEach((id) => deleteRoutine(id));
  });

  test("createRoutine creates a routine with required fields", () => {
    const routine = createRoutine({ name: "Morning standup", prompt: "Summarise my tasks" });
    createdIds.push(routine.id);
    assert.ok(routine.id, "id should be defined");
    assert.equal(routine.name, "Morning standup");
    assert.equal(routine.prompt, "Summarise my tasks");
    assert.equal(routine.enabled, true);
  });

  test("createRoutine throws without a prompt", () => {
    // name is optional; prompt is the required field
    assert.throws(
      () => createRoutine({ name: "No prompt test" }),
      /prompt/i
    );
  });

  test("listRoutines returns all created routines", () => {
    const r1 = createRoutine({ name: "A", prompt: "do a" });
    const r2 = createRoutine({ name: "B", prompt: "do b" });
    createdIds.push(r1.id, r2.id);

    const list = listRoutines();
    const ids = list.map((r) => r.id);
    assert.ok(ids.includes(r1.id), "should contain r1");
    assert.ok(ids.includes(r2.id), "should contain r2");
  });

  test("updateRoutine modifies an existing routine", () => {
    const routine = createRoutine({ name: "Old name", prompt: "test prompt" });
    createdIds.push(routine.id);

    const updated = updateRoutine(routine.id, { name: "New name" });
    assert.equal(updated.name, "New name");
    assert.equal(updated.prompt, "test prompt");
  });

  test("updateRoutine returns null for non-existent id", () => {
    const result = updateRoutine("non-existent-id-000", { name: "X" });
    assert.equal(result, null);
  });

  test("deleteRoutine removes the routine", () => {
    const routine = createRoutine({ name: "Temp to delete", prompt: "delete me" });
    const before = listRoutines().map((r) => r.id);
    assert.ok(before.includes(routine.id), "should exist before delete");

    deleteRoutine(routine.id);
    const afterList = listRoutines().map((r) => r.id);
    assert.ok(!afterList.includes(routine.id), "should not exist after delete");
  });

  test("recordRoutineRun records lastRunAt and lastResult", () => {
    const routine = createRoutine({ name: "Test routine", prompt: "do a thing" });
    createdIds.push(routine.id);

    const updated = recordRoutineRun(routine.id, { status: "ok", message: "done" });
    assert.ok(updated.lastRunAt, "lastRunAt should be set");
    assert.equal(updated.lastResult.status, "ok");
    assert.equal(updated.lastResult.message, "done");
    // runs array contains the recorded entry
    assert.ok(updated.runs.length >= 1, "should have at least 1 run");
    assert.equal(updated.runs[0].result.status, "ok");
  });
});
