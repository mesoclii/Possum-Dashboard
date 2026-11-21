import type { NextApiRequest, NextApiResponse } from "next";
import { appendAudit, deepMerge, readStore, updateStore } from "@/lib/setupStore";

const FILE = "runtime-safety.json";

function defaults() {
  return {
    active: true,
    crashGuard: {
      enabled: true,
      maxRestartsPerHour: 6,
      cooldownSeconds: 60,
      autoPauseOnLoop: true,
      notifyChannelId: ""
    },
    cooldowns: {
      globalDefaultSeconds: 3,
      perCommand: {},
      perEngine: {}
    },
    rateLimits: {
      messagePer10s: 8,
      commandPerMinute: 15,
      aiPerMinute: 6,
      ttsPerMinute: 3,
      blockMinutes: 10
    },
    emergency: {
      globalReadOnly: false,
      disableAi: false,
      disableTts: false,
      disableGames: false,
      disableAutomation: false,
      blocklistUserIds: [],
      blocklistRoleIds: [],
      blocklistChannelIds: []
    }
  };
}

function guildId(req: NextApiRequest) {
  return String(req.query.guildId || req.body?.guildId || "").trim();
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const gid = guildId(req);
  if (!gid) return res.status(400).json({ success: false, error: "guildId required" });

  if (req.method === "GET") {
    try {
      const store = readStore(FILE);
      return res.status(200).json({ success: true, guildId: gid, config: store[gid] || defaults() });
    } catch {
      return res.status(500).json({ success: false, error: "Cannot read runtime safety settings." });
    }
  }

  if (req.method === "POST") {
    const patch = req.body?.patch || {};
    let next;
    try {
      next = updateStore(FILE, (store) => {
        const updated = deepMerge(store[gid] || defaults(), patch);
        store[gid] = updated;
        return updated;
      });
    } catch {
      return res.status(500).json({ success: false, error: "Cannot save runtime safety settings; no change was confirmed." });
    }
    appendAudit({
      guildId: gid,
      area: "runtime-safety",
      action: "save",
      keys: Object.keys(patch || {})
    });
    return res.status(200).json({ success: true, guildId: gid, config: next });
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
