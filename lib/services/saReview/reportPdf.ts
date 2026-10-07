import path from "path";
import { readFileSync } from "fs";
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { SaReviewFinding } from "./checklist";

// Plain React.createElement, not JSX: this file is reached from an App
// Router route handler, and Next compiles any .tsx file in that graph
// against a "react-server" conditioned React build. @react-pdf/renderer's
// own bundled React doesn't recognize elements created that way and throws
// a minified invariant #31 ("Objects are not valid as a React child") even
// though the markup itself is correct -- confirmed by reproducing the same
// render with React.createElement in a bare Node script (works) vs the
// equivalent JSX compiled by Next (fails). Avoiding JSX here sidesteps it.
const h = React.createElement;

const STATUS_LABEL: Record<string, string> = {
  ok: "OK",
  auto_fix: "Auto-fixable",
  flag: "Needs review",
};

const STATUS_COLOR: Record<string, string> = {
  ok: "#1a7f37",
  auto_fix: "#9a6700",
  flag: "#b42318",
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20, borderBottom: "1pt solid #e2e2e2", paddingBottom: 12 },
  logo: { width: 110, height: 28 },
  headerText: { marginLeft: "auto", textAlign: "right" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#555555" },
  summaryBox: { padding: 10, marginBottom: 16, borderRadius: 4, border: "1pt solid #e2e2e2" },
  summaryReady: { backgroundColor: "#eaf7ec" },
  summaryNotReady: { backgroundColor: "#fdeeee" },
  summaryText: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", borderBottom: "0.5pt solid #ececec", paddingVertical: 8 },
  rowLeft: { width: "28%", paddingRight: 8 },
  rowRight: { width: "72%" },
  categoryLabel: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 2 },
  statusBadge: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  detail: { fontSize: 9.5, marginTop: 4, lineHeight: 1.4, flex: 1 },
  pageEstimate: { fontSize: 8.5, marginTop: 4, color: "#888888" },
  action: { fontSize: 9.5, marginTop: 4, lineHeight: 1.4, color: "#374151" },
  actionLabel: { fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#888888", textAlign: "center" },
});

function logoBuffer(): Buffer {
  return readFileSync(path.join(process.cwd(), "public", "axiskey-logo.png"));
}

function buildFindingRow(finding: SaReviewFinding) {
  const children = [
    h(
      View,
      { key: "left", style: styles.rowLeft },
      h(Text, { key: "label", style: styles.categoryLabel }, `${finding.category}. ${finding.label}`),
      h(
        Text,
        { key: "status", style: [styles.statusBadge, { color: STATUS_COLOR[finding.status] ?? "#1a1a1a" }] },
        STATUS_LABEL[finding.status] ?? finding.status
      )
    ),
    h(
      View,
      { key: "right", style: styles.rowRight },
      h(
        View,
        { key: "detailRow", style: styles.detailRow },
        h(Text, { key: "detail", style: styles.detail }, finding.detail),
        finding.pageEstimate
          ? h(Text, { key: "page", style: styles.pageEstimate }, `~p. ${finding.pageEstimate}`)
          : null
      ),
      finding.recommendedAction
        ? h(
            Text,
            { key: "action", style: styles.action },
            h(Text, { key: "label", style: styles.actionLabel }, "Recommended action: "),
            finding.recommendedAction
          )
        : null
    ),
  ];
  return h(View, { key: finding.category, style: styles.row }, ...children);
}

function buildDocument(params: {
  fileName: string;
  mappingReady: boolean | null;
  findings: SaReviewFinding[];
  generatedAt: string;
}) {
  const { fileName, mappingReady, findings, generatedAt } = params;

  return h(
    Document,
    null,
    h(
      Page,
      { size: "A4", style: styles.page },
      h(
        View,
        { style: styles.header },
        h(Image, { src: logoBuffer(), style: styles.logo }),
        h(
          View,
          { style: styles.headerText },
          h(Text, { style: styles.title }, "SA Mapping Readiness Report"),
          h(Text, { style: styles.subtitle }, fileName),
          h(Text, { style: styles.subtitle }, `Generated ${generatedAt}`)
        )
      ),
      h(
        View,
        { style: [styles.summaryBox, mappingReady ? styles.summaryReady : styles.summaryNotReady] },
        h(
          Text,
          { style: styles.summaryText },
          mappingReady
            ? "Mapping ready: no legal content issues require human review."
            : "Not mapping ready: one or more items below need human review before this SA can be mapped."
        )
      ),
      ...findings.map(buildFindingRow),
      h(Text, { style: styles.footer }, "AxisKey Operations Hub · Subscription Agreement Review")
    )
  );
}

export async function renderSaReviewReportPdf(params: {
  fileName: string;
  mappingReady: boolean | null;
  findings: SaReviewFinding[];
}): Promise<Buffer> {
  const generatedAt = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return renderToBuffer(buildDocument({ ...params, generatedAt }));
}
