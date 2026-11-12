"use client";

import Link from "next/link";
import { buildPublicInviteUrl, buildSupportServerUrl } from "@/lib/publicLinks";

const navigation = [
  { href: "/features", label: "Features" },
  { href: "/security", label: "Security" },
  { href: "/community", label: "Community" },
  { href: "/docs", label: "Guides" },
  { href: "/status", label: "Status" },
];

export function MarketingHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-brand" aria-label="Possum Bot home">
          <span className="site-brand-mark" aria-hidden="true">P</span>
          <span className="site-brand-copy">
            <strong>POSSUM</strong>
            <small>BOT PLATFORM</small>
          </span>
        </Link>
        <nav className="site-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <Link href={item.href} key={item.href}>{item.label}</Link>
          ))}
        </nav>
        <div className="site-header-actions">
          <Link href="/guilds" className="site-login-link">Dashboard <span aria-hidden="true">↗</span></Link>
          <a href={buildPublicInviteUrl()} className="site-button site-button-small">Add to Discord <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div>
          <Link href="/" className="site-brand site-brand-footer">
            <span className="site-brand-mark" aria-hidden="true">P</span>
            <span className="site-brand-copy"><strong>POSSUM</strong><small>BUILT FOR COMMUNITIES</small></span>
          </Link>
          <p>Tools for the people who keep a community moving.</p>
        </div>
        <div className="site-footer-links">
          <Link href="/features">Features</Link>
          <Link href="/security">Security</Link>
          <Link href="/community">Community</Link>
          <Link href="/docs">Guides</Link>
          <Link href="/status">System status</Link>
          <a href={buildSupportServerUrl()} target="_blank" rel="noreferrer">Support server ↗</a>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
        <div className="site-footer-bottom">
          <span>© {new Date().getFullYear()} Possum Bot</span>
          <span>Independent project. Discord community platform.</span>
        </div>
      </div>
    </footer>
  );
}

const featureCards = [
  {
    icon: "01",
    tag: "KEEP IT ORDERLY",
    title: "Moderation & safety",
    text: "Handle warnings, timeouts, kicks and bans with moderation history and audit visibility. Give staff a consistent place to act and review.",
    href: "/security",
  },
  {
    icon: "02",
    tag: "MAKE ARRIVALS EASY",
    title: "Onboarding & access",
    text: "Guide new members through welcome and verification steps, assign roles, and route support requests through ticket workflows.",
    href: "/features",
  },
  {
    icon: "03",
    tag: "LESS REPETITIVE WORK",
    title: "Server operations",
    text: "Configure channels, roles, self-role panels, custom commands and automations from a server-aware dashboard.",
    href: "/docs",
  },
  {
    icon: "04",
    tag: "GIVE PEOPLE A REASON TO STAY",
    title: "Community progression",
    text: "Build participation with XP, levels, achievements, loyalty, economy, stores and member rewards.",
    href: "/community",
  },
  {
    icon: "05",
    tag: "MORE THAN TEXT CHAT",
    title: "Voice & experiences",
    text: "Add music, voice tools and optional AI experiences. Feature availability depends on the module, provider setup and plan.",
    href: "/features",
  },
  {
    icon: "06",
    tag: "EVENT NIGHT, ORGANIZED",
    title: "GTA event operations",
    text: "Coordinate GTA Online heist signups, signup lanes, rotations and staff-managed event sessions.",
    href: "/features",
  },
];

const principles = [
  ["Server-by-server control", "Each guild has its own configuration and authorized dashboard access."],
  ["Visible operations", "System health and public status surfaces help owners understand what is happening."],
  ["A free foundation", "Core community tools stay accessible. Optional Pro features add capacity and specialist modules."],
];

export function MarketingHome() {
  return (
    <>
      <MarketingHeader />
      <main className="marketing-main">
        <section className="marketing-hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> THE DISCORD COMMUNITY TOOLKIT</div>
            <h1>Run your server.<br /><span>Not the busywork.</span></h1>
            <p className="hero-lead">
              Possum brings moderation, onboarding, security tools, community progression and server operations
              into one connected Discord platform. Set it up around your community, then let the repetitive work
              take care of itself.
            </p>
            <div className="hero-actions">
              <a href={buildPublicInviteUrl()} className="site-button">Add Possum to Discord <span aria-hidden="true">↗</span></a>
              <Link href="/guilds" className="site-button site-button-quiet">Open dashboard <span aria-hidden="true">→</span></Link>
            </div>
            <div className="hero-proof">
              <span><i /> Server-aware configuration</span>
              <span><i /> Free core features</span>
              <span><i /> Optional Pro upgrades</span>
            </div>
          </div>

          <div className="hero-visual" aria-label="Illustrative preview of the Possum dashboard">
            <div className="visual-glow" />
            <div className="visual-window">
              <div className="visual-topbar">
                <div className="window-dots"><i /><i /><i /></div>
                <span>POSSUM / CONTROL PANEL</span>
                <span className="visual-lock">PRIVATE BY GUILD</span>
              </div>
              <div className="visual-body">
                <aside className="visual-sidebar">
                  <div className="visual-avatar">P</div>
                  <span className="visual-side-active" />
                  <span /><span /><span /><span />
                </aside>
                <div className="visual-content">
                  <div className="visual-welcome">
                    <div><small>SERVER OVERVIEW</small><strong>Your community, at a glance.</strong></div>
                    <span className="visual-server-icon">✦</span>
                  </div>
                  <div className="visual-metrics">
                    <div><small>MODULES</small><b>Connected</b><em>Per-server setup</em></div>
                    <div><small>ACCESS</small><b>Role-aware</b><em>Permission checks</em></div>
                    <div><small>ACTIVITY</small><b>Auditable</b><em>Event visibility</em></div>
                  </div>
                  <div className="visual-panel">
                    <div className="visual-panel-heading"><span>OPERATING LAYERS</span><small>CONFIGURATION PREVIEW</small></div>
                    {[
                      ["Community & onboarding", "Welcome · Verify · Roles"],
                      ["Moderation & safety", "Actions · Logs · Review"],
                      ["Engagement systems", "XP · Rewards · Events"],
                      ["Server operations", "Automations · Settings · Health"],
                    ].map(([name, detail], index) => (
                      <div className="visual-row" key={name}>
                        <span className="visual-row-number">0{index + 1}</span>
                        <span className="visual-row-copy"><b>{name}</b><small>{detail}</small></span>
                        <span className="visual-row-arrow">↗</span>
                      </div>
                    ))}
                  </div>
                  <div className="visual-footnote"><span className="visual-live-dot" /> ILLUSTRATIVE INTERFACE · FEATURES VARY BY CONFIGURATION</div>
                </div>
              </div>
            </div>
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-stamp"><span>BUILT FOR</span><b>REAL<br />COMMUNITIES</b><i>✳</i></div>
          </div>
        </section>

        <section className="marketing-strip" aria-label="Possum platform categories">
          <span>MODERATION</span><b>✳</b><span>SECURITY</span><b>✳</b><span>COMMUNITY</span><b>✳</b><span>AUTOMATION</span><b>✳</b><span>GAMING</span>
        </section>

        <section className="section-block" id="features">
          <div className="section-heading">
            <div><div className="eyebrow">ONE PLATFORM, MANY JOBS</div><h2>Everything your server<br />needs to <span>run smoothly.</span></h2></div>
            <p>Possum is modular. Start with the tools your community needs and expand as your server grows.</p>
          </div>
          <div className="feature-grid">
            {featureCards.map((feature) => (
              <Link href={feature.href} className="feature-card" key={feature.title}>
                <div className="feature-card-top"><span>{feature.icon}</span><small>{feature.tag}</small><b>↗</b></div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </Link>
            ))}
          </div>
          <div className="section-link-wrap"><Link href="/features" className="text-link">Explore the full feature catalog <span>→</span></Link></div>
        </section>

        <section className="security-band">
          <div className="security-band-art" aria-hidden="true"><div className="security-ring ring-a" /><div className="security-ring ring-b" /><div className="security-core">P</div><span className="security-orbit-label">TRUST</span><span className="security-orbit-label label-two">SIGNALS</span></div>
          <div className="security-band-copy">
            <div className="eyebrow">PROTECTION WITH CONTEXT</div>
            <h2>More signal.<br /><span>Less guesswork.</span></h2>
            <p>Possum&apos;s security direction goes beyond a single moderation command. Its layered suite brings together account integrity, link intelligence, threat signals, behavioral drift, trust weighting, risk escalation, governance and containment controls.</p>
            <p className="security-note">Basic moderation remains part of the core experience. Advanced security and governance capabilities are optional Pro features, with availability based on the live deployment.</p>
            <Link href="/security" className="site-button site-button-outline">Explore security <span>→</span></Link>
          </div>
        </section>

        <section className="section-block principles-section">
          <div className="section-heading">
            <div><div className="eyebrow">BUILT AROUND THE SERVER OWNER</div><h2>Powerful tools.<br /><span>Clear control.</span></h2></div>
            <p>Good automation should make a server easier to run, not harder to understand.</p>
          </div>
          <div className="principle-list">
            {principles.map(([title, text], index) => (
              <div className="principle-row" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></div>
            ))}
          </div>
        </section>

        <section className="final-cta">
          <div className="eyebrow">YOUR COMMUNITY, YOUR CONFIGURATION</div>
          <h2>Give your server<br /><span>a better backbone.</span></h2>
          <p>Invite Possum, choose your server and configure the tools that fit your community.</p>
          <div className="hero-actions">
            <a href={buildPublicInviteUrl()} className="site-button">Add Possum to Discord <span aria-hidden="true">↗</span></a>
            <Link href="/docs" className="site-button site-button-quiet">Read the setup guide <span aria-hidden="true">→</span></Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}

type MarketingSection = {
  title: string;
  description: string;
  bullets: string[];
};

export function MarketingInfoPage({
  eyebrow,
  title,
  accent,
  lead,
  sections,
  note,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  lead: string;
  sections: MarketingSection[];
  note?: string;
}) {
  return (
    <>
      <MarketingHeader />
      <main className="marketing-main info-main">
        <section className="info-hero">
          <div className="eyebrow"><span className="eyebrow-dot" /> {eyebrow}</div>
          <h1>{title}<br /><span>{accent}</span></h1>
          <p>{lead}</p>
        </section>
        <div className="info-grid">
          {sections.map((section, index) => (
            <section className="info-card" key={section.title}>
              <div className="info-card-index">0{index + 1}</div>
              <h2>{section.title}</h2>
              <p>{section.description}</p>
              <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
            </section>
          ))}
        </div>
        {note ? <p className="info-note">{note}</p> : null}
        <section className="info-cta">
          <div><div className="eyebrow">TAKE THE NEXT STEP</div><h2>Make Possum yours.</h2><p>Invite the bot, choose a server and configure the modules you want to use.</p></div>
          <div className="hero-actions"><a href={buildPublicInviteUrl()} className="site-button">Add to Discord ↗</a><Link href="/guilds" className="site-button site-button-quiet">Open dashboard →</Link></div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
