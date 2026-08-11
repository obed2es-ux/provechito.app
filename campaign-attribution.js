(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ProvechitoCampaign = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const APP_STORE_BASE = "https://apps.apple.com/app/apple-store/id6782473761";
  const REQUIRED_FIELDS = ["pt", "ct", "utm_id", "utm_source", "utm_medium", "utm_campaign"];
  const OPTIONAL_FIELDS = ["utm_content", "utm_term"];
  const ALLOWED_FIELDS = new Set([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]);
  const UTM_PATTERN = /^[a-z0-9][a-z0-9._~-]{0,119}$/;
  const CT_PATTERN = /^[A-Za-z0-9_-]{1,30}$/;
  const PT_PATTERN = /^\d{1,20}$/;

  function normalizeUtm(value) {
    return String(value || "").trim().toLowerCase();
  }

  function validateCampaignParams(search) {
    const params = new URLSearchParams(search || "");
    const record = {};
    const errors = [];

    for (const [key] of params) {
      if (!ALLOWED_FIELDS.has(key)) errors.push("campo_no_permitido");
      if (params.getAll(key).length !== 1) errors.push("campo_duplicado");
    }

    for (const field of REQUIRED_FIELDS) {
      const value = params.get(field);
      if (!value) {
        errors.push("campo_requerido");
        continue;
      }
      if (field === "pt") {
        if (!PT_PATTERN.test(value)) errors.push("pt_invalido");
        else record.pt = value;
      } else if (field === "ct") {
        if (!CT_PATTERN.test(value)) errors.push("ct_invalido");
        else record.ct = value;
      } else {
        const normalized = normalizeUtm(value);
        if (!UTM_PATTERN.test(normalized)) errors.push("utm_invalido");
        else record[field] = normalized;
      }
    }

    for (const field of OPTIONAL_FIELDS) {
      const value = params.get(field);
      if (value === null) continue;
      const normalized = normalizeUtm(value);
      if (!UTM_PATTERN.test(normalized)) errors.push("utm_invalido");
      else record[field] = normalized;
    }

    return errors.length ? { valid: false, errors: [...new Set(errors)] } : { valid: true, fields: record };
  }

  function buildAppStoreUrl(fields) {
    const url = new URL(APP_STORE_BASE);
    url.searchParams.set("pt", fields.pt);
    url.searchParams.set("ct", fields.ct);
    url.searchParams.set("mt", "8");
    return url.toString();
  }

  function buildClickPayload(fields, clickId) {
    const payload = {
      click_id: clickId,
      ct: fields.ct,
      utm_id: fields.utm_id,
      utm_source: fields.utm_source,
      utm_medium: fields.utm_medium,
      utm_campaign: fields.utm_campaign
    };
    for (const field of OPTIONAL_FIELDS) {
      if (fields[field]) payload[field] = fields[field];
    }
    return payload;
  }

  return { APP_STORE_BASE, validateCampaignParams, buildAppStoreUrl, buildClickPayload };
});
