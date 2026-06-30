const assert = require("node:assert/strict");
const test = require("node:test");

const chatRouter = require("../routes/chat");

test("plan enrichment keeps fallback string-only", () => {
  const [objectFallback, emptyFallback, stringFallback] = chatRouter._enrichPlanSteps(
    [
      { fallback: { message: "retry later" } },
      { fallback: "   " },
      { fallback: "Retry with a smaller request" },
    ],
    { confidence: 0.82 }
  );

  assert.equal(objectFallback.fallback, "Ask for confirmation and retry this step");
  assert.equal(emptyFallback.fallback, "Ask for confirmation and retry this step");
  assert.equal(stringFallback.fallback, "Retry with a smaller request");
});
