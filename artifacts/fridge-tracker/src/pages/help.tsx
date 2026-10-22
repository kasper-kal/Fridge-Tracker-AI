import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  ChevronLeft, Refrigerator, Snowflake, Package, Plus, ShoppingCart,
  Users, UserCircle, Camera, ScanLine, Pencil, Trash2, ArrowLeftRight,
  Home, QrCode, LogOut, LogIn, Smartphone, Minus, Search, ArrowUpDown, Share2, Bell, BookOpen
} from "lucide-react";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  steps?: string[];
  tip?: string;
  color?: string;
}

function FeatureCard({ icon, title, description, steps, tip, color = "bg-primary/10 text-primary" }: FeatureCardProps) {
  return (
    <div className="bg-card border border-border rounded-3xl p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-2xl ${color} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <h3 className="font-bold text-base text-foreground">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      {steps && (
        <ol className="space-y-1.5">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-foreground">{s}</span>
            </li>
          ))}
        </ol>
      )}
      {tip && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
          <Bell className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400">{tip}</p>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="pt-2">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

function MockScreen({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">{label}</p>
      <div className="bg-secondary/20 rounded-3xl border border-border p-4 space-y-2">
        {children}
      </div>
    </div>
  );
}

function NavItem({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl ${active ? "bg-primary/10" : ""}`}>
      <div className={active ? "text-primary" : "text-muted-foreground"}>{icon}</div>
      <span className={`text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );
}

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
      {children}
    </span>
  );
}

export default function HelpPage() {
  return (
    <Layout>
      {/* Header */}
      <div className="px-5 lg:px-10 pt-12 lg:pt-10 pb-5 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/account">
            <button className="p-2 rounded-full hover:bg-secondary transition-colors">
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Gebruikersaanwijzing</h1>
        </div>
        <p className="text-sm text-muted-foreground">Alles over het gebruik van Koelkast Tracker.</p>
      </div>

      <div className="px-5 lg:px-10 pb-20 lg:pb-10 space-y-8 max-w-4xl">

        {/* ── QUICK GUIDE ── */}
        <div className="bg-card border border-border rounded-3xl p-5 space-y-3">
          <h2 className="text-base font-bold text-foreground">Welkom bij Koelkast Tracker</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Voeg snel producten toe via de <strong className="text-foreground">+ knop</strong> — handmatig, met de camera, of door een kassabon te scannen. Veeg op een product naar <strong className="text-foreground">links</strong> om het te verplaatsen, op je boodschappenlijst te zetten, of te verwijderen.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Deel je voorraad met huisgenoten via <strong className="text-foreground">Huishouden</strong> rechtsbovenin. Maak een huishouden aan met een naam en pincode, en deel die met je gezinsleden zodat jullie samen dezelfde lijst zien.
          </p>
        </div>

        {/* ── 1. NAVIGATIE ── */}
        <SectionHeader title="1. Navigatie" subtitle="De drie tabs en de knoppen bovenin" />

        <MockScreen label="Onderste navigatiebalk">
          <div className="flex justify-around items-center py-2 bg-card rounded-2xl border border-border">
            <NavItem icon={<Refrigerator className="w-5 h-5" />} label="Koelkast" active />
            <NavItem icon={<Package className="w-5 h-5" />} label="Voorraad" />
            <NavItem icon={<Snowflake className="w-5 h-5" />} label="Vriezer" />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <div className="w-2 h-2 rounded-full bg-primary" />
            Actieve tab is blauw gemarkeerd
          </div>
        </MockScreen>

        <FeatureCard
          icon={<Refrigerator className="w-5 h-5" />}
          title="Koelkast"
          description="Hier bewaar je verse producten zoals zuivel, groenten en vlees. Tik op een tab onderin om te wisselen."
        />
        <FeatureCard
          icon={<Package className="w-5 h-5" />}
          title="Voorraad"
          description="Voor droge waren, blikken, pasta, rijst en andere houdbare producten."
          color="bg-amber-500/10 text-amber-600"
        />
        <FeatureCard
          icon={<Snowflake className="w-5 h-5" />}
          title="Vriezer"
          description="Producten die je ingevroren bewaart. Alles op één plek bijhouden."
          color="bg-indigo-500/10 text-indigo-600"
        />

        <MockScreen label="Knoppen rechtsbovenin">
          <div className="flex justify-end gap-2 p-2">
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-secondary/50 border border-border">
              <UserCircle className="w-4 h-4 text-foreground" />
              <span className="text-xs font-medium">Account</span>
            </div>
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-secondary/50 border border-border">
              <Users className="w-4 h-4 text-foreground" />
              <span className="text-xs font-medium">Huishouden</span>
            </div>
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-secondary/50 border border-border">
              <ShoppingCart className="w-4 h-4 text-foreground" />
              <span className="text-xs font-medium">Lijst</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground px-1">Van links naar rechts: Account · Huishouden · Boodschappenlijst</p>
        </MockScreen>

        {/* ── 2. PRODUCT TOEVOEGEN ── */}
        <SectionHeader title="2. Product toevoegen" subtitle="Drie manieren om producten toe te voegen" />

        <MockScreen label="De + knop">
          <div className="flex justify-center py-3">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg">
              <Plus className="w-7 h-7 text-white" />
            </div>
          </div>
          <p className="text-xs text-center text-muted-foreground">Drijvende + knop boven de navigatiebalk</p>
        </MockScreen>

        <FeatureCard
          icon={<Pencil className="w-5 h-5" />}
          title="Handmatig invoeren"
          description="Voer de productnaam, hoeveelheid en eenheid zelf in."
          steps={[
            "Tik op de + knop onderin",
            "Kies de tab 'Handmatig'",
            "Vul naam, hoeveelheid en eenheid in",
            "Kies koelkast, voorraad of vriezer",
            "Tik op 'Toevoegen'",
          ]}
        />

        <FeatureCard
          icon={<ScanLine className="w-5 h-5" />}
          title="Barcode scannen"
          description="Scan de streepjescode op de verpakking om automatisch de productnaam in te vullen."
          steps={[
            "Tik op de + knop",
            "Kies de tab 'Barcode'",
            "Geef cameratoestemming",
            "Houd de barcode voor de camera",
            "De naam wordt automatisch ingevuld",
          ]}
          tip="Zorg voor goede belichting en houd de code stil voor de camera."
          color="bg-emerald-500/10 text-emerald-600"
        />

        <FeatureCard
          icon={<Camera className="w-5 h-5" />}
          title="Kassabon scannen"
          description="Maak een foto van je kassabon. De AI herkent alle producten automatisch en voegt ze toe."
          steps={[
            "Tik op de + knop",
            "Kies de tab 'Kassabon'",
            "Maak een foto of kies een bestaande",
            "Wacht terwijl de AI de bon verwerkt",
            "Controleer de producten en bevestig",
          ]}
          tip="Leg de bon plat op een vlak ondergrond voor de beste resultaten."
          color="bg-violet-500/10 text-violet-600"
        />

        {/* ── 3. PRODUCTEN BEHEREN ── */}
        <SectionHeader title="3. Producten beheren" subtitle="Bewerken, verplaatsen en verwijderen" />

        <MockScreen label="Veeg naar links voor acties">
          <div className="relative rounded-2xl overflow-hidden border border-border">
            <div className="absolute inset-y-0 right-0 flex">
              <div className="w-16 bg-emerald-500 flex flex-col items-center justify-center gap-1">
                <ShoppingCart className="w-4 h-4 text-white" />
                <span className="text-[9px] text-white font-bold">Lijst</span>
              </div>
              <div className="w-16 bg-sky-500 flex flex-col items-center justify-center gap-1">
                <Refrigerator className="w-4 h-4 text-white" />
                <span className="text-[9px] text-white font-bold">Koelkast</span>
              </div>
              <div className="w-16 bg-amber-500 flex flex-col items-center justify-center gap-1">
                <Package className="w-4 h-4 text-white" />
                <span className="text-[9px] text-white font-bold">Voorraad</span>
              </div>
              <div className="w-16 bg-red-500 rounded-r-2xl flex flex-col items-center justify-center gap-1">
                <Trash2 className="w-4 h-4 text-white" />
                <span className="text-[9px] text-white font-bold">Verwijder</span>
              </div>
            </div>
            <div className="bg-card p-4 flex items-center justify-between" style={{ transform: "translateX(-200px)" }}>
              <div>
                <p className="font-semibold text-sm">Melk</p>
                <p className="text-xs text-muted-foreground">2 liter</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                  <Minus className="w-3 h-3" />
                </div>
                <span className="font-bold text-sm w-6 text-center">2</span>
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                  <Plus className="w-3 h-3" />
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" /> Op boodschappenlijst</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-sky-500 shrink-0" /> Verplaats locatie</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" /> Verplaats locatie</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 shrink-0" /> Verwijderen</div>
          </div>
        </MockScreen>

        <FeatureCard
          icon={<ArrowLeftRight className="w-5 h-5" />}
          title="Veeg naar links"
          description="Veeg een product naar links om vier acties te zien: toevoegen aan boodschappenlijst, verplaatsen naar twee andere locaties, of verwijderen."
          tip="Tik ergens anders op het scherm om de acties te sluiten zonder iets te doen."
        />

        <FeatureCard
          icon={<Pencil className="w-5 h-5" />}
          title="Product bewerken"
          description="Tik op de naam van een product om het te bewerken. Je kunt de naam, hoeveelheid en eenheid aanpassen."
          steps={[
            "Tik op de naam van het product",
            "Pas naam, hoeveelheid of eenheid aan",
            "Tik op het vinkje om op te slaan",
          ]}
          color="bg-amber-500/10 text-amber-600"
        />

        <FeatureCard
          icon={<Plus className="w-5 h-5" />}
          title="Hoeveelheid aanpassen"
          description="Gebruik de + en – knoppen rechts op elke productkaart om de hoeveelheid snel aan te passen zonder te bewerken."
          color="bg-emerald-500/10 text-emerald-600"
        />

        {/* ── 4. ZOEKEN & SORTEREN ── */}
        <SectionHeader title="4. Zoeken & Sorteren" />

        <MockScreen label="Zoekbalk en sorteerknop">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-card rounded-xl border border-border">
              <Search className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Zoeken...</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2.5 bg-card rounded-xl border border-border">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </MockScreen>

        <FeatureCard
          icon={<Search className="w-5 h-5" />}
          title="Zoeken"
          description="Typ in de zoekbalk om direct producten te filteren op naam. Het resultaat wordt live bijgewerkt."
        />

        <FeatureCard
          icon={<ArrowUpDown className="w-5 h-5" />}
          title="Sorteren"
          description="Tik op het sorteerknopje om producten te rangschikken op: nieuwste, oudste, naam A–Z, naam Z–A, hoeveelheid hoog of laag."
          color="bg-violet-500/10 text-violet-600"
        />

        {/* ── 5. BOODSCHAPPENLIJST ── */}
        <SectionHeader title="5. Boodschappenlijst" subtitle="Tik op het winkelwagenicoontje rechtsboven" />

        <MockScreen label="Boodschappenlijst">
          <div className="space-y-2">
            {["Melk", "Eieren", "Brood"].map((name, i) => (
              <div key={name} className={`flex items-center gap-3 p-3 rounded-xl border ${i === 2 ? "opacity-50" : ""} bg-card border-border`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${i === 2 ? "bg-primary border-primary" : "border-border"}`}>
                  {i === 2 && <span className="text-white text-xs">✓</span>}
                </div>
                <span className={`text-sm font-medium ${i === 2 ? "line-through text-muted-foreground" : ""}`}>{name}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-xs text-primary font-medium">Gedeeld met Familie Kal</span>
            <div className="ml-auto w-8 h-4 rounded-full bg-primary" />
          </div>
        </MockScreen>

        <FeatureCard
          icon={<ShoppingCart className="w-5 h-5" />}
          title="Items toevoegen"
          description="Typ een product bovenin de lijst en tik op + of druk op Enter. Je kunt ook via de veeg-actie op producten direct aan de lijst toevoegen."
          steps={[
            "Tik op het winkelwagenicoontje rechtsboven",
            "Typ een productnaam en tik op +",
            "Of veeg een product naar links → tik op 'Lijst'",
          ]}
          color="bg-emerald-500/10 text-emerald-600"
        />

        <FeatureCard
          icon={<Users className="w-5 h-5" />}
          title="Delen met huishouden"
          description="Zet de schakelaar 'Delen met huishouden' aan om je lijst te synchroniseren met alle huisgenoten. Iedereen ziet dezelfde lijst en kan items afvinken."
          tip="De lijst wordt alleen gedeeld als je in een huishouden zit en de schakelaar aan staat."
          color="bg-sky-500/10 text-sky-600"
        />

        <FeatureCard
          icon={<Share2 className="w-5 h-5" />}
          title="Lijst delen"
          description="Tik op het deelicoon in de boodschappenlijst om de lijst te delen via WhatsApp, berichten of te kopiëren naar het klembord."
          color="bg-amber-500/10 text-amber-600"
        />

        {/* ── 6. HUISHOUDEN ── */}
        <SectionHeader title="6. Huishouden" subtitle="Deel je koelkast met gezinsleden" />

        <MockScreen label="Huishoudenpaneel">
          <div className="space-y-2">
            <div className="flex rounded-xl bg-muted p-1 gap-1">
              <div className="flex-1 py-2 text-sm font-semibold rounded-lg bg-background shadow-sm text-center">Aanmaken</div>
              <div className="flex-1 py-2 text-sm text-muted-foreground text-center">Lid worden</div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Naam huishouden</p>
              <div className="px-3 py-2.5 bg-card rounded-xl border border-border text-sm">Familie de Vries</div>
              <p className="text-xs text-muted-foreground font-medium">Pincode</p>
              <div className="px-3 py-2.5 bg-card rounded-xl border border-border text-sm font-mono">••••</div>
            </div>
          </div>
        </MockScreen>

        <FeatureCard
          icon={<Home className="w-5 h-5" />}
          title="Huishouden aanmaken"
          description="Maak een gedeeld huishouden aan met een naam en pincode. Deel deze gegevens met je huisgenoten zodat zij kunnen inloggen."
          steps={[
            "Tik op het personenicoontje rechtsboven",
            "Kies 'Aanmaken'",
            "Vul een naam en pincode in",
            "Tik op 'Huishouden aanmaken'",
            "Deel de naam + pincode met huisgenoten",
          ]}
          color="bg-emerald-500/10 text-emerald-600"
        />

        <FeatureCard
          icon={<Users className="w-5 h-5" />}
          title="Lid worden"
          description="Word lid van een bestaand huishouden via naam + pincode of door een QR-code te scannen."
          steps={[
            "Tik op het personenicoontje rechtsboven",
            "Kies 'Lid worden'",
            "Kies 'Naam + pin' of 'QR scannen'",
            "Voer de gegevens in en bevestig",
          ]}
        />

        <FeatureCard
          icon={<QrCode className="w-5 h-5" />}
          title="QR-code delen"
          description="Als je al in een huishouden zit, tik dan op 'QR-code tonen' om een code te laten zien. Anderen kunnen die scannen om automatisch lid te worden."
          color="bg-violet-500/10 text-violet-600"
        />

        {/* ── 7. ACCOUNT ── */}
        <SectionHeader title="7. Account" subtitle="Tik op het persoonsicoon linksboven" />

        <FeatureCard
          icon={<UserCircle className="w-5 h-5" />}
          title="Gebruikersnaam wijzigen"
          description="Tik op het potloodicoontje naast je naam om je gebruikersnaam aan te passen. De nieuwe naam is zichtbaar voor huisgenoten."
          steps={[
            "Tik op het persoonsicoon linksboven",
            "Tik op het potloodicoontje naast je naam",
            "Typ je nieuwe naam",
            "Druk op Enter of tik op het vinkje",
          ]}
        />

        <FeatureCard
          icon={<LogIn className="w-5 h-5" />}
          title="Opnieuw inloggen na uitloggen"
          description="Je raakt je koelkast niet kwijt door uit te loggen. Je apparaatprofiel blijft bewaard en je profiel is aan je account gekoppeld, dus je kunt altijd opnieuw inloggen."
          steps={[
            "Tik op het persoonsicoon linksboven",
            "Kies 'Inloggen' bij 'Account en andere apparaten'",
            "Log op dezelfde manier in als eerder",
            "Je profiel, huishouden en producten komen terug",
          ]}
          color="bg-sky-500/10 text-sky-600"
        />

        <FeatureCard
          icon={<Smartphone className="w-5 h-5" />}
          title="Inloggen op een tweede apparaat"
          description="Op een nieuw apparaat of in een andere browser kies je op het startscherm voor 'Inloggen'. Je hoeft geen nieuw profiel te maken: het bestaande profiel wordt aan dat apparaat gekoppeld."
          steps={[
            "Open de app op het nieuwe apparaat",
            "Kies 'Inloggen' op het startscherm",
            "Log in met dezelfde gegevens (e-mail of social)",
            "Je huishouden en voorraad worden automatisch geladen",
          ]}
          tip="Zit je in een huishouden, dan zie je op elk apparaat dezelfde gedeelde voorraad."
          color="bg-emerald-500/10 text-emerald-600"
        />

        <FeatureCard
          icon={<LogOut className="w-5 h-5" />}
          title="Uitloggen"
          description="Tik op 'Log uit' op de accountpagina. Je wordt uitgelogd, maar je profiel en je koelkast blijven op dit apparaat staan. Daarna kun je op elk moment weer inloggen."
          tip="Wil je juist alles van dit apparaat wissen? Gebruik dan 'Apparaat resetten' onderaan de accountpagina."
          color="bg-destructive/10 text-destructive"
        />

        <div className="pt-4 pb-2 text-center">
          <p className="text-xs text-muted-foreground">Koelkast Tracker · versie 1.0</p>
          <p className="text-xs text-muted-foreground mt-0.5">Heb je nog vragen? Stuur een berichtje via de instellingen.</p>
        </div>
      </div>
    </Layout>
  );
}
