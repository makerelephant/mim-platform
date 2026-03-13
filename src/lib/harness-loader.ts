/**
 * Harness Loader — reads Acumen classifier markdown files and builds
 * a prompt section for injection into the Gmail/Slack scanner classifier.
 *
 * Each file in brain/pipelines/email-classification/*.md defines one
 * classification category with signals and importance tiers.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

export interface AcumenCategory {
  id: string;
  name: string;
  signals: string;
  importanceHigh: string[];
  importanceMedium: string[];
  importanceLow: string[];
}

/**
 * Parse a single classifier markdown file into structured data.
 */
function parseClassifierMarkdown(content: string): AcumenCategory | null {
  const idMatch = content.match(/## Category ID\s*\n`([^`]+)`/);
  const nameMatch = content.match(/^# Email Classification Rule:\s*(.+)$/m);
  const signalsMatch = content.match(/## Signals\s*\n([\s\S]*?)(?=\n## |\n$)/);

  if (!idMatch || !nameMatch) return null;

  const id = idMatch[1].trim();
  const name = nameMatch[1].trim();
  const signals = signalsMatch ? signalsMatch[1].trim() : "";

  // Parse importance sections
  const importanceSection = content.split("## Importance")[1] || "";

  const parseList = (section: string, header: string): string[] => {
    const regex = new RegExp(`### ${header}\\s*\\n([\\s\\S]*?)(?=\\n### |$)`);
    const match = section.match(regex);
    if (!match) return [];
    return match[1]
      .split("\n")
      .filter((l) => l.trim().startsWith("-"))
      .map((l) => l.replace(/^-\s*/, "").trim());
  };

  return {
    id,
    name,
    signals,
    importanceHigh: parseList(importanceSection, "High"),
    importanceMedium: parseList(importanceSection, "Medium"),
    importanceLow: parseList(importanceSection, "Low"),
  };
}

/**
 * Load all classifier markdown files and return structured categories.
 */
export function loadAcumenCategories(): AcumenCategory[] {
  const dir = join(process.cwd(), "brain", "pipelines", "email-classification");

  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {
    console.warn("[harness-loader] Could not read directory:", dir);
    return [];
  }

  const categories: AcumenCategory[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(join(dir, file), "utf-8");
      const parsed = parseClassifierMarkdown(content);
      if (parsed) categories.push(parsed);
    } catch {
      console.warn(`[harness-loader] Could not read file: ${file}`);
    }
  }

  return categories;
}

/**
 * Build a prompt section from loaded Acumen categories.
 * This is injected into the classifier system prompt.
 */
export function buildAcumenPromptSection(categories?: AcumenCategory[]): string {
  const cats = categories || loadAcumenCategories();

  if (cats.length === 0) {
    return "ACUMEN CATEGORIES: No harness rules loaded.";
  }

  const lines: string[] = [
    "ACUMEN OPERATIONAL CATEGORIES — Classify every email into exactly ONE of these categories.",
    "This determines how the email is routed and prioritized operationally.",
    "",
  ];

  const categoryIds = cats.map((c) => c.id);
  lines.push(`Valid categories: ${categoryIds.join(", ")}`);
  lines.push("");

  for (const cat of cats) {
    lines.push(`### ${cat.name} (category: "${cat.id}")`);

    if (cat.signals) {
      lines.push(`Signals: ${cat.signals}`);
    }

    if (cat.importanceHigh.length > 0) {
      lines.push(`HIGH importance: ${cat.importanceHigh.join("; ")}`);
    }
    if (cat.importanceMedium.length > 0) {
      lines.push(`MEDIUM importance: ${cat.importanceMedium.join("; ")}`);
    }
    if (cat.importanceLow.length > 0) {
      lines.push(`LOW importance: ${cat.importanceLow.join("; ")}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Returns the list of valid Acumen category IDs.
 */
export function getAcumenCategoryIds(): string[] {
  return [
    "legal",
    "customer-partner-ops",
    "accounting-finance",
    "scheduling",
    "fundraising",
    "product-engineering",
    "ux-design",
    "marketing",
    "ai",
    "family",
    "administration",
  ];
}
