/**
 * Document Processor — extracts text from uploaded files.
 *
 * Supports: PDF, DOCX, TXT, MD, HTML, CSV
 * Returns: extracted text + chunk array for future retrieval.
 *
 * PPTX support is basic (extracts text from XML) but
 * doesn't require a heavy dependency.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProcessedDocument {
  text: string;
  chunks: { chunk_index: number; text: string; token_count: number }[];
  fileType: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CHUNK_TARGET_TOKENS = 500;
const CHARS_PER_TOKEN = 4; // rough approximation
const CHUNK_TARGET_CHARS = CHUNK_TARGET_TOKENS * CHARS_PER_TOKEN;

// ─── Supported file types ───────────────────────────────────────────────────

export const SUPPORTED_FILE_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/plain",
  "text/markdown",
  "text/html",
  "text/csv",
  "application/json",
]);

export const EXTENSION_TO_TYPE: Record<string, string> = {
  pdf: "pdf",
  docx: "docx",
  pptx: "pptx",
  xlsx: "xlsx",
  xls: "xlsx",
  txt: "txt",
  md: "md",
  markdown: "md",
  html: "html",
  htm: "html",
  csv: "csv",
  json: "json",
};

// ─── Main Processor ─────────────────────────────────────────────────────────

/**
 * Extract text from a file buffer.
 * Determines extraction method based on file type.
 */
export async function processDocument(
  buffer: Buffer,
  fileName: string,
  mimeType?: string,
): Promise<ProcessedDocument> {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const fileType = EXTENSION_TO_TYPE[ext] || "txt";

  let text = "";

  switch (fileType) {
    case "pdf":
      text = await extractPdf(buffer);
      break;
    case "docx":
      text = await extractDocx(buffer);
      break;
    case "pptx":
      text = await extractPptx(buffer);
      break;
    case "xlsx":
      text = extractXlsx(buffer);
      break;
    case "html":
      text = extractHtml(buffer.toString("utf-8"));
      break;
    case "csv":
    case "json":
    case "txt":
    case "md":
    default:
      text = buffer.toString("utf-8");
      break;
  }

  // Clean up text
  text = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Chunk the text
  const chunks = chunkText(text);

  return { text, chunks, fileType };
}

// ─── Text from raw paste/input ──────────────────────────────────────────────

export function processTextInput(text: string): ProcessedDocument {
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    text: cleaned,
    chunks: chunkText(cleaned),
    fileType: "txt",
  };
}

// ─── PDF Extraction ─────────────────────────────────────────────────────────
// Uses pdf-parse (Node.js native, no worker required) instead of pdfjs-dist.
// pdfjs-dist v4.x requires a DOM worker that doesn't exist in Vercel serverless,
// causing "worker configuration" errors on every real-world PDF.

async function extractPdf(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    // Use pagerender to preserve page boundaries
    const result = await pdfParse(buffer, {
      pagerender: function(pageData: { getTextContent: () => Promise<{ items: Array<{ str: string }> }> }) {
        return pageData.getTextContent().then(function(textContent: { items: Array<{ str: string }> }) {
          return textContent.items.map((item: { str: string }) => item.str).join(' ');
        });
      }
    });

    // If pdf-parse provides per-page text via numpages, add page markers
    if (result.numpages && result.numpages > 1) {
      // pdf-parse concatenates all pages — re-parse with page markers
      try {
        const pages: string[] = [];
        let pageNum = 0;
        const markedResult = await pdfParse(buffer, {
          pagerender: function(pageData: { getTextContent: () => Promise<{ items: Array<{ str: string }> }> }) {
            pageNum++;
            const currentPage = pageNum;
            return pageData.getTextContent().then(function(textContent: { items: Array<{ str: string }> }) {
              const text = textContent.items.map((item: { str: string }) => item.str).join(' ').trim();
              if (text) {
                pages.push(`[PAGE ${currentPage}]\n${text}`);
              }
              return text;
            });
          }
        });
        if (pages.length > 0) {
          return pages.join('\n\n');
        }
      } catch {
        // Fall through to standard result
      }
    }

    return result.text || "";
  } catch (e) {
    console.error("PDF extraction failed:", e);
    return `[PDF extraction failed: ${String(e).slice(0, 300)}]`;
  }
}

// ─── DOCX Extraction ────────────────────────────────────────────────────────

async function extractDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  } catch (e) {
    console.error("DOCX extraction failed:", e);
    return "[DOCX extraction failed — install mammoth]";
  }
}

// ─── PPTX Extraction (basic XML text extraction) ────────────────────────────

async function extractPptx(buffer: Buffer): Promise<string> {
  try {
    // PPTX is a ZIP file containing XML slides
    // We'll do basic text extraction from the XML
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);

    const texts: string[] = [];
    const slideFiles = Object.keys(zip.files)
      .filter((f) => f.startsWith("ppt/slides/slide") && f.endsWith(".xml"))
      .sort();

    for (const slideFile of slideFiles) {
      const xmlContent = await zip.files[slideFile].async("text");
      // Extract text from XML tags like <a:t>text</a:t>
      const textMatches = xmlContent.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
      if (textMatches) {
        const slideTexts = textMatches.map((m) =>
          m.replace(/<[^>]*>/g, "").trim()
        ).filter(Boolean);
        if (slideTexts.length > 0) {
          const slideNum = slideFile.match(/slide(\d+)/)?.[1] || "?";
          texts.push(`[Slide ${slideNum}]\n${slideTexts.join(" ")}`);
        }
      }
    }

    return texts.join("\n\n");
  } catch (e) {
    console.error("PPTX extraction failed:", e);
    return "[PPTX extraction failed]";
  }
}

// ─── XLSX Extraction ───────────────────────────────────────────────────────
// Uses SheetJS to parse Excel workbooks into structured text.
// Each sheet becomes a labeled section. Rows are converted to tab-separated
// values so Claude can read them as a table. Empty rows/cells are preserved
// to maintain structure. Named ranges and formulas are resolved to their
// computed values.

function extractXlsx(buffer: Buffer): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    const sheets: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      // Get the range of the sheet
      const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
      const rows: string[] = [];

      for (let r = range.s.r; r <= range.e.r; r++) {
        const cells: string[] = [];
        let hasContent = false;

        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = sheet[addr];

          if (cell) {
            // Use formatted value (v = raw value, w = formatted string)
            let val = "";
            if (cell.w !== undefined) {
              val = String(cell.w);
            } else if (cell.v !== undefined) {
              if (cell.v instanceof Date) {
                val = cell.v.toISOString().split("T")[0];
              } else {
                val = String(cell.v);
              }
            }
            cells.push(val);
            if (val.trim()) hasContent = true;
          } else {
            cells.push("");
          }
        }

        // Only include rows that have at least one non-empty cell
        if (hasContent) {
          rows.push(cells.join("\t"));
        }
      }

      if (rows.length > 0) {
        sheets.push(`[SHEET: ${sheetName}]\n${rows.join("\n")}`);
      }
    }

    if (sheets.length === 0) {
      return "[Empty Excel workbook — no data found]";
    }

    return sheets.join("\n\n");
  } catch (e) {
    console.error("XLSX extraction failed:", e);
    return `[XLSX extraction failed: ${String(e).slice(0, 300)}]`;
  }
}

// ─── HTML Extraction (strip tags) ───────────────────────────────────────────

export function extractHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Text Chunking ──────────────────────────────────────────────────────────

function chunkText(
  text: string,
): { chunk_index: number; text: string; token_count: number }[] {
  if (!text || text.length === 0) return [];

  const chunks: { chunk_index: number; text: string; token_count: number }[] = [];

  // Split on paragraph boundaries first
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = "";
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const combined = currentChunk ? `${currentChunk}\n\n${para}` : para;

    if (combined.length > CHUNK_TARGET_CHARS && currentChunk) {
      // Push current chunk and start new one
      const tokenCount = Math.ceil(currentChunk.length / CHARS_PER_TOKEN);
      chunks.push({ chunk_index: chunkIndex++, text: currentChunk.trim(), token_count: tokenCount });
      currentChunk = para;
    } else {
      currentChunk = combined;
    }
  }

  // Push remaining text
  if (currentChunk.trim()) {
    const tokenCount = Math.ceil(currentChunk.length / CHARS_PER_TOKEN);
    chunks.push({ chunk_index: chunkIndex, text: currentChunk.trim(), token_count: tokenCount });
  }

  return chunks;
}

// ─── File Size Validation ───────────────────────────────────────────────────

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function validateFileSize(sizeBytes: number): { valid: boolean; error?: string } {
  if (sizeBytes > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large (${Math.round(sizeBytes / 1024 / 1024)}MB). Maximum is 50MB.` };
  }
  return { valid: true };
}
