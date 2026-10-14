import { getPlatformSettings } from "@/server/billing/settings";

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const settings = await getPlatformSettings();
  return (
    <main className="legal-page">
      <a href="/">Holos</a>
      <h1>Términos y condiciones</h1>
      <article>{settings.termsText}</article>
    </main>
  );
}
