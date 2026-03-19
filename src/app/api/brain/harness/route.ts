import { NextResponse } from "next/server";
import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";

interface HarnessFile {
  name: string;
  slug: string;
  content: string;
  section: string;
}

/**
 * Recursively scan a directory for .md files, returning them with section labels.
 */
async function scanDirectory(
  baseDir: string,
  sectionLabel: string,
  slugPrefix: string,
): Promise<HarnessFile[]> {
  const files: HarnessFile[] = [];

  let entries: string[];
  try {
    entries = await readdir(baseDir);
  } catch {
    return files;
  }

  for (const entry of entries.sort()) {
    const fullPath = join(baseDir, entry);
    const s = await stat(fullPath).catch(() => null);
    if (!s) continue;

    if (s.isDirectory()) {
      // Recurse into subdirectory with its name as the section label
      const subLabel = entry
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      const subFiles = await scanDirectory(
        fullPath,
        subLabel,
        `${slugPrefix}${entry}/`,
      );
      files.push(...subFiles);
    } else if (entry.endsWith(".md")) {
      const content = await readFile(fullPath, "utf-8");
      const slug = `${slugPrefix}${entry.replace(".md", "")}`;
      const name = entry
        .replace(".md", "")
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      files.push({ name, slug, content, section: sectionLabel });
    }
  }

  return files;
}

/**
 * GET /api/brain/harness
 *
 * Returns all harness markdown files from:
 *   1. brain/pipelines/email-classification/ (Acumen classifier rules)
 *   2. brain/harness/ (operating model documentation — ontology, pipelines, memory)
 *
 * These define how the brain thinks — the Motion Map.
 */
export async function GET() {
  try {
    const cwd = process.cwd();

    // ── 1. Load Acumen classifier files ──
    const classifierDir = join(cwd, "brain", "pipelines", "email-classification");
    const classifierFiles = await scanDirectory(
      classifierDir,
      "Acumen Classifiers",
      "classifier/",
    );

    // ── 2. Load harness operating model files ──
    const harnessDir = join(cwd, "brain", "harness");
    const harnessFiles = await scanDirectory(harnessDir, "Operating Model", "");

    const allFiles = [...classifierFiles, ...harnessFiles];

    if (allFiles.length === 0) {
      return NextResponse.json({
        success: true,
        files: [],
        sections: [],
        message: "No harness files found. Classifiers not deployed to this environment.",
      });
    }

    // Build section index for the UI sidebar
    const sectionMap = new Map<string, string[]>();
    for (const f of allFiles) {
      if (!sectionMap.has(f.section)) sectionMap.set(f.section, []);
      sectionMap.get(f.section)!.push(f.slug);
    }

    const sections = Array.from(sectionMap.entries()).map(([label, slugs]) => ({
      label,
      slugs,
    }));

    return NextResponse.json({ success: true, files: allFiles, sections });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
