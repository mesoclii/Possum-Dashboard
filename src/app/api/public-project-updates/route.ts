import { execFile } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ProjectUpdates = {
  bot: string | null;
  dashboard: string | null;
  website: string | null;
};

let cached: { value: ProjectUpdates; expiresAt: number } | null = null;
let pending: Promise<ProjectUpdates> | null = null;

function lastCommit(directory: string, project: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["-C", directory, "log", "-1", "--format=%cI", "HEAD"],
      { timeout: 3000, maxBuffer: 4096 },
      (error, stdout) => {
        const timestamp = stdout.trim();
        if (error || !timestamp || Number.isNaN(Date.parse(timestamp))) {
          console.error(`Unable to read ${project} commit timestamp:`, error?.message || "invalid timestamp");
          resolve(null);
          return;
        }
        resolve(timestamp);
      },
    );
  });
}

async function getUpdates(): Promise<ProjectUpdates> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (pending) return pending;

  const website = process.cwd();
  const apps = path.dirname(website);
  pending = Promise.all([
    lastCommit(path.join(apps, "Possum-Bot"), "bot"),
    lastCommit(path.join(apps, "Possum-Dashboard"), "dashboard"),
    lastCommit(website, "website"),
  ]).then(([bot, dashboard, websiteUpdated]) => {
    const value = { bot, dashboard, website: websiteUpdated };
    cached = { value, expiresAt: Date.now() + 60_000 };
    return value;
  }).finally(() => {
    pending = null;
  });
  return pending;
}

export async function GET() {
  return NextResponse.json(await getUpdates(), {
    headers: { "Cache-Control": "no-store" },
  });
}
