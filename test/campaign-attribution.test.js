const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { APP_STORE_BASE, buildAppStoreUrl, buildClickPayload, validateCampaignParams } = require("../campaign-attribution.js");

const valid = "?pt=1234567890&ct=igMealPrep_01&utm_id=pvc26_install_mealprep_instagram_01&utm_source=Instagram&utm_medium=Organic&utm_campaign=MealPrep&utm_content=Reel_01";

test("accepts and normalizes a complete campaign link", () => {
  const result = validateCampaignParams(valid);
  assert.equal(result.valid, true);
  assert.deepEqual(result.fields, {
    pt: "1234567890", ct: "igMealPrep_01", utm_id: "pvc26_install_mealprep_instagram_01",
    utm_source: "instagram", utm_medium: "organic", utm_campaign: "mealprep", utm_content: "reel_01"
  });
});

test("creates only the canonical App Store campaign URL", () => {
  const result = validateCampaignParams(valid);
  assert.equal(buildAppStoreUrl(result.fields), APP_STORE_BASE + "?pt=1234567890&ct=igMealPrep_01&mt=8");
});

test("builds the exact click contract and never includes pt", () => {
  const result = validateCampaignParams(valid);
  const payload = buildClickPayload(result.fields, "a8a8677e-714d-4d25-829d-9a1d7cb1d7a1");
  assert.deepEqual(payload, {
    click_id: "a8a8677e-714d-4d25-829d-9a1d7cb1d7a1",
    ct: "igMealPrep_01",
    utm_id: "pvc26_install_mealprep_instagram_01",
    utm_source: "instagram",
    utm_medium: "organic",
    utm_campaign: "mealprep",
    utm_content: "reel_01"
  });
  assert.equal(Object.hasOwn(payload, "pt"), false);
});

test("rejects missing required attribution fields", () => {
  assert.equal(validateCampaignParams("?pt=123&ct=pilot").valid, false);
});

test("rejects unsafe values, duplicate fields, and arbitrary parameters", () => {
  assert.equal(validateCampaignParams("?pt=123&ct=bad%20token&utm_id=x&utm_source=x&utm_medium=x&utm_campaign=x").valid, false);
  assert.equal(validateCampaignParams(valid + "&destination=https://evil.example").valid, false);
  assert.equal(validateCampaignParams(valid + "&ct=another").valid, false);
});

test("allows the click write to finish after the bounded redirect", () => {
  const page = fs.readFileSync(path.join(__dirname, "../go/index.html"), "utf8");
  assert.match(page, /keepalive:\s*true/);
  assert.doesNotMatch(page, /AbortController/);
});
