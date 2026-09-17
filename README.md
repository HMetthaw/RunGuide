# RunGuide

Instalovatelná webová aplikace (PWA) pro běžce: naplánuješ vlastní trasu, zadáš vzdálenost a cílový čas, a během běhu dostáváš GPS navigaci i hlasové vedení tempa do sluchátek.

## Cíl první verze

- Nakreslit vlastní trasu na mapě před během.
- Nastavit vzdálenost a cílový čas; aplikace spočítá cílové tempo v min/km.
- Při běhu sledovat GPS polohu, vzdálenost a aktuální tempo.
- Hlasem oznámit nadcházející odbočení a doporučit zrychlení nebo zpomalení.
- Ukládat tvoje soukromé trasy a historii běhů do cloudu pod vlastním účtem.
- Zobrazit u každého historického běhu zjednodušenou mapku trasy.

## Stav

Osobní testovací verze v [runner.html](runner.html) má plánování tras, filtrovanou GPS, vyhlazené aktuální tempo, pauzu a obnovu běhu, hlasové rady, mapky skutečných stop, export a soukromou historii. Nová implementace je v TypeScriptu a má automatické testy. Přehled nalezených chyb a ověření je v [auditu](docs/AUDIT.md).

Cloudový klient a databázové migrace jsou připravené, ale žádný živý Supabase projekt není propojený. Bez konfigurace funguje aplikace pouze místně. Navigace zatím sleduje ručně zvolené body, ne pěší routing po cestách. GPS a zvuk ještě potřebují reálný terénní test v telefonu.

## Zamýšlený stack

- TypeScript strict + Vite, s oddělenou doménovou logikou a webovým rozhraním
- Generovaný PWA manifest a service worker, offline shell včetně písem a Leafletu
- Web Geolocation API a Web Speech API pro GPS a hlasové pokyny
- Leaflet + OpenStreetMap pro mapu a tvorbu tras
- Supabase pro přihlášení, soukromá data a budoucí soutěžní backend
- GitHub Pages pro hostování PWA

## Lokální spuštění

Použij Node.js 24 a instalaci z uzamčených závislostí:

```bash
npm ci
npm run dev
```

Dev server vypíše adresu; otevři na ní `/runner.html`. Samotný Python server nad zdrojovou složkou už TypeScript nezpracuje.

```bash
npm run check
npm run preview
```

`check` provede TypeScript, ESLint, testy a produkční build. `preview` otevře build na `http://127.0.0.1:4173/runner.html`. PWA cache je aktivní pouze v produkčním buildu. Starý prototyp se může při prvním otevření načíst z původní cache; zavři všechny jeho karty a znovu otevři. Nová verze aktualizace nabízí mimo rozběhnutý běh.

Manifest i service worker generuje Vite do `dist/`; neupravuj je ručně. CI je v `.github/workflows/check.yml`, ručně spouštěné nasazení Pages v `.github/workflows/pages.yml`. GitHub remote ani veřejná adresa zatím nejsou založené. Pages workflow počítá s adresou `https://uživatel.github.io/název-repozitáře/`; pro vlastní doménu nastav `BASE_PATH=/`.

Cloud připrav podle [docs/BACKEND.md](docs/BACKEND.md). Veřejné `VITE_` hodnoty se zapisují do `.env` nebo GitHub repository variables; nikdy do nich nedávej service-role/secret klíč.

## Projektová dokumentace

- [Plán MVP a pilotu](docs/PLAN.md)
- [Popis aktuálního běžeckého jádra](docs/CORE_APP.md)
- [Audit a výsledky testů](docs/AUDIT.md)
- [Návrh backendu](docs/BACKEND.md)
- [Pravidla pro agenty a vývoj](AGENTS.md)
