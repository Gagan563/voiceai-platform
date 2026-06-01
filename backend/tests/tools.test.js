const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  OUTPUT_DIR,
  clearWorkspace,
  executeTool,
} = require("../services/tools");

test("write_file and read_file round trip through the output workspace", async () => {
  clearWorkspace();

  const writeResult = await executeTool("write_file", {
    filename: "notes/hello.txt",
    content: "hello from tools",
  });

  assert.equal(writeResult.success, true);
  assert.equal(
    fs.existsSync(path.join(OUTPUT_DIR, "notes", "hello.txt")),
    true
  );

  const readResult = await executeTool("read_file", {
    filename: "notes/hello.txt",
  });

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
  });

  assert.equal(result.success, false);
  assert.match(result.error, /escapes the output workspace/i);
});

test("unknown tools return a structured error", async () => {
  const result = await executeTool("missing_tool", {});

  assert.equal(result.success, false);
  assert.match(result.error, /unknown tool/i);
});
