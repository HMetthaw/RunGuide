# Běžecké jádro — osobní testovací verze

## Dostupné funkce

- Cílová vzdálenost a čas, validace vstupu, tempo v sekundách/km.
- Vlastní bodová trasa v mapě, krok zpět, uzavření okruhu a více pojmenovaných plánů.
- Převzetí délky plánu jako vzdálenostního cíle.
- GPS měření se zahájením času až po použitelné poloze. Přesnost do 35 m; přeskočení starých, duplicitních a nepravděpodobných vzorků.
- Aktuální tempo z posledních až 45 s, oddělený průměr, odchylka a zbývající čas/vzdálenost.
- Pauza/obnovení: pauza a čekání na znovuzískání GPS se do aktivního času nepočítají. Běžné stání bez tlačítka pauzy se počítá.
- Při výpadku přes 15 s vznikne oddělený segment. Chybějící vzdálenost se nedopočítává přímkou.
- Český hlas s testovacím tlačítkem, vypnutím, prioritou navigace a nejméně 60 s mezi radami k tempu.
- Automatický průběžný záznam přibližně každých 5 s; po obnovení stránky se běh nabízí v pauze. Při pádu může chybět posledních několik sekund.
- Historie skutečných GPS stop: datum, čas, vzdálenost, tempo, původní cíl, malá mapa, poznámka, GPX export a smazání.
- Export celé soukromé zálohy do JSON. Starší data prototypu zůstávají zachována, nemění se na vymyšlenou GPS historii.
- Offline aplikace včetně vlastní kopie Leafletu a písem, instalovatelný manifest, PNG ikony, nabídka aktualizace až mimo aktivní běh.
- Připravený klient Supabase pro pozvaný účet a ruční synchronizaci historie. Bez konfigurace je cloud viditelně neaktivní.

## Omezení, která nejsou vyřešená desktopovým testem

1. Body trasy tvoří přímé úsečky. Neprobíhá silniční/pěší routing ani ověření průchodnosti. Hlasové odbočení je geometrie bodů, ne ověřená křižovatka.
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
