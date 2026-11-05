import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { appendAudit, deepMerge } from "@/lib/setupStore";
import { requirePremiumAccess } from "@/lib/premiumGuard";

const SETUP_DIR = path.join(process.cwd(), "data", "setup");

function readJson(fp: string) {
  if (!fs.existsSync(fp)) return {};
  try {
    const raw = fs.readFileSync(fp, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeJson(fp: string, obj: any) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2), "utf8");
}

function gid(req: NextApiRequest) {
  return String(req.query.guildId || req.body?.guildId || "").trim();
}

function validFile(name: string) {
  return /^[a-zA-Z0-9._-]+\.json$/.test(name);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const guildId = gid(req);
  if (!guildId) return res.status(400).json({ success: false, error: "guildId required" });

  const allowed = await requirePremiumAccess(req, res, guildId, "config-backup");
  if (allowed !== true) return allowed;

  if (req.method === "GET") {
    const files: Record<string, any> = {};
    if (fs.existsSync(SETUP_DIR)) {
      for (const f of fs.readdirSync(SETUP_DIR)) {
        if (!f.endsWith(".json")) continue;
        if (!validFile(f)) continue;
        const fp = path.join(SETUP_DIR, f);
        const store = readJson(fp);
        if (store && typeof store === "object" && guildId in store) {
          files[f] = store[guildId];
        }
      }
    }
    return res.status(200).json({
      success: true,
      guildId,
      backup: {
        guildId,
        capturedAt: new Date().toISOString(),
        files
      }
    });
  }

  if (req.method === "POST") {
    const payload = req.body?.payload;
    const mode = String(req.body?.mode || "merge").toLowerCase() === "replace" ? "replace" : "merge";

    if (!payload || typeof payload !== "object" || !payload.files || typeof payload.files !== "object") {
      return res.status(400).json({ success: false, error: "payload.files required" });
    }

    const applied: string[] = [];

    for (const [f, cfg] of Object.entries(payload.files)) {
      if (!validFile(f)) continue;
      const fp = path.join(SETUP_DIR, f);
      const store = readJson(fp);
      const prev = store[guildId] || {};
      store[guildId] = mode === "replace" ? cfg : deepMerge(prev, cfg);
      writeJson(fp, store);
      applied.push(f);
    }

    appendAudit({
      guildId,
      area: "backup-restore",
      action: "import",
      mode,
      count: applied.length
    });

    return res.status(200).json({ success: true, guildId, applied, mode });
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
