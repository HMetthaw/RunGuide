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

Projekt je ve fázi plánování a scaffoldingu. Detailní postup je v [docs/PLAN.md](docs/PLAN.md).

## Zamýšlený stack

- React + TypeScript + Vite
- PWA manifest a service worker pro instalaci na telefon
- Web Geolocation API a Web Speech API pro GPS a hlasové pokyny
- MapLibre GL JS pro mapu a tvorbu tras
- Supabase pro přihlášení, soukromá data a budoucí soutěžní backend
- GitHub Pages pro hostování PWA

## Lokální spuštění

Po dokončení scaffoldingu bude stačit:

```bash
npm install
npm run dev
```

Produkční PWA se nasadí na GitHub Pages; v telefonu se otevře běžným odkazem a lze ji přidat na plochu.

## Projektová dokumentace

- [Plán MVP a pilotu](docs/PLAN.md)
- [Návrh backendu](docs/BACKEND.md)
- [Pravidla pro agenty a vývoj](AGENTS.md)
