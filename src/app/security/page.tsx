import { MarketingInfoPage } from "@/components/possum/MarketingSite";

export const metadata = { title: "Security & Moderation | Possum Bot" };

export default function SecurityPage() {
  return (
    <MarketingInfoPage
      eyebrow="SAFETY, OVERSIGHT & GOVERNANCE"
      title="Protect the space."
      accent="Keep control."
      lead="A healthy community needs more than a ban button. Possum combines practical moderation workflows with a layered security direction, giving owners and staff better context around the decisions they make."
      sections={[
        { title: "Everyday moderation", description: "The core moderation workflow gives authorized staff the tools to respond consistently and leave a reviewable record.", bullets: ["Warnings and moderation history", "Timeout, kick and ban actions", "Audit logging and moderation analytics", "Permission-aware staff controls"] },
        { title: "Account & link intelligence", description: "Advanced security modules are designed to add context to suspicious accounts, links and activity patterns.", bullets: ["Account integrity signals", "Link intelligence and threat indicators", "Trust weighting and behavioral drift", "Risk escalation context"] },
        { title: "Governance & containment", description: "The advanced suite focuses on policy-driven decisions and controlled responses rather than blind, one-size-fits-all automation.", bullets: ["Governance controls and risk review", "Containment workflows and tuning", "Forensic event context", "Security oversight through the dashboard"] },
        { title: "Visibility for operators", description: "Owners need to understand what the system is doing and whether its connected services are healthy.", bullets: ["System health and engine visibility", "Operational status surfaces", "Audit-friendly event trails", "Per-server configuration and access"] },
      ]}
      note="Feature availability is deployment- and plan-dependent. Basic moderation is part of the core offering. Advanced Security + Governance is an optional Pro suite; individual intelligence and containment capabilities may still be evolving. No security tool can guarantee that a server will never be attacked."
    />
  );
}
