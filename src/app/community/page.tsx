import { MarketingInfoPage } from "@/components/possum/MarketingSite";

export const metadata = { title: "Community Tools | Possum Bot" };

export default function CommunityPage() {
  return (
    <MarketingInfoPage
      eyebrow="MAKE YOUR SERVER FEEL ALIVE"
      title="Build a community."
      accent="Not just a member list."
      lead="Possum gives communities ways to welcome people, organize support, reward participation and create reasons to come back. Turn on the pieces that fit your server instead of forcing every community into the same template."
      sections={[
        { title: "Welcomes, verification & roles", description: "Create a clearer first experience for new arrivals and give members a straightforward way to access the parts of your server meant for them.", bullets: ["Welcome and onboarding journeys", "Verification and role assignment", "Self-role panels", "Permission-aware access controls"] },
        { title: "Tickets & member support", description: "Give members a structured way to ask for help while staff keep conversations organized.", bullets: ["Ticket creation and management", "Staff assignment and participant controls", "Ticket closing and transcript routing", "Dedicated support workflows"] },
        { title: "Progression & rewards", description: "Make participation visible with progression systems and configurable rewards.", bullets: ["XP and leveling experiences", "Achievements and loyalty features", "Economy, store and inventory systems", "VIP grants and status workflows"] },
        { title: "Shared experiences", description: "Bring more activity into voice and event channels with optional specialist modules.", bullets: ["Music and voice sessions", "GTA Online heist signup coordination", "Optional AI and text-to-speech experiences", "Possum Wilds creature encounters and progression (Pro)"] },
      ]}
      note="Some experiences are optional, provider-dependent or plan-gated. Possum Wilds is a Pro feature. GTA Heist signup coordination is an event operations tool, not an in-game cheat or game modification."
    />
  );
}
