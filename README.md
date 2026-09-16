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

První funkční prototyp běžeckého jádra je v [runner.html](runner.html): plánování cíle, kreslení vlastní trasy, GPS běh, základní hlasové rady a lokální historie. V této fázi zůstávají data jen v telefonu; před testem s dalšími lidmi připojíme zabezpečený cloudový účet.

## Zamýšlený stack

- Statický HTML, CSS a JavaScript prototyp; případná komponentová vrstva přijde až s růstem aplikace
- PWA manifest a service worker pro instalaci na telefon
- Web Geolocation API a Web Speech API pro GPS a hlasové pokyny
- Leaflet + OpenStreetMap pro mapu a tvorbu tras
- Supabase pro přihlášení, soukromá data a budoucí soutěžní backend
- GitHub Pages pro hostování PWA

## Lokální spuštění

Pro ověření prototypu spusť lokální server:

```bash
python -m http.server 4173
```

Pak otevři `http://localhost:4173/runner.html`. Produkční PWA se nasadí na GitHub Pages; v telefonu se otevře běžným odkazem a lze ji přidat na plochu.

## Projektová dokumentace

- [Plán MVP a pilotu](docs/PLAN.md)
- [Popis aktuálního běžeckého jádra](docs/CORE_APP.md)
- [Návrh backendu](docs/BACKEND.md)
- [Pravidla pro agenty a vývoj](AGENTS.md)
