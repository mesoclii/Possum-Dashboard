import Link from "next/link";
import { MarketingHeader, MarketingFooter } from "@/components/possum/MarketingSite";
import { buildPublicInviteUrl, buildSupportServerUrl } from "@/lib/publicLinks";

export const metadata = { title: "Getting Started & Guides | Possum Bot" };

const steps = [
  { number: "01", title: "Invite Possum", text: "Use the Discord invite flow and choose the server where you have permission to add bots. Review the requested permissions before approving." },
  { number: "02", title: "Sign in to the dashboard", text: "Use Discord login, then open the guild selector. The dashboard only lists servers your Discord account is allowed to manage and where the bot can be configured." },
  { number: "03", title: "Choose your starting modules", text: "Begin with the features your community needs: onboarding, moderation, tickets, roles, engagement or voice. Some advanced modules require Pro or additional provider setup." },
  { number: "04", title: "Connect your server structure", text: "Map the channels, roles and permissions each enabled feature needs. Keep the bot role high enough to manage the roles you assign, without granting permissions it does not need." },
  { number: "05", title: "Test, then go live", text: "Test the member journey and staff workflows with a small group. Check system status and dashboard health before relying on a feature for a major event." },
];

export default function DocsPage() {
  return (
    <>
      <MarketingHeader />
      <main className="marketing-main info-main docs-main">
        <section className="info-hero">
          <div className="eyebrow"><span className="eyebrow-dot" /> THE QUICK-START FIELD GUIDE</div>
          <h1>From invite to<br /><span>up and running.</span></h1>
          <p>Get Possum into your server, connect the dashboard and bring your first modules online. You do not need to configure everything at once.</p>
          <div className="hero-actions"><a href={buildPublicInviteUrl()} className="site-button">Invite Possum ↗</a><Link href="/features" className="site-button site-button-quiet">Browse features →</Link></div>
        </section>
        <section className="docs-steps">
          {steps.map((step) => <article className="docs-step" key={step.number}><span>{step.number}</span><div><h2>{step.title}</h2><p>{step.text}</p></div></article>)}
        </section>
        <section className="docs-help"><div><div className="eyebrow">NEED A HAND?</div><h2>We can help you get the pieces talking.</h2><p>Visit the support community for setup questions, feature requests and troubleshooting.</p></div><div className="hero-actions"><a href={buildSupportServerUrl()} target="_blank" rel="noreferrer" className="site-button">Open support server ↗</a><Link href="/status" className="site-button site-button-quiet">Check system status →</Link></div></section>
      </main>
      <MarketingFooter />
    </>
  );
}
