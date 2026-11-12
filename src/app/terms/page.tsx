import { MarketingHeader, MarketingFooter } from "@/components/possum/MarketingSite";
import LegalDocument from "@/components/possum/LegalDocument";

export const metadata = { title: "Terms of Service | Possum Bot" };

const list = { margin: "6px 0 0 20px", padding: 0 } as const;

export default function TermsPage() {
  return (
    <>
      <MarketingHeader />
      <LegalDocument
      title="Terms of Service"
      updated="November 5, 2026"
      intro="These terms apply when you add Possum Bot to a Discord server, use the Possum dashboard, or buy a Possum Pro plan. By doing any of these you agree to them. If you do not agree, remove the bot and stop using the dashboard."
      sections={[
        {
          title: "The service",
          body: "Possum Bot is a Discord bot and web dashboard for community management, moderation, games, automation and AI features. It is run by a small independent team and is provided as is. Features can change, be added or be removed at any time.",
        },
        {
          title: "Who can use it",
          body: "You must meet Discord's minimum age requirement and follow the Discord Terms of Service and Community Guidelines. Server owners and administrators are responsible for how the bot is configured and used in their servers, including informing their members about it.",
        },
        {
          title: "Acceptable use",
          body: (
            <>
              You agree not to:
              <ul style={list}>
                <li>Use the bot to harass, threaten, or harm anyone, or to break the law.</li>
                <li>Attempt to abuse, overload, reverse engineer or break the bot, dashboard or their security.</li>
                <li>Use the bot to spam, scam, raid or distribute malware or illegal content.</li>
                <li>Access another server&apos;s settings or data without permission.</li>
                <li>Resell or share paid features outside the server they were purchased for.</li>
              </ul>
              We may remove the bot from, or block, any server or user that breaks these rules.
            </>
          ),
        },
        {
          title: "Custom bot tokens",
          body: "If you supply your own bot token to run a branded bot, you are responsible for that bot application and its compliance with Discord's rules. Tokens are stored encrypted and used only to run that server's bot. You can remove a token from the dashboard at any time. Keep your tokens private; anyone who has one can control that bot.",
        },
        {
          title: "Possum Pro and payments",
          body: "Some features are part of the paid Possum Pro plan. Payments are handled by Stripe and we never see or store your full card details. Plans are tied to the server they are purchased for. Unless the law requires otherwise, payments are non-refundable once a billing period has started, and you can cancel any time to stop future charges. If a plan ends, Pro-only features may stop working for that server. Prices and plan features may change with notice on the website.",
        },
        {
          title: "AI features",
          body: "AI features can produce inaccurate, incomplete or inappropriate output. Do not rely on them for legal, medical, financial or safety decisions. Messages sent to an AI feature may be processed by third-party AI providers, as described in the Privacy Policy.",
        },
        {
          title: "Your content and data",
          body: "You keep ownership of the content you and your community create. You give us permission to process it only as needed to run the features you turn on. Our handling of personal data is described in the Privacy Policy.",
        },
        {
          title: "Availability and liability",
          body: "We aim to keep the bot online but do not guarantee uninterrupted or error-free service. To the fullest extent allowed by law, the service is provided without warranties and we are not liable for indirect or consequential losses, lost data, lost profits or damage to your community arising from use of the bot, outages or bugs. Our total liability for any claim is limited to the amount you paid us in the three months before the claim.",
        },
        {
          title: "Ending use",
          body: "You can stop using the service at any time by removing the bot from your server. We can suspend or end access if these terms are broken or to protect the service or other users. When the bot is removed, your server's data is deleted as described in the Privacy Policy.",
        },
        {
          title: "Changes and contact",
          body: "We may update these terms; the date at the top shows the latest version, and continuing to use the bot means you accept the update. For questions, contact us through the Possum Support server on Discord, linked from possumbot.com.",
        },
      ]}
      />
      <MarketingFooter />
    </>
  );
}
