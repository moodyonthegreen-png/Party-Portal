import { notFound } from "next/navigation";
import { getHostParty, listCoHosts } from "@/lib/host";
import { THEMES } from "@/themes";
import { CoHosts } from "./CoHosts";
import { PasswordForm, SettingsForm } from "./SettingsForm";

type Props = { params: Promise<{ slug: string }> };

export default async function HostSettings({ params }: Props) {
  const { slug } = await params;
  const party = await getHostParty(slug);
  if (!party) notFound();

  const coHosts = await listCoHosts(party.id);
  const themes = Object.values(THEMES).map((t) => ({ id: t.id, name: t.name }));

  return (
    <main style={{ paddingTop: "1.5rem", display: "grid", gap: "1.75rem" }}>
      <SettingsForm
        slug={party.slug}
        themes={themes}
        initial={{
          guestOfHonorName: party.guestOfHonorName,
          occasion: party.occasion,
          tagline: party.tagline ?? "",
          welcomeMessage: party.welcomeMessage ?? "",
          eventDate: party.eventDate,
          deadline: party.deadline,
          theme: party.theme in THEMES ? party.theme : themes[0].id,
          sections: party.sections,
          registryUrl: party.registryUrl ?? "",
          requireGuestList: party.requireGuestList,
          hostName: party.hostName ?? "",
        }}
      />
      <CoHosts
        slug={party.slug}
        guestOfHonorName={party.guestOfHonorName}
        coHosts={coHosts ?? []}
        isHost={party.viewer.kind === "host"}
        ready={coHosts !== null}
      />
      <PasswordForm slug={party.slug} hasPassword={party.hasPassword} />
    </main>
  );
}
