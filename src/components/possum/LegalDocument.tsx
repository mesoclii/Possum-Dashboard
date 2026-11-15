import type { ReactNode } from "react";
import Link from "next/link";

export type LegalSection = { title: string; body: ReactNode };

export default function LegalDocument({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "transparent",
        color: "#ffadd2",
        padding: "48px 20px 80px",
      }}
    >
      <article style={{ maxWidth: 820, margin: "0 auto", lineHeight: 1.7 }}>
        <Link href="/" style={{ color: "#ff70d2", textDecoration: "none", fontSize: 14 }}>
          &larr; Back to Possum Bot
        </Link>
        <h1 style={{ fontSize: 36, margin: "18px 0 6px", letterSpacing: 0.5 }}>{title}</h1>
        <p style={{ color: "#ed8fba", margin: "0 0 22px", fontSize: 14 }}>Last updated: {updated}</p>
        <p style={{ color: "#ffadd2" }}>{intro}</p>
        {sections.map((section, index) => (
          <section key={section.title} style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 20, color: "#ff8fd5", margin: "0 0 8px" }}>
              {index + 1}. {section.title}
            </h2>
            <div style={{ color: "#ffadd2" }}>{section.body}</div>
          </section>
        ))}
        <p style={{ marginTop: 40, fontSize: 13, color: "#ed8fba" }}>
          <a href="/terms" style={{ color: "#ff70d2" }}>Terms of Service</a>
          {" · "}
          <a href="/privacy" style={{ color: "#ff70d2" }}>Privacy Policy</a>
        </p>
      </article>
    </main>
  );
}
