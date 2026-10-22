import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POLICY, evolvePolicy, normalizePolicy, routePrompt } from "../src/policy.js";

test("routes explicit domain requests", () => {
  assert.equal(routePrompt("Validate this QASM circuit", DEFAULT_POLICY).id, "qasm");
  assert.equal(routePrompt("Export the episode as JSON", DEFAULT_POLICY).id, "export");
  assert.equal(routePrompt("Ask Puter to generate an answer", DEFAULT_POLICY).id, "puter");
});

test("unknown requests fall back safely", () => {
  assert.equal(routePrompt("Mystery operation", DEFAULT_POLICY).id, "assist");
});

test("policy evolves within bounded limits", () => {
  const episodes = Array.from({ length: 100 }, (_, index) => ({
    prompt: index % 2 ? "quantum circuit qubit" : "export episode json",
    expectedRoute: index % 2 ? "qasm" : "export"
  }));
  const evolved = evolvePolicy(DEFAULT_POLICY, episodes);
  assert.equal(evolved.version, 2);
  assert.ok(evolved.weights.keyword >= DEFAULT_POLICY.weights.keyword);
  assert.ok(evolved.weights.keyword <= DEFAULT_POLICY.limits.keyword.max);
  assert.deepEqual(normalizePolicy({ weights: { keyword: 99, signal: -1 } }).weights.keyword, DEFAULT_POLICY.limits.keyword.max);
});
