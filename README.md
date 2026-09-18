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

Cloudový klient a databázové migrace jsou připravené, ale žádný živý Supabase projekt není propojený. Bez konfigurace funguje ukládání pouze místně. Plánovač propojuje zvolené body po pěších cestách přes OSRM / FOSSGIS a přebírá délku vypočtené trasy. GPS a zvuk ještě potřebují reálný terénní test v telefonu.

## Plánování po cestách

Pěší routing používá `https://routing.openstreetmap.de/routed-foot/route/v1/foot` bez registrace, API klíče a dalších závislostí. Jde o veřejnou komunitní službu pro malý pilot, bez záruky dostupnosti; pro větší provoz zvol vlastní nebo smluvní routing. [Informace, limity a soukromí služby](https://routing.openstreetmap.de/about.html), [OSRM API](https://project-osrm.org/docs/v5.24.0/api/).

- Kliknuté body se přichytí k pěší cestě do 100 m. Mapa kreslí celou vrácenou geometrii; délka a převzetí cíle používají vzdálenost od routeru. Uzavření okruhu funguje i pro start → cíl → start.
- Aplikace slučuje rychlé klikání, odesílá nejvýš jeden požadavek za 1,1 s na otevřenou instanci plánovače a opakované výsledky drží pouze v paměti. Provozovatel limituje službu na 1 požadavek/s; nepoužívat souběžné plánování v mnoha kartách ani pro hromadný provoz.
- Nejvýš 100 zvolených bodů a 5 000 bodů výsledné geometrie. Neplatný nebo příliš velký výsledek je chyba, nikdy náhradní přímka. Během výpočtu a po chybě nelze plán uložit, převzít jeho délku ani spustit běh s nehotovou trasou; lze vrátit bod, vymazat plán nebo výpočet zopakovat.
- Uložené plány uchovávají geometrii, pěší profil, délku i body pro editaci a fungují bez nového výpočtu offline. Staré bodové plány se při výběru přepočítají, původní uložená data zůstávají zachována. Rozběhnutý starší záznam si zachová původní navigaci.
- Zvolené body plánování se odesílají FOSSGIS a mohou být v serverovém logu. GPS záznamy se routeru neposílají. Mapové podklady ani routingové odpovědi se hromadně necachují. Aktuální průchodnost a uzavírky závisejí na datech OpenStreetMap.

## Zamýšlený stack

- TypeScript strict + Vite, s oddělenou doménovou logikou a webovým rozhraním
- Generovaný PWA manifest a service worker, offline shell včetně písem a Leafletu
- Web Geolocation API a Web Speech API pro GPS a hlasové pokyny
- Leaflet + OpenStreetMap pro mapu a tvorbu tras
- Supabase pro přihlášení, soukromá data a budoucí soutěžní backend
- Cloudflare Workers Static Assets pro hostování PWA; připravená je i alternativa GitHub Pages

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

Manifest i service worker generuje Vite do `dist/`; neupravuj je ručně. Veřejná aplikace je na [runguide-landing.holes-matej1.workers.dev/runner](https://runguide-landing.holes-matej1.workers.dev/runner). Cloudflare Worker `runguide-landing` hostuje pouze statický obsah `dist/`, konfigurace je ve `wrangler.jsonc`. Cesty `/runner` i `/runner.html` vedou na běžeckou aplikaci.

Pro aktualizaci Cloudflare nejdřív ověř přihlášení, potom sestav a nasaď čerstvý výstup:

```bash
npx wrangler@4.134.0 whoami
npm run check
npx wrangler@4.134.0 deploy --config wrangler.jsonc
```

Na Windows při problému s certifikáty nastav v PowerShellu `$env:NODE_OPTIONS='--use-system-ca'`. Cloudflare tokeny patří do přihlášení Wrangleru nebo proměnných prostředí, nikdy do repozitáře. Build pro Workers používá výchozí `BASE_PATH=./`; nenasazuj sem výstup sestavený pro podadresář GitHub Pages.

CI je v `.github/workflows/check.yml`, alternativní ručně spouštěné nasazení Pages v `.github/workflows/pages.yml`. GitHub remote zatím není nastavený. Pages workflow počítá s adresou `https://uživatel.github.io/název-repozitáře/`; pro vlastní doménu nastav `BASE_PATH=/`.

Cloud připrav podle [docs/BACKEND.md](docs/BACKEND.md). Veřejné `VITE_` hodnoty se zapisují do `.env` nebo GitHub repository variables; nikdy do nich nedávej service-role/secret klíč.

## Projektová dokumentace

- [Plán MVP a pilotu](docs/PLAN.md)
- [Popis aktuálního běžeckého jádra](docs/CORE_APP.md)
- [Audit a výsledky testů](docs/AUDIT.md)
- [Návrh backendu](docs/BACKEND.md)
- [Pravidla pro agenty a vývoj](AGENTS.md)
