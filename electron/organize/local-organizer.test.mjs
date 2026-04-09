import assert from "node:assert/strict";
import test from "node:test";
import { createLocalOrganizer } from "./local-organizer.mjs";

test("local organizer polishes rough memo text deterministically", async () => {
  const organizer = createLocalOrganizer();

  const result = await organizer.organize({
    intent: "polish",
    body: "  call procurement after lunch \nask for revised timeline  "
  });

  assert.deepEqual(result, {
    intent: "polish",
    original: "call procurement after lunch\nask for revised timeline",
    suggested: "Call procurement after lunch.\nAsk for revised timeline.",
    summary: "Polished spacing, casing, and sentence endings for a cleaner draft."
  });
});

test("local organizer rewrites text into a polite tone", async () => {
  const organizer = createLocalOrganizer();

  const result = await organizer.organize({
    intent: "polite",
    body: "send the updated agenda\nafter that call the vendor"
  });

  assert.equal(result.intent, "polite");
  assert.equal(
    result.suggested,
    "Please send the updated agenda.\nPlease after that call the vendor."
  );
  assert.equal(result.summary, "Converted the memo into a more polite, send-ready draft.");
});

test("local organizer returns an empty suggestion for blank input", async () => {
  const organizer = createLocalOrganizer();

  const result = await organizer.organize({
    intent: "polish",
    body: "   \n"
  });

  assert.equal(result.suggested, "");
  assert.equal(result.summary, "Add some memo content before running organize.");
});

test("local organizer rejects unsupported intents", async () => {
  const organizer = createLocalOrganizer();

  await assert.rejects(
    organizer.organize({
      intent: "summarize",
      body: "hello"
    }),
    /Unsupported organize intent/
  );
});
