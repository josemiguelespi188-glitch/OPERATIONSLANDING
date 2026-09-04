#!/usr/bin/env node
/**
 * Provisions Custom Fields on the AxisKey Operations Hub's ClickUp Lists
 * for the forms that don't have the current field set wired up yet:
 * Refund Request (brand new), Investor Documentation Request (brand new
 * page, existing list), and Side Letter / Investor Information Update /
 * Account Maintenance / Request an AxisKey Report (all re-provisioned
 * after their field sets changed). See CLAUDE.md for the full slug ->
 * List ID table. This only fills in each one's missing fields, never
 * creates a List — every List already exists.
 *
 * Idempotent: re-running it skips any Custom Field that already exists
 * (matched by name), so it's safe to run more than once (e.g. after
 * fixing an error on one field). It does NOT update an existing field's
 * options — see the axiskey-report-request comment below for the one
 * field that needs a manual ClickUp edit instead.
 *
 * Usage:
 *   CLICKUP_API_TOKEN=pk_xxx node scripts/clickup/provision-forms.mjs
 *   (or pass the token as the first argument)
 *
 * At the end it prints ready-to-paste snippets for:
 *   - CLICKUP_LIST_ID_MAP (.env)
 *   - CUSTOM_FIELD_MAP + ATTACHMENT_FIELD_MAP (lib/integrations/clickup.ts)
 * Paste the output back so those can be wired into the codebase.
 */

const TOKEN = process.env.CLICKUP_API_TOKEN || process.argv[2];
if (!TOKEN) {
  console.error("Missing token. Set CLICKUP_API_TOKEN or pass it as the first argument.");
  process.exit(1);
}

const API = "https://api.clickup.com/api/v2";

async function cu(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: TOKEN,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} -> ${res.status}: ${JSON.stringify(body)}`);
  }
  // ClickUp sometimes returns an error payload (e.g. {"err":"...","ECODE":"..."})
  // with a 200 status, which res.ok wouldn't catch on its own.
  if (body && typeof body === "object" && "err" in body) {
    throw new Error(`${options.method ?? "GET"} ${path} -> 200 with error body: ${JSON.stringify(body)}`);
  }
  return body;
}

// A known-good existing List ID (ira-funding-request) — used only to
// discover the "Axis Operations Hub" folder ID, so new lists land next to
// the existing 4 instead of requiring the folder ID to be hardcoded here.
const BOOTSTRAP_LIST_ID = "901112504693";

// Lists that already exist under the Axis Operations Hub folder (see
// CLAUDE.md for the full slug -> List ID table) — this script only fills
// in each one's missing custom fields, never creates a list.
// custom-request was removed from the Hub — deliberately not listed here.
const EXISTING_LISTS = {
  "refund-request": "901114418101",
  "side-letter-request": "901114320630",
  "investor-information-update": "901114375425",
  "account-maintenance-request": "901114375429",
  "document-request": "901114375430",
  "axiskey-report-request": "901114375435",
};

// No lists left to create — kept as an empty map (rather than removing
// the create-list code path below) in case a future form needs a brand
// new list.
const NEW_LISTS = {};

// name -> ClickUp custom field definition, per slug. Every list also gets
// an "Additional File" attachment field unless includeAttachment: false.
const FIELD_PLAN = {
  "refund-request": {
    fields: [
      { name: "Investor Email", type: "email" },
      { name: "Reason for Refund", type: "text" },
      { name: "Refund Amount", type: "number" },
    ],
    includeAttachment: true, // required on this form
  },
  "side-letter-request": {
    fields: [
      { name: "Order Number", type: "text" },
      { name: "Offering Name", type: "text" },
      {
        name: "Side Letter Type",
        type: "drop_down",
        options: ["Double Bonus Months", "Additional Annualized Return", "Fee Waiver", "Other"],
      },
      { name: "Note", type: "text" },
      { name: "Requester Email", type: "email" },
    ],
    includeAttachment: false, // no file upload field on the current spec
  },
  "investor-information-update": {
    fields: [
      { name: "Offering Name", type: "text" },
      { name: "Order Number", type: "text" },
      { name: "Note", type: "text" },
      { name: "Investor Email", type: "email" },
      { name: "Requester Email", type: "email" },
    ],
    includeAttachment: false,
  },
  "account-maintenance-request": {
    fields: [
      { name: "Offering Name", type: "text" },
      { name: "Note", type: "text" },
      { name: "Investor Email", type: "email" },
      { name: "Requester Email", type: "email" },
    ],
    includeAttachment: false,
  },
  "document-request": {
    fields: [
      { name: "Offering Name", type: "text" },
      {
        name: "Document Needed",
        type: "drop_down",
        options: [
          "Government ID",
          "Articles of Incorporation",
          "Trust Agreement",
          "Accreditation Letter",
          "Custodian Letter",
          "Operating Agreement",
          "Other",
        ],
      },
      { name: "Requester Email", type: "email" },
      { name: "Note", type: "text" },
    ],
    includeAttachment: false,
  },
  "axiskey-report-request": {
    fields: [
      { name: "Offering Name", type: "text" },
      { name: "Report Period", type: "text" },
      { name: "Note", type: "text" },
      { name: "Requester Email", type: "email" },
      // "Report Type" deliberately left out of this plan: it already
      // exists in ClickUp with the old option set (Distribution History,
      // etc.) and this script only creates a field once — it never
      // updates an existing one's options. Replace its options manually
      // in ClickUp with the new set (All Investors Accounts / All Active
      // Orders / All Completed Orders / Pending Orders / Orders Report /
      // Client Investment Report / Cap Table Report / Activity Summary
      // Report / Other), then add its field ID + new option IDs to
      // CUSTOM_FIELD_MAP by hand.
    ],
    includeAttachment: false,
  },
};

async function findFolderId() {
  const list = await cu(`/list/${BOOTSTRAP_LIST_ID}`);
  const folderId = list.folder?.id;
  if (!folderId) throw new Error(`Could not resolve folder id from list ${BOOTSTRAP_LIST_ID}`);
  console.log(`Folder: ${list.folder.name} (${folderId}) — space ${list.space?.name} (${list.space?.id})`);
  return folderId;
}

async function ensureList(folderId, name) {
  const folder = await cu(`/folder/${folderId}`);
  const existing = (folder.lists ?? []).find((l) => l.name === name);
  if (existing) {
    console.log(`  List "${name}" already exists -> ${existing.id}`);
    return existing.id;
  }
  const created = await cu(`/folder/${folderId}/list`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  console.log(`  Created list "${name}" -> ${created.id}`);
  return created.id;
}

async function ensureFields(listId, plan) {
  const existing = await cu(`/list/${listId}/field`);
  const byName = new Map((existing.fields ?? []).map((f) => [f.name, f]));

  const results = [];
  const allFields = [
    ...plan.fields,
    ...(plan.includeAttachment ? [{ name: "Additional File", type: "attachment" }] : []),
  ];

  for (const field of allFields) {
    const already = byName.get(field.name);
    if (already) {
      console.log(`    Field "${field.name}" already exists -> ${already.id} (${already.type})`);
      results.push({ ...field, id: already.id, options: already.type_config?.options });
      continue;
    }

    const body = { name: field.name, type: field.type };
    if (field.type === "drop_down") {
      body.type_config = { options: field.options.map((name) => ({ name })) };
    }

    try {
      const created = await cu(`/list/${listId}/field`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      // Defensive: extract the id from whichever shape ClickUp actually
      // returned — seen response shapes vary (bare object vs. nested
      // under "field"). Always log the raw body too, so a shape this
      // doesn't anticipate is still visible instead of silently printing
      // "undefined".
      const fieldId = created?.id ?? created?.field?.id ?? created?.field_id ?? null;
      if (!fieldId) {
        console.log(`    RAW response for "${field.name}": ${JSON.stringify(created)}`);
      }
      console.log(`    Created field "${field.name}" (${field.type}) -> ${fieldId ?? "no id in response, see RAW above"}`);
      results.push({
        ...field,
        id: fieldId,
        error: fieldId ? undefined : "created, but no id found in the response — see RAW line above",
        options: (created?.type_config ?? created?.field?.type_config)?.options,
      });
    } catch (err) {
      console.error(`    FAILED to create field "${field.name}": ${err.message}`);
      results.push({ ...field, id: null, error: err.message });
    }
  }

  return results;
}

async function main() {
  console.log("Resolving Axis Operations Hub folder...");
  const folderId = await findFolderId();

  const listIds = { ...EXISTING_LISTS };
  const fieldResults = {};

  for (const [slug, listId] of Object.entries(EXISTING_LISTS)) {
    console.log(`\n${slug} (existing list ${listId})`);
    fieldResults[slug] = await ensureFields(listId, FIELD_PLAN[slug]);
  }

  for (const [slug, name] of Object.entries(NEW_LISTS)) {
    console.log(`\n${slug}`);
    const listId = await ensureList(folderId, name);
    listIds[slug] = listId;
    fieldResults[slug] = await ensureFields(listId, FIELD_PLAN[slug]);
  }

  console.log("\n\n================ RESULTS — paste these back to Claude ================\n");

  console.log("--- CLICKUP_LIST_ID_MAP (merge into your existing one) ---");
  console.log(JSON.stringify(listIds, null, 2));

  console.log("\n--- Field IDs per list (name -> id, type, [dropdown option ids]) ---");
  for (const [slug, fields] of Object.entries(fieldResults)) {
    console.log(`\n${slug}:`);
    for (const f of fields) {
      const opts = f.options ? ` options: ${JSON.stringify(f.options.map((o) => ({ name: o.name, id: o.id })))}` : "";
      console.log(`  ${f.name} (${f.type}) -> ${f.id ?? "FAILED: " + f.error}${opts}`);
    }
  }

  console.log("\n=========================================================================\n");
}

main().catch((err) => {
  console.error("\nProvisioning failed:", err.message);
  process.exit(1);
});
