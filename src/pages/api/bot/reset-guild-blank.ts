import type { NextApiRequest, NextApiResponse } from "next";
import {
  PRIMARY_BASELINE_GUILD_ID,
  STOCK_LOCK_NON_PRIMARY,
  readGuildIdFromRequest,
} from "@/lib/guildPolicy";
import { BOT_API, buildBotApiHeaders, readJsonSafe } from "@/lib/botApi";

const BLANK = {
  features: {
    onboardingEnabled: true,
    verificationEnabled: true,
    heistEnabled: true,
    rareDropEnabled: true,
    aiEnabled: true,
    birthdayEnabled: true,
    economyEnabled: true,
    governanceEnabled: true,
    ttsEnabled: true,
  },
  botPersonalizer: {
    enabled: true,
    guildNickname: "",
    botName: "",
    webhookName: "",
    webhookAvatarUrl: "",
    guildAvatarUrl: "",
    avatarLibrary: [],
    useWebhookPersona: false,
    profileBannerUrl: "",
    activityType: "LISTENING",
    activityText: "/help",
    status: "online",
  },
  persona: {
    enabled: true,
    guildNickname: "",
    botName: "",
    webhookName: "",
    webhookAvatarUrl: "",
    guildAvatarUrl: "",
    avatarLibrary: [],
    useWebhookPersona: false,
    profileBannerUrl: "",
    activityType: "LISTENING",
    activityText: "/help",
    status: "online",
  },
  security: {
    preOnboarding: {
      autoBanOnBlacklistRejoin: false,
      autoBanOnRefusalRole: false,
      enforcementAction: "ban",
      profileThreatGuardEnabled: false,
      profileThreatScanOnUpdate: true,
      profileThreatAction: "kick",
      profileThreatKeywords: "",
      profileThreatDomains: "",
      profileThreatExemptRoleIds: [],
      refusalRoleId: null,
      enforcementChannelId: null,
      contactUser: "",
      banDmTemplate: ""
    },
    onboarding: {
      welcomeChannelId: null, mainChatChannelId: null, rulesChannelId: null, idChannelId: null, ticketCategoryId: null,
      transcriptChannelId: null, logChannelId: null, verifiedRoleId: null, declineRoleId: null,
      staffRoleIds: [], removeOnVerifyRoleIds: [], idTimeoutMinutes: 30,
      dmTemplate: "", panelTitle: "", panelDescription: "", panelFooter: "", gateAnnouncementTemplate: "",
      idPanelTitle: "", idPanelDescription: "", idPanelContent: "", postVerifyTemplate: "", postVerifyAutoDeleteMinutes: 0,
    },
    verification: { autoKickOnDecline: false, autoKickOnTimeout: false, declineKickReason: "", timeoutKickReason: "", declineReplyTemplate: "" },
    lockdown: { enabled: false, joinThresholdPerMinute: 10, mentionThresholdPerMinute: 20, autoEscalation: false, exemptRoleIds: [], exemptChannelIds: [] },
    raid: { enabled: false, joinBurstThreshold: 6, windowSeconds: 30, actionPreset: "contain", exemptRoleIds: [], exemptChannelIds: [], autoEscalate: false },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });
  const guildId = readGuildIdFromRequest(req);
  if (!/^\d{16,20}$/.test(guildId)) return res.status(400).json({ success: false, error: "guildId is required" });

  if (STOCK_LOCK_NON_PRIMARY && guildId === PRIMARY_BASELINE_GUILD_ID) {
    return res.status(403).json({
      success: false,
      error: "Primary baseline guild cannot be reset to blank while stock lock is enabled.",
      guildId,
      primaryGuildId: PRIMARY_BASELINE_GUILD_ID,
    });
  }

  try {
    const up = await fetch(`${BOT_API}/dashboard-config`, {
      method: "POST",
      headers: await buildBotApiHeaders(req, { json: true }),
      body: JSON.stringify({ guildId, patch: BLANK }),
    });
    const data = await readJsonSafe(up);
    return res.status(up.status).json(data);
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || "reset failed" });
  }
}
