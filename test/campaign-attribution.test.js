const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { APP_STORE_BASE, buildAppStoreUrl, buildClickPayload, createClickId, validateCampaignParams } = require("../campaign-attribution.js");

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

test("tracks only a trusted App Store button tap without delaying navigation", () => {
  const page = fs.readFileSync(path.join(__dirname, "../go/index.html"), "utf8");
  assert.match(page, /keepalive:\s*true/);
  assert.doesNotMatch(page, /location\.(replace|assign)|setTimeout\(redirect|\.finally\([^)]*redirect/);
  assert.match(page, /link\.href = destination/);
  assert.match(page, /link\.addEventListener\("click"/);
  assert.match(page, /!event\.isTrusted/);
  assert.match(page, /if \(tracked/);
  const listenerAt = page.indexOf('link.addEventListener("click"');
  const fetchAt = page.indexOf('fetch("https://api.obedstudio.dev/v1/campaign-clicks"');
  assert.ok(listenerAt >= 0 && fetchAt > listenerAt, "tracking must be inside the click handler, never on page load");
  assert.doesNotMatch(page.slice(0, listenerAt), /campaign-clicks/);
});

test("creates a valid UUID when randomUUID is missing", () => {
  const cryptoApi = {
    getRandomValues(bytes) {
      for (let index = 0; index < bytes.length; index += 1) bytes[index] = index;
      return bytes;
    }
  };
  assert.match(createClickId(cryptoApi), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(createClickId(null), null);
});

test("the Instagram alias forwards to the tracked campaign URL without its own analytics", () => {
  const page = fs.readFileSync(path.join(__dirname, "../ig/index.html"), "utf8");
  const campaignUrl = "https://provechito.app/go/?pt=129032855&ct=pvc26igtinga01&utm_id=pvc26_install_macrotrackers_instagram_202608_01&utm_source=instagram&utm_medium=organic&utm_campaign=real-food-macros-aug&utm_content=bio_tinga_macroproof_download_v01&utm_term=macrotrackers";
  const escapedCampaignUrl = campaignUrl.replaceAll("&", "&amp;");

  assert.ok(page.includes(`http-equiv="refresh" content="0; url=${escapedCampaignUrl}"`));
  assert.ok(page.includes(`href="${escapedCampaignUrl}"`));
  assert.doesNotMatch(page, /campaign-clicks|campaign-attribution\.js|apps\.apple\.com/);
});

test("cross-platform aliases have unique immutable attribution identities", () => {
  const aliases = [
    ["fb", "pvc26fbtinga01", "pvc26_install_macrotrackers_facebook_202608_01", "utm_source=facebook"],
    ["tt", "pvc26tttinga01", "pvc26_install_macrotrackers_tiktok_202608_01", "utm_source=tiktok"],
    ["yt", "pvc26yttinga01", "pvc26_install_macrotrackers_youtube_202608_01", "utm_source=youtube"]
  ];
  const pages = aliases.map(([pathName, ct, utmId, source]) => {
    const page = fs.readFileSync(path.join(__dirname, `../${pathName}/index.html`), "utf8");
    assert.ok(page.includes(`ct=${ct}`));
    assert.ok(page.includes(`utm_id=${utmId}`));
    assert.ok(page.includes(source));
    assert.doesNotMatch(page, /campaign-clicks|campaign-attribution\.js|apps\.apple\.com/);
    return page;
  });
  assert.equal(new Set(pages).size, 3);
});

test("post-workout utility aliases are unique and cannot contaminate the Tinga campaign", () => {
  const aliases = [
    ["ig", "pvc26igpw40m01", "pvc26_install_postworkout40_instagram_202608_01", "utm_source=instagram", "reel_3mexicanmeals_40g_v01"],
    ["fb", "pvc26fbpw40m01", "pvc26_install_postworkout40_facebook_202608_01", "utm_source=facebook", "reel_3mexicanmeals_40g_v01"],
    ["yt", "pvc26ytpw40m01", "pvc26_install_postworkout40_youtube_202608_01", "utm_source=youtube", "short_3mexicanmeals_40g_v01"],
    ["tt", "pvc26ttpw40m01", "pvc26_install_postworkout40_tiktok_202608_01", "utm_source=tiktok", "video_3mexicanmeals_40g_v01"]
  ];
  const identities = aliases.map(([platform, ct, utmId, source, content]) => {
    const page = fs.readFileSync(path.join(__dirname, `../${platform}/postworkout40-01/index.html`), "utf8");
    assert.ok(page.includes(`ct=${ct}`));
    assert.ok(page.includes(`utm_id=${utmId}`));
    assert.ok(page.includes(source));
    assert.ok(page.includes(`utm_content=${content}`));
    assert.ok(page.includes("utm_campaign=postworkout-protein-aug"));
    assert.doesNotMatch(page, /tinga|real-food-macros-aug/i);
    assert.doesNotMatch(page, /campaign-clicks|campaign-attribution\.js|apps\.apple\.com/);
    return `${ct}:${utmId}`;
  });
  assert.equal(new Set(identities).size, 4);
});
