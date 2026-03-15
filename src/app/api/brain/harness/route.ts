import { NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

/**
 * GET /api/brain/harness
 *
 * Returns all harness classifier markdown files.
 * These define how the brain thinks — the Motion Map.
 */
export async function GET() {
  try {
    const harnessDir = join(process.cwd(), "brain", "pipelines", "email-classification");

    let fileNames: string[];
    try {
      fileNames = await readdir(harnessDir);
    } catch {
      return NextResponse.json({
        success: true,
        files: [],
        message: "Harness directory not found. Classifiers not deployed to this environment.",
      });
    }

    const mdFiles = fileNames.filter((f) => f.endsWith(".md")).sort();

    const files = await Promise.all(
      mdFiles.map(async (fileName) => {
        const content = await readFile(join(harnessDir, fileName), "utf-8");
        const slug = fileName.replace(".md", "");
        const name = slug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

        return { name, slug, content };
      })
    );

    return NextResponse.json({ success: true, files });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
