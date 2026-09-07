#!/usr/bin/env node
/**
 * Read-only audit: lists every Custom Field that actually exists today on
 * each of the 9 AxisKey Operations Hub ClickUp Lists, exactly as ClickUp
 * reports them (real name + real id + type + dropdown options, if any).
 *
 * Unlike provision-forms.mjs, this NEVER creates or modifies anything —
 * it only does GET requests — so it's the safe way to double check every
 * field's literal ClickUp name against lib/formSpecs/<slug>.ts and
 * CUSTOM_FIELD_MAP in lib/integrations/clickup.ts without any risk of
 * accidentally creating a duplicate field from a name mismatch.
 *
 * Usage:
 *   CLICKUP_API_TOKEN=pk_xxx node scripts/clickup/audit-fields.mjs
 *   (or pass the token as the first argument)
 */

const TOKEN = process.env.CLICKUP_API_TOKEN || process.argv[2];
if (!TOKEN) {
  console.error("Missing token. Set CLICKUP_API_TOKEN or pass it as the first argument.");
  process.exit(1);
}
if (TOKEN === "pk_xxx") {
  console.error('That\'s the literal placeholder "pk_xxx" from the example command, not a real token. Replace it with your actual ClickUp API token (Settings -> Apps -> API Token).');
  process.exit(1);
}

const API = "https://api.clickup.com/api/v2";

async function cu(path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: TOKEN } });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`GET ${path} -> ${res.status}: ${JSON.stringify(body)}`);
  }
  if (body && typeof body === "object" && "err" in body) {
    throw new Error(`GET ${path} -> 200 with error body: ${JSON.stringify(body)}`);
  }
  return body;
}

// See CLAUDE.md for the full slug -> List ID table.
const LISTS = {
  "title-transfer-request": "901114002885",
  "redemption-request": "901114014583",
  "ira-funding-request": "901112504693",
  "refund-request": "901114418101",
  "side-letter-request": "901114320630",
  "investor-information-update": "901114375425",
  "account-maintenance-request": "901114375429",
  "document-request": "901114375430",
  "axiskey-report-request": "901114375435",
};

async function main() {
  console.log("\n================ LIVE CLICKUP FIELDS — paste this whole block back to Claude ================\n");

  for (const [slug, listId] of Object.entries(LISTS)) {
    console.log(`${slug} (list ${listId}):`);
    try {
      const { fields } = await cu(`/list/${listId}/field`);
      for (const f of fields ?? []) {
        const opts = f.type_config?.options?.length
          ? ` options: ${JSON.stringify(f.type_config.options.map((o) => ({ name: o.name, id: o.id })))}`
          : "";
        console.log(`  "${f.name}" (${f.type}) -> ${f.id}${opts}`);
      }
    } catch (err) {
      console.log(`  FAILED to fetch fields: ${err.message}`);
    }
    console.log("");
  }

  console.log("=================================================================================================\n");
}

main().catch((err) => {
  console.error("\nAudit failed:", err.message);
  process.exit(1);
});
