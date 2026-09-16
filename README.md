# RunGuide

Mobilní aplikace pro běžce: naplánuješ vlastní trasu, zadáš vzdálenost a cílový čas, a během běhu dostáváš GPS navigaci i hlasové vedení tempa do sluchátek.

## Cíl první verze

- Nakreslit vlastní trasu na mapě před během.
- Nastavit vzdálenost a cílový čas; aplikace spočítá cílové tempo v min/km.
- Při běhu sledovat GPS polohu, vzdálenost a aktuální tempo.
- Hlasem oznámit nadcházející odbočení a doporučit zrychlení nebo zpomalení.
- Umožnit uzavřený pilot až pro 10 pozvaných běžců a sběr zpětné vazby.

## Stav

Projekt je ve fázi plánování a scaffoldingu. Detailní postup je v [docs/PLAN.md](docs/PLAN.md).

## Zamýšlený stack

- Expo + React Native + TypeScript
- Expo Router pro obrazovky
- Expo Location pro GPS a Expo Speech pro hlasové pokyny
- React Native Maps pro mapu a tvorbu tras
- Supabase pro pilotní účty, data a zpětnou vazbu

## Lokální spuštění

Po dokončení scaffoldingu bude stačit:

```bash
npm install
npx expo start
```

Poté se QR kód otevře aplikací Expo Go na telefonu.

## Projektová dokumentace

- [Plán MVP a pilotu](docs/PLAN.md)
- [Pravidla pro agenty a vývoj](AGENTS.md)
