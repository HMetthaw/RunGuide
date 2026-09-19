# Hlasová navigace při běhu

Navigace používá uloženou geometrii naplánované trasy, funguje tedy i bez nového požadavku na routing. Neodesílá GPS stopu žádné další službě. Pokyny vycházejí ze směru trasy, nikoli z názvů ulic nebo databáze křižovatek.

## Rozhodování

- Polohu přiřazuje k úsekům a postupuje dopředu. Nemusí se přesně trefit do každého bodu. Na křížení či překryvu upřednostní první odpovídající úsek; výpadek signálu rozšíří hledání podle uplynulého času.
- Malé odchylky geometrie do 5 m zjednoduší. Zaoblenou zatáčku neskládá z opakovaných stejných pokynů; dvě blízké pravoúhlé odbočky zůstanou samostatné.
- Odbočení hlásí při vzdálenosti do 65 m po trase. Do 15 m může jednou dodat „Odbočte doprava“ / „Odbočte doleva“, pokud od předchozího upozornění uběhlo alespoň 8 sekund. Mezi různými pokyny dodržuje nejméně 4 sekundy. U vratné trasy používá „Otočte se zpět“.
- Používá jen platné, nové polohy staré nejvýše 10 sekund s přesností do 25 m. Odmítnutá poloha, pauza a chyba GPS přeruší potvrzování odchylky či návratu.
- „Opustili jste trasu“ zazní po nejméně 4 sekundách potvrzené odchylky větší než 35 m **nad rámec udávané nepřesnosti GPS**. Při trvající odchylce se opakuje nejdříve za 60 sekund. Mimo trasu nevydává odbočky.
- Návrat potvrzuje po nejméně 4 sekundách uvnitř užšího koridoru (15 m nebo udávaná přesnost GPS, nejvýše 25 m). Oznámí „Jste zpět na trase“ a případnou blízkou odbočku. Nové opuštění po potvrzeném návratu se posuzuje samostatně.
- Navigace přeruší mluvené tempo. Nové tempo je potlačené při přibližování k odbočce, nejistém přiřazení, odchylce a 20 sekund po navigačním pokynu. Zrušená stará promluva nepřepíše novější pokyn chybou přehrávání.

## Automatické ověření

`tests/navigation.test.ts` ověřuje pravou i levou odbočku, připomenutí bez zahlcení, vynechané body, pozdní první polohu, hustou geometrii, dlouhý výpadek, křížení, trasu tam a zpět, blízké odbočky, chybnou GPS, opuštění i potvrzený návrat.

`tests/navigation-app.test.ts` načítá uložený plán do skutečné aplikace a posílá simulované GPS události přes její callback. Ověřuje české promluvy v `speechSynthesis`, obě odbočky, přednost před tempem, odchylku, slabou GPS při návratu, potvrzený návrat a zastavení při pauze. Mapový renderer a samotný zvukový engine telefonu jsou nahrazené testovacími objekty.

`tests/voice.test.ts` ověřuje přednost navigace, přerušení tempa, potlačení opožděné chyby zrušené promluvy, ztlumení a textový výstup bez dostupného hlasového enginu. Existující testy výběru českého hlasu zůstávají zachované.

## Ještě ověřit skutečným telefonem

Následující kroky nejsou ověřené automatickými testy ani provedené tímto commitem:

1. Na telefonu s touto verzí zvol trasu přibližně 2 km s levou i pravou odbočkou. Před startem vyzkoušej český hlas, hlasitost a sluchátka.
2. S otevřenou aplikací ověř srozumitelnost a skutečné načasování upozornění před oběma odbočkami i připomenutí u nich. Tempo nesmí pokyn přerušit. Zůstaň chvíli stát u odbočky: pokyn se nesmí opakovat dokola.
3. Na bezpečném místě se vzdal od trasy dostatečně vzhledem k přesnosti GPS (při ±5 m více než 40 m). Ověř jedno upozornění, odstup případného opakování a potvrzení po návratu.
4. Ověř zamítnutí oprávnění, krátkou ztrátu signálu, pauzu a obnovení. Při slabém signálu nesmějí vznikat falešné odbočky nebo falešné potvrzení návratu.
5. Samostatně zaznamenej chování při zamknutí displeje, přepnutí aplikace, příchozím hovoru a odpojení sluchátek. Tato změna nezaručuje GPS ani zvuk na pozadí; to vyžaduje terénní ověření platformy a patří do navazujícího úkolu.
