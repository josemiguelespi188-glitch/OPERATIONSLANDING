#!/usr/bin/env node
/**
 * Provisions ClickUp Lists + Custom Fields for the AxisKey Operations Hub
 * forms that don't have them yet (Side Letter gets fields added to its
 * existing list; Investor Information Update, Account Maintenance
 * Request, Custom Request, and Request an AxisKey Report get brand-new
 * Lists created under the same "Axis Operations Hub" folder as the
 * original 3 forms).
 *
 * Idempotent: re-running it skips any List or Custom Field that already
 * exists (matched by name), so it's safe to run more than once (e.g.
 * after fixing an error on one field).
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
  return body;
}

// A known-good existing List ID (ira-funding-request) — used only to
// discover the "Axis Operations Hub" folder ID, so new lists land next to
// the existing 4 instead of requiring the folder ID to be hardcoded here.
const BOOTSTRAP_LIST_ID = "901112504693";

// Lists that already exist — only their custom fields get filled in.
const EXISTING_LISTS = {
  "side-letter-request": "901114320630",
};

// Lists to create (name -> slug), if a list with that name isn't already
// in the folder.
const NEW_LISTS = {
  "investor-information-update": "Investor Information Update Requests",
  "account-maintenance-request": "Account Maintenance Requests",
  "custom-request": "Custom Requests",
  "axiskey-report-request": "AxisKey Report Requests",
};

// name -> ClickUp custom field definition, per slug. Every list also gets
// an "Additional File" attachment field unless includeAttachment: false.
const FIELD_PLAN = {
  "side-letter-request": {
    fields: [
      { name: "Order Number", type: "text" },
      { name: "Investor Account Name", type: "text" },
      { name: "Offering Name", type: "text" },
      { name: "Side Letter Terms", type: "text" },
      { name: "Issuer Approved Side Letter", type: "checkbox" },
      { name: "Note", type: "text" },
      { name: "Investor Email", type: "email" },
      { name: "Requester Email", type: "email" },
    ],
    includeAttachment: true,
  },
  "investor-information-update": {
    fields: [
      { name: "Investor Account Name", type: "text" },
      { name: "Offering Name", type: "text" },
      {
        name: "Update Type",
        type: "drop_down",
        options: ["Contact Info", "Mailing Address", "Banking Details", "Tax Information", "Other"],
      },
      { name: "Note", type: "text" },
      { name: "Investor Email", type: "email" },
      { name: "Requester Email", type: "email" },
    ],
    includeAttachment: true,
  },
  "account-maintenance-request": {
    fields: [
      { name: "Investor Account Name", type: "text" },
      {
        name: "Maintenance Type",
        type: "drop_down",
        options: ["Portal Access Issue", "Duplicate Account Merge", "Account Deactivation", "Login Reset", "Other"],
      },
      { name: "Note", type: "text" },
      { name: "Investor Email", type: "email" },
      { name: "Requester Email", type: "email" },
    ],
    includeAttachment: true,
  },
  "custom-request": {
    fields: [
      { name: "Investor Account Name", type: "text" },
      { name: "Offering Name", type: "text" },
      { name: "Note", type: "text" },
      { name: "Priority", type: "drop_down", options: ["Low", "Medium", "High"] },
      { name: "Investor Email", type: "email" },
      { name: "Requester Email", type: "email" },
    ],
    includeAttachment: true,
  },
  "axiskey-report-request": {
    fields: [
      { name: "Investor Account Name", type: "text" },
      { name: "Offering Name", type: "text" },
      {
        name: "Report Type",
        type: "drop_down",
        options: ["Distribution History", "Account Statement", "Tax Document Status", "Portfolio Summary", "Order History", "Other"],
      },
      { name: "Report Period", type: "text" },
      { name: "Note", type: "text" },
      { name: "Investor Email", type: "email" },
      { name: "Requester Email", type: "email" },
    ],
    includeAttachment: false, // spec #8 has no file upload field
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
      console.log(`    Created field "${field.name}" (${field.type}) -> ${created.id}`);
      results.push({ ...field, id: created.id, options: created.type_config?.options });
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
