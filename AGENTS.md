# AGENTS.md

## Produkt

RunGuide je instalovatelný PWA běžecký navigátor. Prioritou je bezpečný a jednoduchý zážitek v pohybu: velké ovládací prvky, minimum nutnosti dívat se na displej a krátké, srozumitelné hlasové pokyny v češtině.

## Vývojová pravidla

- Používej TypeScript bez `any`; doménové modely patří do `src/types/`.
- Funkce pro GPS, výpočet tempa a navigační instrukce drž odděleně od UI v `src/services/` a `src/domain/`.
- Každá obrazovka musí mít stavy pro chybějící oprávnění, načítání a chybu GPS.
- PWA musí fungovat přes HTTPS, obsahovat manifest a mít použitelný offline shell; živá mapa a GPS mohou vyžadovat připojení a aktivní otevřenou aplikaci.
- Hlasové pokyny nesmí opakovat stejnou radu příliš často; respektuj interval a prahovou odchylku tempa.
- Nikdy neukládej tajné klíče do repozitáře. Používej `.env` a přilož `.env.example`.
- Záznamy běhů a přesné trasy mají být čitelné pouze majitelem účtu. Budoucí mapa území smí vystavovat jen agregované buňky, nikdy přesnou trasu nebo domovský bod jiného uživatele.
- Před dokončením změny spusť TypeScript kontrolu, linter a relevantní testy.

## Doménová pravidla MVP

- Tempo ukládej v sekundách na kilometr, zobrazuj jako `m:ss / km`.
- Upozornění na tempo dáváme až po ustálení GPS a z vyhlazeného tempa, ne z jedné polohové aktualizace.
- Cílová trasa je sada bodů; navigace vybírá nejbližší nadcházející bod a odbočku hlásí pouze při rozumné přesnosti polohy.
- Pilotní účty jsou uzavřené pozvánkou; žádný veřejný onboarding v první verzi.
- Území se bude počítat až ve fázi čtyři z platných uzavřených běhů; žádné převzetí buněk nesmí jít přímo z klienta.

## Ověřování

- Jednotkové testy: tempo, odchylka od tempa, zbývající čas a rozhodování o hlasové radě.
- Reálný telefon: oprávnění k poloze, ztráta signálu, zamknutý displej, sluchátka a přerušení aplikace.
