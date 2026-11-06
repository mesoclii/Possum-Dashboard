export type DashboardNavItem = {
  href: string;
  label: string;
  creatorOnly?: boolean;
};

export type DashboardNavTopLink = DashboardNavItem;

export type DashboardNavSection = {
  label: string;
  defaultOpen?: boolean;
  items: DashboardNavItem[];
};

export function getSectionSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getSectionHref(label: string): string {
  return `/dashboard/group/${getSectionSlug(label)}`;
}

export function getDashboardNavTopLinks(isMasterOwner = false): DashboardNavTopLink[] {
  const topLinks: DashboardNavTopLink[] = [
    { href: "/dashboard/system-health", label: "System Health" },
    { href: "/dashboard/master", label: "Master Control", creatorOnly: true }
  ];
  return topLinks.filter(
    (item) => !item.creatorOnly || isMasterOwner
  );
}

export function getDashboardNavSections(isMasterOwner = false): DashboardNavSection[] {
  const sections: DashboardNavSection[] = [
    {
      label: "Guild Control",
      defaultOpen: true,
      items: [
        { href: "/dashboard/bot-personalizer", label: "Bot Personalizer" },
        { href: "/dashboard/bot-masters", label: "Bot Masters / Dashboard Access" },
        { href: "/dashboard/channels", label: "Channels" },
        { href: "/dashboard/infrastructure", label: "Infrastructure" },
        { href: "/dashboard/ai/learning", label: "Possum AI" },
        { href: "/dashboard/giveaways", label: "Giveaways" },
        { href: "/dashboard/jed", label: "Jed" },
        { href: "/dashboard/music", label: "Music" },
        { href: "/dashboard/vip", label: "VIP" },
        { href: "/dashboard/tickets", label: "Tickets" },
        { href: "/dashboard/selfroles", label: "Self Roles" },
      ],
    },
    {
      label: "Automation",
      items: [
        { href: "/dashboard/slash-commands", label: "Slash Commands" },
        { href: "/dashboard/commands", label: "!Command Studio" },
        { href: "/dashboard/automations/studio", label: "Automation Studio" },
        { href: "/dashboard/event-reactor", label: "Event Alerts" },
        { href: "/dashboard/runtime-router", label: "AI Talking Rules" },
      ],
    },
    {
      label: "Utilities",
      items: [
        { href: "/dashboard/utilities", label: "Utilities" },
        { href: "/dashboard/reviews", label: "Reviews" },
        { href: "/dashboard/search-anything", label: "Search Anything" },
        { href: "/dashboard/analytics", label: "Analytics" },
        { href: "/dashboard/community-studio", label: "Community Studio" },
        { href: "/dashboard/channel-flow", label: "Channel Flow" },
      ],
    },
    {
      label: "Social Alerts",
      items: [
        { href: "/dashboard/social-alerts", label: "Social Alerts" },
        { href: "/dashboard/signal-relay", label: "Signal Relay" },
      ],
    },
    {
      label: "Security",
      items: [
        { href: "/dashboard/security", label: "Security" },
        { href: "/dashboard/moderator", label: "Moderator" },
        { href: "/dashboard/governance", label: "Governance" },
        { href: "/dashboard/security/pre-onboarding", label: "Pre-Onboarding" },
        { href: "/dashboard/security/onboarding", label: "Onboarding" },
        { href: "/dashboard/security/verification", label: "Verification" },
        { href: "/dashboard/security/account-integrity", label: "Account Integrity" },
        { href: "/dashboard/security/link-intel", label: "Link Intel" },
        { href: "/dashboard/security/threat-intel", label: "Threat Intel" },
        { href: "/dashboard/security/behavioral-drift", label: "Behavioral Drift" },
        { href: "/dashboard/security/trust-weight", label: "Trust Weight" },
        { href: "/dashboard/security/risk-escalation", label: "Risk Escalation" },
        { href: "/dashboard/security/containment", label: "Containment" },
        { href: "/dashboard/security/forensics", label: "Forensics" },
        { href: "/dashboard/security/staff-activity", label: "Staff Activity" },
        { href: "/dashboard/security/crew-security", label: "Crew Security" },
        { href: "/dashboard/security/shadow-layer", label: "Shadow Layer" },
        { href: "/dashboard/security/activity-prune", label: "Activity Prune" },
        { href: "/dashboard/security-enforcer", label: "Security Enforcer" },
        { href: "/dashboard/blacklist", label: "Blacklist" },
        { href: "/dashboard/modder-intel", label: "Modder Intel" },
        { href: "/dashboard/failsafe", label: "Failsafe" },
      ],
    },
    {
      label: "Economy",
      items: [
        { href: "/dashboard/economy", label: "Economy" },
        { href: "/dashboard/economy/events", label: "Event Points" },
        { href: "/dashboard/economy/rewards", label: "Daily + Work" },
        { href: "/dashboard/economy/store", label: "Store" },
        { href: "/dashboard/economy/progression", label: "Progression" },
        { href: "/dashboard/prestige", label: "Prestige" },
        { href: "/dashboard/economy/radio-birthday", label: "Radio" },
        { href: "/dashboard/economy/leaderboard", label: "Invite Tracker" },
        { href: "/dashboard/profile", label: "Profile" },
        { href: "/dashboard/halloffame", label: "Hall Of Fame" },
        { href: "/dashboard/achievements", label: "Achievements" },
        { href: "/dashboard/loyalty", label: "Loyalty" },
      ],
    },
    {
      label: "Gaming",
      items: [
        { href: "/dashboard/games", label: "Gaming Hub" },
        { href: "/dashboard/wow", label: "WoW Groups" },
      ],
    },
    {
      label: "Fun + Games",
      items: [
        { href: "/dashboard/crew", label: "Crew" },
        { href: "/dashboard/dominion", label: "Dominion" },
        { href: "/dashboard/contracts", label: "Contracts" },
        { href: "/dashboard/catdrop", label: "Cat Drop" },
        { href: "/dashboard/rarespawn", label: "Rare Spawn" },
        { href: "/dashboard/range", label: "Range" },
        { href: "/dashboard/truthdare", label: "Truth Dare" },
        { href: "/dashboard/pokemon-catching", label: "Pokemon Catching" },
        { href: "/dashboard/pokemon-battle", label: "Pokemon Battle" },
        { href: "/dashboard/pokemon-trade", label: "Pokemon Trade" },
      ],
    },
    {
      label: "Premium",
      items: [
        { href: "/dashboard/premium-features", label: "Premium Features" },
        { href: "/dashboard/heist", label: "Heist" },
        { href: "/dashboard/tts", label: "TTS" },
        { href: "/dashboard/ai/persona", label: "Persona AI" },
        { href: "/dashboard/social-alerts", label: "Social Alerts" },
        { href: "/dashboard/signal-relay", label: "Signal Relay" },
        { href: "/dashboard/search-anything", label: "Search Anything" },
        { href: "/dashboard/analytics", label: "Analytics" },
        { href: "/dashboard/system-health/backups", label: "Config Backup" },
        { href: "/dashboard/bot-personalizer#second-token-bot", label: "Second Token Bot (Yearly)" },
        { href: "/dashboard/bot-personalizer#third-token-bot", label: "Third Token Bot (Lifetime)" },
        { href: "/dashboard/premium-features#advanced-security", label: "Advanced Security Suite" },
        { href: "/dashboard/premium-features#automation-suite", label: "Automation + Commands" },
        { href: "/dashboard/ai/openai-platform", label: "Creator AI Platform", creatorOnly: true },
      ],
    },
  ];

  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.creatorOnly || isMasterOwner),
    }))
    .filter((section) => section.items.length > 0);
}
