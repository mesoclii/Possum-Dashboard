function isEnabled(raw: string | undefined) {
  return ["1", "true", "yes", "on", "enabled"].includes(String(raw || "").trim().toLowerCase());
}

export function isPremiumEnforcementEnabled() {
  return [
    process.env.NEXT_PUBLIC_PAID_BOT_MODE,
    process.env.NEXT_PUBLIC_SAAS_PREMIUM_ENFORCEMENT,
    process.env.NEXT_PUBLIC_PREMIUM_ENFORCEMENT,
    process.env.SAAS_PREMIUM_ENFORCEMENT,
  ].some(isEnabled);
}
