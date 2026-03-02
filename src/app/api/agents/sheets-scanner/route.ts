import { NextResponse } from "next/server";
import { runSheetsScanner } from "@/lib/sheets-scanner";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    if (!process.env.GOOGLE_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Missing GOOGLE_TOKEN env var." },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const spreadsheetId = body.spreadsheetId || undefined;
    const sheetName = body.sheetName || undefined;

    const result = await runSheetsScanner({ spreadsheetId, sheetName });
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
