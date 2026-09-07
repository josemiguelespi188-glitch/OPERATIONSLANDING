#!/usr/bin/env node
/**
 * One-time QA script: submits the exact prefill data from
 * AxisKey_Operations_Hub_TEST_Prefill_Data.md to all 9 live public
 * forms, using a real headless browser (so it goes through the actual
 * client-side file upload + /api/requests flow, not a raw API call).
 *
 * Requires Playwright with a Chromium browser installed. In a fresh
 * Codespace/machine:
 *   npm install --no-save playwright
 *   npx playwright install --with-deps chromium
 *   node scripts/test-all-forms.mjs > test-forms-output.txt 2>&1
 *
 * Target URL defaults to the production alias; override with:
 *   TEST_BASE_URL=https://your-preview-url.vercel.app node scripts/test-all-forms.mjs
 *
 * Paste the full console output back — it reports PASS/FAIL per form.
 * Cleans up its own dummy PDF file when done.
 */

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.TEST_BASE_URL || "https://operationslanding.vercel.app";

const DUMMY_PDF_PATH = path.join(process.cwd(), "test-dummy.pdf");
const DUMMY_PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Size 4/Root 1 0 R>>\n%%EOF",
  "utf-8"
);
fs.writeFileSync(DUMMY_PDF_PATH, DUMMY_PDF_BYTES);

// One entry per form. `fields` covers text/email/currency/textarea inputs
// (matched by their exact placeholder). `select` picks a dropdown option
// by visible label (every form has at most one <select>). `checkbox: true`
// checks the form's single checkbox, if any. `file: true` attaches the
// dummy PDF to the form's single file input, if any.
const FORMS = [
  {
    slug: "title-transfer-request",
    fields: [
      { placeholder: "Michael Dawson", value: "Test- Michael Dawson 2" },
      { placeholder: "sarah.dawson@email.com", value: "test.investor@axiskey.com" },
      { placeholder: "Meridian Property Holdings", value: "TEST Offering" },
      { placeholder: "10234", value: "TEST-0001" },
      { placeholder: "Sarah Dawson", value: "Test- Sarah Dawson" },
      { placeholder: "agent@axiskey.com", value: "test.requester@axiskey.com" },
    ],
    // "Investor Name" and "Current Account Name" share the placeholder
    // "Michael Dawson" on this form — submitForm() fills every field
    // matching a given placeholder, so listing it once covers both.
    file: true,
  },
  {
    slug: "redemption-request",
    fields: [
      { placeholder: "Michael Dawson", value: "Test- Michael Dawson 2" },
      { placeholder: "michael.dawson@email.com", value: "test.investor@axiskey.com" },
      { placeholder: "10234", value: "TEST-0002" },
      { placeholder: "Northgate Capital Fund", value: "TEST Offering" },
      { placeholder: "25,000", value: "100" },
      {
        placeholder: "Investor requesting partial redemption due to personal liquidity needs.",
        value: "This is a test submission, please disregard.",
      },
      { placeholder: "agent@axiskey.com", value: "test.requester@axiskey.com" },
    ],
    // "Investor Name" and "Investor Account Name" share the "Michael
    // Dawson" placeholder here too — same handling as above.
    select: "Full",
    checkbox: true,
    file: true,
  },
  {
    slug: "ira-funding-request",
    fields: [
      { placeholder: "Michael Dawson", value: "Test- Michael Dawson 2" },
      { placeholder: "Meridian Property Holdings", value: "TEST Offering" },
      { placeholder: "Sterling Custodial Trust", value: "Test Custodial Trust" },
      { placeholder: "50,000", value: "100" },
      { placeholder: "10234", value: "TEST-0003" },
      { placeholder: "agent@axiskey.com", value: "test.requester@axiskey.com" },
    ],
    file: true,
  },
  {
    slug: "refund-request",
    fields: [
      { placeholder: "Michael Dawson", value: "Test- Michael Dawson 2" },
      { placeholder: "michael.dawson@email.com", value: "test.investor@axiskey.com" },
      {
        placeholder: "Investor was double-charged during initial funding; duplicate payment to be refunded.",
        value: "This is a test submission, please disregard.",
      },
      { placeholder: "5,000", value: "1" },
    ],
    file: true,
  },
  {
    slug: "side-letter-request",
    fields: [
      { placeholder: "Michael Dawson", value: "Test- Michael Dawson 2" },
      { placeholder: "Meridian Property Holdings", value: "TEST Offering" },
      { placeholder: "10234", value: "TEST-0005" },
      {
        placeholder:
          "Investor is requesting a 2% bonus payment on top of standard distribution terms, per agreement with the issuer.",
        value: "This is a test submission, please disregard.",
      },
      { placeholder: "agent@axiskey.com", value: "test.requester@axiskey.com" },
    ],
    select: "Other",
  },
  {
    slug: "investor-information-update",
    fields: [
      { placeholder: "Michael Dawson", value: "Test- Michael Dawson 2" },
      { placeholder: "michael.dawson@email.com", value: "test.investor@axiskey.com" },
      { placeholder: "Meridian Property Holdings", value: "TEST Offering" },
      { placeholder: "10234", value: "TEST-0006" },
      {
        placeholder: "Update mailing address to reflect investor's new residence.",
        value: "This is a test submission, please disregard.",
      },
      { placeholder: "agent@axiskey.com", value: "test.requester@axiskey.com" },
    ],
  },
  {
    slug: "account-maintenance-request",
    fields: [
      { placeholder: "Michael Dawson", value: "Test- Michael Dawson 2" },
      { placeholder: "michael.dawson@email.com", value: "test.investor@axiskey.com" },
      { placeholder: "Meridian Property Holdings", value: "TEST Offering" },
      {
        placeholder: "Order was allocated to the wrong share class; needs to be corrected from Class A to Class C.",
        value: "This is a test submission, please disregard.",
      },
      { placeholder: "agent@axiskey.com", value: "test.requester@axiskey.com" },
    ],
  },
  {
    slug: "document-request",
    fields: [
      { placeholder: "Michael Dawson", value: "Test- Michael Dawson 2" },
      { placeholder: "Meridian Property Holdings", value: "TEST Offering" },
      { placeholder: "agent@axiskey.com", value: "test.requester@axiskey.com" },
      {
        placeholder: "Accreditation letter on file is expired; investor needs to provide an updated one dated within the last 90 days.",
        value: "This is a test submission, please disregard.",
      },
    ],
    select: "Government ID",
  },
  {
    slug: "axiskey-report-request",
    fields: [
      { placeholder: "Michael Dawson", value: "Test- Michael Dawson 2" },
      { placeholder: "Meridian Property Holdings", value: "TEST Offering" },
      { placeholder: "01/01/2026 - 06/30/2026", value: "01/01/2026 - 01/31/2026" },
      {
        placeholder: "Needs to include investor contact info and total committed capital per investor.",
        value: "This is a test submission, please disregard.",
      },
      { placeholder: "agent@axiskey.com", value: "test.requester@axiskey.com" },
    ],
    select: "All Investors Accounts",
  },
];

async function submitForm(page, form) {
  const url = `${BASE_URL}/forms/${form.slug}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

  for (const { placeholder, value } of form.fields) {
    const locator = page.getByPlaceholder(placeholder, { exact: true });
    const count = await locator.count();
    if (count === 0) {
      throw new Error(`No field found with placeholder "${placeholder}"`);
    }
    // Fill every matching field with this exact value (handles the
    // couple of forms where two questions share the same example
    // placeholder, e.g. two "Michael Dawson" fields).
    for (let i = 0; i < count; i++) {
      await locator.nth(i).fill(value);
    }
  }

  if (form.select) {
    await page.locator("select").selectOption({ label: form.select });
  }

  if (form.checkbox) {
    await page.locator('input[type="checkbox"]').check();
  }

  if (form.file) {
    await page.locator('input[type="file"]').setInputFiles(DUMMY_PDF_PATH);
  }

  await page.getByRole("button", { name: "Submit" }).click();

  // Wait for either the success screen or a visible error message.
  const success = page.getByText("Request submitted");
  const error = page.locator(".text-red-700");
  await Promise.race([
    success.waitFor({ state: "visible", timeout: 20000 }),
    error.waitFor({ state: "visible", timeout: 20000 }),
  ]).catch(() => {});

  if (await success.isVisible().catch(() => false)) {
    return { ok: true };
  }
  if (await error.isVisible().catch(() => false)) {
    const text = await error.textContent();
    return { ok: false, error: text?.trim() || "Unknown error" };
  }
  return { ok: false, error: "Timed out waiting for a success or error state" };
}

async function main() {
  console.log(`Target: ${BASE_URL}\n`);
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}
  );
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  const results = [];
  for (const form of FORMS) {
    process.stdout.write(`${form.slug} ... `);
    try {
      const result = await submitForm(page, form);
      results.push({ slug: form.slug, ...result });
      console.log(result.ok ? "PASS" : `FAIL (${result.error})`);
    } catch (err) {
      results.push({ slug: form.slug, ok: false, error: err.message });
      console.log(`FAIL (${err.message})`);
    }
  }

  await browser.close();
  fs.unlinkSync(DUMMY_PDF_PATH);

  console.log("\n================ SUMMARY ================");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.slug}${r.ok ? "" : `  -- ${r.error}`}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} submitted successfully.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
