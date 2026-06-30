const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  OUTPUT_DIR,
  clearWorkspace,
  executeTool,
} = require("../services/tools");

const TEST_USER_ID = "tools-test-user";

test("write_file and read_file round trip through the output workspace", async () => {
  clearWorkspace(TEST_USER_ID);

  const writeResult = await executeTool("write_file", {
    filename: "notes/hello.txt",
    content: "hello from tools",
  }, { userId: TEST_USER_ID });

  assert.equal(writeResult.success, true);
  assert.equal(
    fs.existsSync(path.join(OUTPUT_DIR, TEST_USER_ID, "notes", "hello.txt")),
    true
  );

  const readResult = await executeTool("read_file", {
    filename: "notes/hello.txt",
  }, { userId: TEST_USER_ID });

  assert.equal(readResult.success, true);
  assert.equal(readResult.content, "hello from tools");
});

test("search_web rejects an empty query without network access", async () => {
  const result = await executeTool("search_web", { query: "   " });

  assert.equal(result.success, false);
  assert.match(result.error, /query is required/i);
});

test("read_file rejects paths outside the output workspace", async () => {
  const result = await executeTool("read_file", {
    filename: "../package.json",
  }, { userId: TEST_USER_ID });

  assert.equal(result.success, false);
  assert.match(result.error, /escapes the output workspace/i);
});

test("clearWorkspace fails closed without a user id", () => {
  assert.throws(() => clearWorkspace(), /without a user id/i);
});

test("run_terminal rejects cwd outside the user workspace", async () => {
  const result = await executeTool("run_terminal", {
    command: "node --version",
    cwd: "..",
  }, { userId: TEST_USER_ID });

  assert.equal(result.success, false);
  assert.match(result.error, /cwd must stay inside/i);
});

test("unknown tools return a structured error", async () => {
  const result = await executeTool("missing_tool", {});

  assert.equal(result.success, false);
  assert.match(result.error, /unknown tool/i);
});
