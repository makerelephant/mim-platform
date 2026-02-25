import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";

export const maxDuration = 120; // Allow up to 2 minutes for scanner

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const scanHours = body.scanHours || 24;

    // Path to the agents directory
    const agentsDir = path.resolve(process.cwd(), "scripts/agents");
    const envFile = path.join(agentsDir, ".env");

    // Build the command — load .env and run the scanner
    const cmd = [
      `cd "${agentsDir}"`,
      // Source the .env file to load environment variables
      `export $(grep -v '^#' "${envFile}" | xargs)`,
      `export SCAN_HOURS=${scanHours}`,
      `python3 gmail-scanner.py`,
    ].join(" && ");

    return new Promise<NextResponse>((resolve) => {
      exec(cmd, { timeout: 110000 }, (error, stdout, stderr) => {
        if (error) {
          console.error("Scanner error:", error.message);
          console.error("stderr:", stderr);
          resolve(
            NextResponse.json(
              {
                success: false,
                error: error.message,
                output: stdout,
                stderr: stderr,
              },
              { status: 500 }
            )
          );
          return;
        }

        // Parse output for stats
        const lines = stdout.split("\n");
        const processedMatch = lines.find((l) => l.includes("Completed"));
        const stats = {
          output: stdout,
          summary: processedMatch || "Scanner completed",
        };

        resolve(NextResponse.json({ success: true, ...stats }));
      });
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
