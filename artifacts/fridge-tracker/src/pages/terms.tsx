import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";
import { Layout } from "@/components/layout";

export default function TermsPage() {
  return (
    <Layout>
      <div className="px-6 lg:px-10 pt-12 lg:pt-10 pb-2 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/account">
          <button className="p-2 rounded-full hover:bg-secondary transition-colors">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Gebruiksvoorwaarden</h1>
      </div>

      <div className="space-y-5 text-sm text-foreground leading-relaxed">
        <p className="text-xs text-muted-foreground">Laatst bijgewerkt: juli 2026</p>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">1. Acceptatie van voorwaarden</h2>
          <p className="text-muted-foreground">Door gebruik te maken van Koelkast Tracker ga je akkoord met deze gebruiksvoorwaarden. Als je niet akkoord gaat, gebruik de app dan niet.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">2. Gebruik van de app</h2>
          <p className="text-muted-foreground">Koelkast Tracker is een persoonlijke huishoudapp bedoeld voor het bijhouden van voedselvoorraden. Je bent zelf verantwoordelijk voor het correcte gebruik van de app en de juistheid van de ingevoerde gegevens.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">3. Huishoudgegevens</h2>
          <p className="text-muted-foreground">Gegevens die je deelt binnen een huishouden zijn zichtbaar voor alle leden van dat huishouden. Deel de pincode alleen met personen die je vertrouwt.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">4. Accountblokkering</h2>
          <p className="text-muted-foreground">Beheerders behouden het recht om accounts op elk moment en zonder opgave van reden te blokkeren. Hier kan geen bezwaar tegen worden gemaakt. Bij een blokkering kun je via de app een nieuw account aanmaken.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">5. Aansprakelijkheid</h2>
          <p className="text-muted-foreground">Koelkast Tracker is niet aansprakelijk voor eventuele schade die voortvloeit uit het gebruik van de app, onjuiste gegevens of het verlopen van producten.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">6. Wijzigingen</h2>
          <p className="text-muted-foreground">Wij behouden het recht deze voorwaarden te wijzigen. Bij belangrijke wijzigingen word je via de app op de hoogte gesteld.</p>
        </section>
      </div>
      </div>
    </Layout>
  );
}
