# Běžecké jádro — osobní testovací verze

## Dostupné funkce

- Cílová vzdálenost a čas, validace vstupu, tempo v sekundách/km.
- Vlastní pěší trasa v mapě přes OSRM / FOSSGIS: propojení bodů po cestách, krok zpět, uzavření okruhu včetně cesty tam a zpět a více pojmenovaných plánů. Délka pochází z routeru, nikoli z úseček mezi kliknutími.
- Převzetí délky plánu jako vzdálenostního cíle s rozlišením na metry (0,001 km). Délka z routeru se pro cíl zaokrouhluje pouze na celý metr; údaj v mapě se zobrazuje na dvě desetinná místa.
- GPS měření se zahájením času až po použitelné poloze. Přesnost do 35 m; přeskočení starých, duplicitních a nepravděpodobných vzorků.
- Skok polohy se kontroluje také vůči poslední použitelné GPS aktualizaci, i při stání. Nulová nebo téměř nulová rychlost brání přičítání pohybu uvnitř součtu hlášených nepřesností; při nedostupné rychlosti nebo pohybu za tuto mez pokračuje měření z poloh.
- Aktuální tempo z posledních až 45 s, oddělený průměr, odchylka a zbývající čas/vzdálenost.
- Pauza/obnovení: pauza a čekání na znovuzískání GPS se do aktivního času nepočítají. Běžné stání bez tlačítka pauzy se počítá.
- Při výpadku použitelných GPS aktualizací přes 15 s vznikne oddělený segment. Samotné stání výpadek nezpůsobuje. Chybějící vzdálenost se nedopočítává přímkou.
- Český hlas s testovacím tlačítkem, vypnutím, prioritou navigace a nejméně 60 s mezi radami k tempu.
- Každý přijatý GPS bod se ukládá ihned, čas přibližně každých 5 s a při skrytí; po obnovení stránky se běh nabízí v pauze. Obnova běžícího checkpointu označí záznam jako nejistý. Poslední zápis při pádu není zaručený.
- Detekce výpadku i bez další GPS, obnova sledování po návratu a viditelný stav ochrany displeje. Neúplná vzdálenost se nevydává za celý běh: průměrné tempo je skryté i v historii a souhrnu. [Chování, nativní postup a telefonní test](GPS_LIFECYCLE.md).
- Historie skutečných GPS stop: datum, čas, vzdálenost, tempo, původní cíl, malá mapa, poznámka, GPX export a smazání.
- Export celé soukromé zálohy do JSON. Starší data prototypu zůstávají zachována, nemění se na vymyšlenou GPS historii.
- Offline aplikace včetně vlastní kopie Leafletu a písem, instalovatelný manifest, PNG ikony, nabídka aktualizace až mimo aktivní běh.
- Připravený klient Supabase pro pozvaný účet a ruční synchronizaci historie. Bez konfigurace je cloud viditelně neaktivní.

## Omezení, která nejsou vyřešená desktopovým testem

1. Nový pěší routing vyžaduje internet a dostupnost komunitního serveru FOSSGIS. Uložené vypočtené plány lze načíst offline. Data OSM nemusí zahrnovat aktuální uzavírky; hlasové odbočení se odvozuje z geometrie cesty, nikoli z názvů či ověřených křižovatek. Hlas přeskočí rovné úseky a mezi pokyny dodržuje 12 s.
2. Skutečné chování GPS, českého TTS, sluchátek, baterie a zamčeného telefonu musí projít terénním testem na iOS a Androidu. Wake lock drží jen viditelnou obrazovku, negarantuje GPS na pozadí.
3. Mapové dlaždice se nestahují hromadně do cache. Bez internetu může podklad chybět, ale uložená geometrie a samotný záznam fungují.
4. Místní data v prohlížeči nejsou šifrovaný trezor a nepřežijí vymazání dat webu. Přístroj s odemčeným profilem může historii číst. Pravidelně exportovat zálohu.
5. Cloud dosud není nasazený: chybí konkrétní projekt, jeho veřejná konfigurace, migrace a pozvaný uživatel. Neproběhl živý test synchronizace, přihlášení ani smazání.
6. Synchronizují se dokončené GPS souhrny jako neměnné snímky. Pozdější změna poznámky je zatím místní; uložené plány jsou místní. Plná synchronizace editací a plánů je samostatný zbývající bod.
7. Pro beta test stále chybí ověřené smazání celého cloudového účtu, retenční pravidla a správce/souhlasné informace před reálným sběrem dat dalších osob.

## Struktura

- `src/domain/`: výpočty, běžecký stavový automat, geometrie a navigace.
- `src/services/`: mapa, persistence, export, hlas, PWA a cloud.
- `src/types/`: validované vstupy a uložené modely.
- `src/main.ts`: propojení obrazovky s doménou.
- `tests/`: výpočty, GPS průběhy, ukládání, rozhraní, cloudové identity a skutečné PostgreSQL RLS scénáře v PGlite.
