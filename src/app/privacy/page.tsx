import { MarketingHeader, MarketingFooter } from "@/components/possum/MarketingSite";
import LegalDocument from "@/components/possum/LegalDocument";

export const metadata = { title: "Privacy Policy | Possum Bot" };

const list = { margin: "6px 0 0 20px", padding: 0 } as const;

export default function PrivacyPage() {
  return (
    <>
      <MarketingHeader />
      <LegalDocument
      title="Privacy Policy"
      updated="November 5, 2026"
      intro="This policy explains what information Possum Bot and the Possum dashboard collect, why, and how you can have it removed. Each Discord server's settings and data are kept separate and are not shown to other servers."
      sections={[
        {
          title: "What we collect",
          body: (
            <ul style={list}>
              <li>
                <b>Discord identifiers:</b> user IDs, usernames, server (guild) IDs and names, channel and role IDs.
              </li>
              <li>
                <b>Server configuration:</b> the settings, templates, automations and feature choices owners set in the dashboard.
              </li>
              <li>
                <b>Activity data for enabled features:</b> things like XP and levels, economy and game progress, moderation and security events, audit logs, voice activity durations, tickets and verification state.
              </li>
              <li>
                <b>Message content:</b> the bot reads messages in channels it can see in order to run commands, automations, moderation and AI features. Message text is not kept long term unless a feature needs it, such as AI memory, logs or tickets.
              </li>
              <li>
                <b>Dashboard login:</b> when you sign in with Discord we receive your Discord ID, name and the list of servers you manage.
              </li>
              <li>
                <b>Billing:</b> Stripe customer and subscription identifiers and plan status. We do not see or store full card numbers.
              </li>
              <li>
                <b>Custom bot tokens:</b> if you provide one, it is stored encrypted and used only to run that server&apos;s bot.
              </li>
            </ul>
          ),
        },
        {
          title: "How we use it",
          body: "To run the features your server turns on, secure and moderate communities, show you your dashboard, process payments, prevent abuse, fix problems and improve the service. We do not sell personal data and we do not use it for advertising.",
        },
        {
          title: "Who we share it with",
          body: (
            <>
              Only service providers needed to operate the bot:
              <ul style={list}>
                <li>Discord, which the bot runs on.</li>
                <li>Stripe, for payments.</li>
                <li>Our hosting and database providers.</li>
                <li>
                  Third-party AI providers, when an AI feature is used. The text of the message being answered, along with limited context, may be sent to generate a reply.
                </li>
              </ul>
              We may also disclose information if required by law or to protect users and the service.
            </>
          ),
        },
        {
          title: "Separation between servers",
          body: "Settings, secrets and data are stored per server and are only available to that server's authorised administrators through the dashboard. A server's custom bot token is never used for any other server.",
        },
        {
          title: "How long we keep it",
          body: "Data is kept while the bot is in your server. If the bot is removed or kicked, the server's stored data and settings are deleted after a short grace period (7 days by default) so a mistaken removal can be undone. Billing records may be kept longer where needed for accounting and legal reasons. Logs and activity history are trimmed over time according to each plan's retention limits.",
        },
        {
          title: "Security",
          body: "Secrets such as bot tokens are encrypted at rest, the dashboard uses signed sessions, and access is limited to the people who run the service. No system is perfectly secure, so please protect your Discord account with 2FA.",
        },
        {
          title: "Your choices and rights",
          body: "Server owners can change or disable features and remove stored tokens in the dashboard, or remove the bot to start deletion of the server's data. Any user can ask to see or delete the personal data we hold about them, and you may have additional rights under laws such as the GDPR or CCPA. To make a request, contact us through the Possum Support server on Discord. We may need to verify your Discord identity first.",
        },
        {
          title: "Children",
          body: "Possum Bot is intended for people who meet Discord's minimum age requirement. We do not knowingly collect data from anyone younger. If you believe we have, contact us and we will remove it.",
        },
        {
          title: "Changes and contact",
          body: "We may update this policy; the date at the top shows the latest version. For questions or requests, contact us through the Possum Support server on Discord, linked from possumbot.com.",
        },
      ]}
      />
      <MarketingFooter />
    </>
  );
}
