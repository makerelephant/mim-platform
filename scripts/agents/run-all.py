"""
Agent Orchestrator — runs MiM agents in sequence.

Usage:
  python scripts/agents/run-all.py              # Run all agents
  python scripts/agents/run-all.py --gmail       # Gmail scanner only
  python scripts/agents/run-all.py --stale       # Stale detector only
  python scripts/agents/run-all.py --outreach    # Outreach tracker only
  python scripts/agents/run-all.py --enrich      # Investor enrichment only
"""

import subprocess
import sys
import os
import argparse
from datetime import datetime


AGENTS = {
    "gmail": "gmail-scanner.py",
    "stale": "stale-detector.py",
    "outreach": "outreach-tracker.py",
    "enrich": "investor-enrich.py",
}

AGENT_DIR = os.path.dirname(os.path.abspath(__file__))


def run():
    parser = argparse.ArgumentParser(description="MiM Agent Orchestrator")
    parser.add_argument("--gmail", action="store_true", help="Run Gmail scanner")
    parser.add_argument("--stale", action="store_true", help="Run stale detector")
    parser.add_argument("--outreach", action="store_true", help="Run outreach tracker")
    parser.add_argument("--enrich", action="store_true", help="Run investor enrichment")
    parser.add_argument("--all", action="store_true", help="Run all agents (default)")
    args = parser.parse_args()

    # Determine which agents to run
    selected = []
    if args.gmail:
        selected.append("gmail")
    if args.stale:
        selected.append("stale")
    if args.outreach:
        selected.append("outreach")
    if args.enrich:
        selected.append("enrich")

    if args.all or not selected:
        selected = list(AGENTS.keys())

    print(f"\n{'=' * 60}")
    print(f"MiM Agent Orchestrator — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"Running: {', '.join(selected)}")
    print(f"{'=' * 60}")

    results = {}
    for name in selected:
        script = AGENTS[name]
        script_path = os.path.join(AGENT_DIR, script)

        print(f"\n{'─' * 50}")
        print(f"▶ Running {script}...")
        print(f"{'─' * 50}")

        result = subprocess.run(
            [sys.executable, script_path],
            cwd=AGENT_DIR,
        )
        results[name] = "OK" if result.returncode == 0 else f"FAILED (exit {result.returncode})"

    # Summary
    print(f"\n{'=' * 60}")
    print("Summary:")
    for name, status in results.items():
        icon = "✓" if "OK" in status else "✗"
        print(f"  {icon} {name}: {status}")
    print(f"{'=' * 60}\n")

    # Exit with error if any agent failed
    if any("FAILED" in s for s in results.values()):
        sys.exit(1)


if __name__ == "__main__":
    run()
