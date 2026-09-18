# Audit a ověření RunGuide — 16. 9. 2026

## Nalezené a opravené problémy

| Nález                                                            | Oprava a důkaz                                                                                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Historie ukládala plán místo uběhnuté trasy.                     | Oddělené `trace` a `plannedRoute`, test záznamu i mapky.                                                                   |
| Každý pohyb GPS zvyšoval vzdálenost, včetně skoků a šumu.        | Filtr přesnosti, času, rychlosti a stání; doménové scénáře.                                                                |
| Aktuální tempo bylo průměrné od startu.                          | Klouzavé okno a oddělený průměr. První test odhalil kvantizační odchylku 7–11 s/km; opraveno zarovnáním pohybových vzorků. |
| Hodnota 359,9 s/km se zobrazovala jako 5:60.                     | Zaokrouhlení před rozdělením minut a sekund.                                                                               |
| Čas běžel ještě bez získané GPS; chyběla pauza.                  | Stavový automat acquiring/running/paused/finished a testy času.                                                            |
| Mezera GPS nebo pohyb během pauzy se spojily přímkou.            | Oddělené segmenty v historii, mapce i GPX.                                                                                 |
| Rozběhnutý běh se po zavření ztratil.                            | Průběžný checkpoint, obnova v pauze a zachování navigačního postupu.                                                       |
| Po 50 bězích se historie tiše zahazovala.                        | Bez automatického odstraňování, explicitní chyba při vyčerpání úložiště.                                                   |
| Ukládání neřešilo poškozená data nebo plné úložiště.             | Runtime validace, zachování originálu, export a opakování neúspěšného uložení.                                             |
| Druhá karta mohla přepsat novější data.                          | Kontrola poslední načtené verze před zápisem.                                                                              |
| Úprava poznámky mohla odstranit jiný rozběhnutý běh.             | Checkpoint se odstraňuje jen při dokončení stejného ID.                                                                    |
| Přesné údaje se vykreslovaly do HTML bez oddělení dat.           | DOM/textContent, žádný HTML řetězec z uživatelských vstupů.                                                                |
| PWA měla kořenové cesty a závisela na externím Leafletu.         | Vite build, lokální balíčky, relativní base, generovaný precache a ikony.                                                  |
| CSS `display:grid` ignorovalo `hidden`.                          | Explicitní `[hidden]` pravidlo.                                                                                            |
| Herní tabulky vystavovaly identifikátory veřejně.                | Odstraněná veřejná pravidla, odebrané granty v nové migraci.                                                               |
| Běh šlo svázat s cizí uloženou trasou.                           | Serverový trigger ověřuje stejného majitele.                                                                               |
| Chybělo vynucení uzavřeného pilotu.                              | Admin-only `beta_access`, ověřování na databázové úrovni.                                                                  |
| Přepnutí účtu v jiné kartě mohlo změnit vlastníka dalšího syncu. | Klient odmítne každý sync/deletion s odlišnou identitou a nepřeváže místní historii.                                       |
| Starý telefon mohl znovu nahrát dříve smazaný běh.               | Atomické smazání s privátním ID markerem, odmítnutí reinsertu a test PostgreSQL.                                           |

## Provedené ověření

- TypeScript strict, ESLint a produkční build.
- 51 automatických testů včetně pěšího routingu, rušení starých výpočtů, chyb služby, opětovného načtení plánů a rozšíření mapy se zachováním DOM a návratem fokusu (ověřeno 18. 9. 2026).
- Databázové testy běží v PostgreSQL přes PGlite s rolí `authenticated`, dvěma schválenými uživateli a třetím bez pozvánky. Kontrolují vlastní zápis, cizí čtení/změnu/smazání, podvržení vlastníka, cizí trasu, anonymní přístup, sebe-pozvání a odebrání přístupu. Supabase `auth.uid()` je v testu nahrazeno čtením testovacího JWT claimu; nejde o živý test vzdálené služby.
- Integrační DOM test: neplatný cíl → zamítnutá GPS → start → simulovaný běh → pauza → pokračování → chyba kvóty → opakované uložení → skutečné dva segmenty v mapce → poznámka obsahující HTML → smazání. GPS a mapa jsou zde testovací adaptéry.
- Skutečný prohlížeč: změna cíle, body v Leafletu, uložení a načtení plánu, mobilní rozložení 390 px bez vodorovného přetečení, konzole bez chyb.
- Offline shell ověřen opětovným načtením stránky po vypnutí lokálního serveru. Mapová služba měla nadále síť; tento test negarantuje offline podklad.
- Celkový build zahrnuje i ověření existence všech assetů obou stránek. Opravený landing vstup je modul pro Vite; původní `/app.js` a `/public-config.js` se do balíčku nedostávaly. Ověřeno také sestavení s base `/RunGuide/` pro GitHub Pages.
- `npm audit --omit=dev --audit-level=moderate`: žádné nahlášené zranitelnosti produkčních závislostí v době kontroly. Nejde o bezpečnostní audit celé aplikace.
- Aktualizace ze starého cache-first prototypu proběhla po zavření a znovuotevření karty. Data a původní plán zůstaly.
- 18. 9. 2026 nasazeno na Cloudflare Worker `runguide-landing`, verze `e043b427-0127-4f1d-bb48-4c02055af146`. HTTPS `/`, `/runner` i přesměrování `/runner.html` vrací 200; skripty, styly, manifest, service worker a ikony odpovídají aktuálnímu buildu. V prohlížeči ověřena nabídka aktualizace původní PWA a přechod tlačítkem na nový pěší plánovač, bez chyb v konzoli.

## Zbývá před reálnou betou

- Terénní GPS a zvuk na iPhone/Android, výpadky a zamknutí displeje; automatické testy je nenahrazují.
- Založit/propojit Supabase, aplikovat migrace, ověřit dvě skutečné identity a obnovu session, smazání účtu a export/smazání v cloudu.
- Živý endpoint wishlistu a zápis/read-back; tuto část řeší samostatný chat a jeho `docs/LANDING_AUDIT.md`.
- Pěší routing je doplněný přes OSRM / FOSSGIS (viz README); terénní ověření navigace a plná cloudová synchronizace plánů/editací zbývají.
- GitHub remote a ověření instalace z telefonu; veřejné HTTPS nasazení na Cloudflare je hotové.

## Technické podklady

- [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API/Using_the_Geolocation_API)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Nasazení Vite na GitHub Pages](https://vite.dev/guide/static-deploy)

## Mobilní redesign · 18. 9. 2026

- Nový plánovač s rozšířitelnou mapou, kompaktním nastavením cíle, spodní navigací a výraznými metrikami. Při aktivním běhu zůstává ovládání pauzy a ukončení u spodního okraje.
- Ověřeny šířky 320, 390 a 1440 px; mobil bez vodorovného přetečení, nativní mapový dialog a návrat klávesnicového fokusu. Živý pěší routing v prohlížeči vrátil trasu 0,75 km.
- TypeScript, ESLint, 51 testů a produkční build prošly. Nasazena Cloudflare verze 70f5173a-2e25-4e54-a9c3-ed00493391cb. Na veřejné adrese ověřen přechod z předchozí PWA přes tlačítko Aktualizovat aplikaci na nový vzhled.


## Tmavý režim · 18. 9. 2026

- Přepínač v hlavičce ukládá volbu do runguide.theme. Bez vlastní volby se aplikace řídí systémem; vzhled se nastavuje před prvním vykreslením. Nedostupné úložiště neblokuje aplikaci.
- Tmavá paleta pokrývá mapový podklad, formuláře, statistiky, historii, dialogy a ovládání. Mapa používá stávající OpenStreetMap podklad s filtrem pouze na dlaždicích.
- Prošly TypeScript, ESLint, 54 testů a produkční build. V prohlížeči ověřeno přepínání, zachování volby po obnovení a šířky 320, 390 a 1440 px. Nasazena Cloudflare verze 10b84168-a49a-4cf1-9bc3-efac32a4b6d4.

