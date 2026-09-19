# Přesnost měření · 19. 9. 2026

## Potvrzené chyby a oprava

Regresní testy volají přímo `Runner.ingest`, stejně jako živé GPS callbacky. Před opravou selhaly tyto scénáře:

- Při stání s polohami střídajícími se o ±2 m, přesností 5 m a hlášenou rychlostí 0 m/s přibylo za 120 s téměř 480 m. Filtr nyní využívá nulovou/téměř nulovou rychlost jako potvrzení šumu uvnitř součtu nepřesností obou poloh. Neznámá rychlost běh neblokuje; pohyb mimo tuto mez se počítá i se zaseknutým údajem rychlosti.
- Po osmi sekundách stání prošel skok o 50 m během jedné sekundy. Rychlost se kontrolovala pouze proti staré kotvě měření vzdálenosti. Nová kontrola používá i poslední použitelnou polohu a zohledňuje nepřesnost obou aktualizací.
- Pravidelné GPS aktualizace po 8 s při stání vytvořily 30 falešných výpadků za 8 minut. Čas výpadku se nyní odvozuje od poslední použitelné aktualizace, nikoli od kotvy vzdálenosti.
- Převzetí plánu 588 m vytvořilo cíl 600 m. Přenos a formulář nyní zachovají 588 m (0,588 km); změna je ověřená i po uložení a znovunačtení plánu.

Nepřiměřená rychlost se odmítá i při prvním získání polohy nebo po výpadku a sama nevytváří další segmenty. Uložená starší historie se nepřepočítává.

## Rozsah automatického ověření

`tests/gps-accuracy.test.ts` pokrývá uvedené chyby, zaseknutou nulovou rychlost při skutečném pohybu, ideální trasy 5,28 km a 42,195 km s dostupnou i nedostupnou rychlostí, zatáčky a návrat stejnou cestou, pauzu a skutečný výpadek. Stávající testy dále ověřují vyhlazené tempo, hlášení, nepřesné a staré vzorky, obnovu, ukládání a rozhraní.

Ideální trasy jsou syntetické a ověřují stabilitu výpočtu proti stejné geometrii, nikoli absolutní geodetickou přesnost ani procentuální přesnost skutečného telefonu. Oprava nepotvrzuje příčinu uživatelem hlášené odchylky od Google Map; původní GPS záznam ani shodná geometrie obou plánů nebyly k dispozici.

Lokálně prošlo `npm run check`: TypeScript, ESLint, všech 70 testů a produkční build včetně kontroly PWA assetů. Terénní test ani nasazení nebyly součástí tohoto ověření.

## Následující terénní ověření

1. Rozlišit porovnání naklikaných plánů od porovnání skutečného GPS běhu. Plánovač přebírá délku pěší cesty z OSRM; tato délka nevzniká z GPS filtru.
2. Porovnat stejný start, cíl i průběh celé trasy a zaznamenat vzdálenosti v metrech. Pokud byl rozdíl 27 m na 5,28 km, jde přibližně o 0,51 %; při stejné poměrné chybě by na 42,195 km vyšlo přibližně 216 m.
3. Na známé trase vyzkoušet volné prostranství, zatáčky, zastavení, slabý signál, pauzu a zhasnutí/zamknutí displeje. Zkontrolovat GPS stopu, vzdálenost a počet výpadků. Jediné porovnání neprokazuje systematickou chybu.

Podle [specifikace W3C Geolocation](https://www.w3.org/TR/geolocation/) je `enableHighAccuracy` požadavek na co nejpřesnější polohu, který může zařízení ignorovat. `accuracy` popisuje nejistotu jednotlivé polohy při 95% hladině spolehlivosti; nejde o zaručenou chybu celé délky trasy. Aplikace již používá `enableHighAccuracy: true` a `maximumAge: 0`.
