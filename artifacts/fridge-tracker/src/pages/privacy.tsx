import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";
import { Layout } from "@/components/layout";

export default function PrivacyPage() {
  return (
    <Layout>
      <div className="px-6 lg:px-10 pt-12 lg:pt-10 pb-2 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/account">
          <button className="p-2 rounded-full hover:bg-secondary transition-colors">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Privacybeleid</h1>
      </div>

      <div className="space-y-5 text-sm text-foreground leading-relaxed">
        <p className="text-xs text-muted-foreground">Laatst bijgewerkt: juli 2026</p>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">1. Welke gegevens verzamelen wij?</h2>
          <ul className="text-muted-foreground space-y-1 list-disc list-inside">
            <li>Een willekeurig gegenereerde apparaat-ID (opgeslagen lokaal)</li>
            <li>Jouw gekozen gebruikersnaam</li>
            <li>Je IP-adres (voor beveiligingsdoeleinden)</li>
            <li>Productgegevens die je invoert (naam, hoeveelheid, locatie)</li>
            <li>Huishoudgegevens (naam, gehashte pincode)</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">2. Hoe gebruiken wij jouw gegevens?</h2>
          <p className="text-muted-foreground">Jouw gegevens worden uitsluitend gebruikt om de app te laten functioneren. Je productgegevens zijn alleen zichtbaar voor jou en jouw huisgenoten. We verkopen of delen je gegevens niet met derden.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">3. IP-adres</h2>
          <p className="text-muted-foreground">We slaan je IP-adres op voor beveiligingsdoeleinden, zoals het opsporen van misbruik. Dit adres is alleen zichtbaar voor beheerders van de app.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">4. Cookies en lokale opslag</h2>
          <p className="text-muted-foreground">We gebruiken <em>localStorage</em> om jouw voorkeuren, apparaat-ID en sessiegegevens lokaal op te slaan. Er worden geen tracking-cookies van derden gebruikt.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">5. Gegevens verwijderen</h2>
          <p className="text-muted-foreground">Je kunt jouw lokale gegevens verwijderen door de browsergeschiedenis te wissen. Voor verwijdering van servergegevens kun je contact opnemen met de beheerder.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">6. Contact</h2>
          <p className="text-muted-foreground">Heb je vragen over dit privacybeleid? Neem contact op met de beheerder via de app.</p>
        </section>
      </div>
      </div>
    </Layout>
  );
}
