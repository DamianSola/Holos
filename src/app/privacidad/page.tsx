import { getPlatformSettings } from "@/server/billing/settings";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const settings = await getPlatformSettings();
  return (
    <main className="legal-page">
      <a href="/">Holos</a>
      <h1>Política de privacidad</h1>
      <article>{settings.privacyText}</article>
    </main>
  );
}
