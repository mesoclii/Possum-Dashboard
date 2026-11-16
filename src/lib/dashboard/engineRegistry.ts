export type EngineGroup =
  | "Guild Control"
  | "Security"
  | "Automation"
  | "Economy"
  | "Fun"
  | "Premium";

export type EngineDef = {
  id: string;
  label: string;
  description: string;
  group: EngineGroup;
  route: string;
  featureKey?: string;
  notes?: string;
};

export const SAVIORS_GUILD_ID = "1431799056211906582";

export const ENGINE_REGISTRY: EngineDef[] = [
  { id: "bot-personalizer", label: "Bot Personalizer", description: "Per-guild Possum AI identity, avatar, presence, and webhook branding", group: "Guild Control", route: "/dashboard/bot-personalizer" },
  { id: "bot-masters", label: "Bot Masters", description: "Dashboard role/user access per guild", group: "Guild Control", route: "/dashboard/bot-masters" },
  { id: "channels", label: "Channels", description: "Centralized guild routing and channel assignment surface", group: "Guild Control", route: "/dashboard/channels" },
  { id: "possum-ai", label: "Possum AI", description: "Homemade adaptive AI, memory, and runtime reply routing", group: "Premium", route: "/dashboard/ai/learning" },
  { id: "giveaways", label: "Giveaways", description: "Giveaway lifecycle, entrants, rerolls, and controls", group: "Guild Control", route: "/dashboard/giveaways", notes: "Engine-config controlled" },
  { id: "jed", label: "Jed", description: "Sticker, emoji, gif, and asset steal/deploy controls", group: "Guild Control", route: "/dashboard/jed" },
  { id: "music", label: "Music", description: "Always-free multi-route music playback and queue control", group: "Guild Control", route: "/dashboard/music", featureKey: "musicEnabled" },
  { id: "vip", label: "VIP", description: "VIP grants, status, expiry cleanup, and tier lifecycle", group: "Guild Control", route: "/dashboard/vip", notes: "Separate VIP engine. Loyalty is configured on its own linked page." },
  { id: "tickets", label: "Tickets", description: "Support ticket controls", group: "Guild Control", route: "/dashboard/tickets", notes: "Engine-config controlled" },
  { id: "selfroles", label: "Self Roles", description: "Self-role panel deployment", group: "Guild Control", route: "/dashboard/selfroles" },
  { id: "reviews", label: "Reviews", description: "Review panel deploy, star voting, and written feedback cards", group: "Guild Control", route: "/dashboard/reviews" },

  { id: "moderator", label: "Moderator", description: "Separate automod, audit, and moderation control surface", group: "Security", route: "/dashboard/moderator" },
  { id: "security", label: "Security", description: "Security stack, moderation, and policies", group: "Security", route: "/dashboard/security" },
  { id: "pre-onboarding", label: "Pre-Onboarding", description: "Blacklist rejoin, refusal-role, and pre-entry enforcement controls", group: "Security", route: "/dashboard/security/pre-onboarding", featureKey: "securityEnabled" },
  { id: "onboarding", label: "Onboarding", description: "Welcome + ticket-driven join flow", group: "Security", route: "/dashboard/security/onboarding", featureKey: "onboardingEnabled" },
  { id: "verification", label: "Verification", description: "ID/verification workflows", group: "Security", route: "/dashboard/security/verification", featureKey: "verificationEnabled" },
  { id: "lockdown", label: "Lockdown", description: "Emergency channel/server controls", group: "Security", route: "/dashboard/security/lockdown", notes: "Engine-config controlled" },
  { id: "raid", label: "Raid", description: "Anti-raid burst controls", group: "Security", route: "/dashboard/security/raid", notes: "Engine-config controlled" },
  { id: "governance", label: "Governance", description: "Security governance stack master gate", group: "Security", route: "/dashboard/governance", featureKey: "governanceEnabled" },
  { id: "security-enforcer", label: "Security Enforcer", description: "Security enforcement policy and escalation runtime", group: "Security", route: "/dashboard/security-enforcer", featureKey: "governanceEnabled" },
  { id: "blacklist", label: "Blacklist", description: "Blacklist controls", group: "Security", route: "/dashboard/blacklist" },
  { id: "modder-intel", label: "Modder Intel", description: "Tracked menu-holder intel, restriction surfaces, and staff-safe cleanup", group: "Security", route: "/dashboard/modder-intel" },
  { id: "activity-prune", label: "Activity Prune", description: "Tracked inactivity sweeps with preview-first kicking, exemptions, and real activity signals", group: "Security", route: "/dashboard/security/activity-prune" },
  { id: "failsafe", label: "Failsafe", description: "Failsafe emergency controls", group: "Security", route: "/dashboard/failsafe" },

  { id: "automation-studio", label: "Automation Studio", description: "Visual automation builder and runtime editor", group: "Automation", route: "/dashboard/automations/studio" },
  { id: "commands", label: "!Command Studio", description: "Custom bang-command builder", group: "Automation", route: "/dashboard/commands" },
  { id: "slash-commands", label: "Slash Commands", description: "Native built-in slash command master", group: "Automation", route: "/dashboard/slash-commands" },
  { id: "event-reactor", label: "Event Alerts", description: "Discord event watching, failed-job routing, and extra alert posts", group: "Automation", route: "/dashboard/event-reactor" },
  { id: "runtime-router", label: "AI Talking Rules", description: "Simple split between free Possum AI replies and Persona AI channels", group: "Premium", route: "/dashboard/runtime-router" },

  { id: "economy", label: "Economy", description: "Economy/store/progression baseline", group: "Economy", route: "/dashboard/economy", featureKey: "economyEnabled" },
  { id: "event-points", label: "Event Points", description: "Separate per-guild event currency, house scoring, and event board runtime", group: "Economy", route: "/dashboard/economy/events", featureKey: "economyEnabled" },
  { id: "birthday", label: "Radio", description: "Birthday profile, broadcast, and reward controls", group: "Economy", route: "/dashboard/economy/radio-birthday", featureKey: "birthdayEnabled" },
  { id: "invite", label: "Invite Tracker", description: "Invite tracking and leaderboard", group: "Economy", route: "/dashboard/economy/leaderboard" },
  { id: "profile", label: "Profile", description: "Profile display, rank surfaces, and stat aggregation", group: "Economy", route: "/dashboard/profile" },
  { id: "halloffame", label: "Hall Of Fame", description: "Recognition layer for top achievers and prestige-ready members", group: "Economy", route: "/dashboard/halloffame" },
  { id: "loyalty", label: "Loyalty", description: "Retention timing, tenure rewards, and VIP-adjacent loyalty benefits", group: "Economy", route: "/dashboard/loyalty" },
  { id: "prestige", label: "Prestige", description: "Capstone reset loop and long-tail prestige reward ladder", group: "Economy", route: "/dashboard/prestige" },
  { id: "achievements", label: "Achievements", description: "Milestone grant rules, badge sync, and achievement reward logic", group: "Economy", route: "/dashboard/achievements" },

  { id: "games", label: "Gaming Hub", description: "External game identity linking, presence fusion, launcher accounts, stats, hours, and squad finder", group: "Fun", route: "/dashboard/games" },
  { id: "wow-guild", label: "WoW Groups", description: "WoW 5-man and raid signups plus message-of-the-day controls", group: "Fun", route: "/dashboard/wow" },
  { id: "pokemon", label: "Pokemon Catching", description: "Wild spawn lanes, catch economy, and trainer intake", group: "Fun", route: "/dashboard/pokemon-catching", featureKey: "pokemonEnabled" },
  { id: "pokemon-battle", label: "Pokemon Battle", description: "Pokemon battle routing and logs", group: "Fun", route: "/dashboard/pokemon-battle", featureKey: "pokemonEnabled" },
  { id: "pokemon-trade", label: "Pokemon Trade", description: "Pokemon trade routing and logs", group: "Fun", route: "/dashboard/pokemon-trade", featureKey: "pokemonEnabled" },
  { id: "rare-drop", label: "Rare Spawn", description: "Rare spawn controls", group: "Fun", route: "/dashboard/rarespawn", featureKey: "rareDropEnabled" },
  { id: "cat-drop", label: "Cat Drop", description: "Cat drop controls", group: "Fun", route: "/dashboard/catdrop" },
  { id: "crew", label: "Crew", description: "Crew engine controls", group: "Fun", route: "/dashboard/crew" },
  { id: "dominion", label: "Dominion", description: "Dominion engine controls", group: "Fun", route: "/dashboard/dominion" },
  { id: "contracts", label: "Contracts", description: "Objective progression, task tracking, and contract completion flow", group: "Fun", route: "/dashboard/contracts" },
  { id: "range", label: "Range", description: "Range game controls", group: "Fun", route: "/dashboard/range" },
  { id: "truthdare", label: "Truth Dare", description: "Truth/Dare controls", group: "Fun", route: "/dashboard/truthdare" },

  { id: "system-health", label: "System Health", description: "Runtime monitor, drift and health checks", group: "Guild Control", route: "/dashboard/system-health" },

  { id: "premium-features", label: "Premium Features", description: "Paid guild add-ons, plan pricing, and owner trial controls", group: "Premium", route: "/dashboard/premium-features" },
  { id: "heist", label: "Heist", description: "Heist signup/session controls", group: "Premium", route: "/dashboard/heist", featureKey: "heistEnabled" },
  { id: "tts", label: "TTS", description: "Text-to-speech controls", group: "Premium", route: "/dashboard/tts", featureKey: "ttsEnabled" },
  { id: "persona-ai", label: "Persona AI", description: "Hosted generative persona runtime and prompt shaping", group: "Premium", route: "/dashboard/ai/persona" },
];

export const GROUP_ORDER: EngineGroup[] = [
  "Guild Control",
  "Security",
  "Automation",
  "Economy",
  "Fun",
  "Premium",
];
