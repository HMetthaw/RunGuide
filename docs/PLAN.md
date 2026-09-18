# RunGuide — plán MVP a pilotu

## Produktová hypotéza

Běžec chce před vyběhnutím rychle vytvořit vlastní trasu, zvolit si cíl a během běhu nemuset kontrolovat displej. RunGuide má spojit navigaci po trase a průběžné vedení cílovým tempem hlasem do sluchátek.

## Fáze 1 — osobní PWA a technický základ

1. Založit TypeScript/Vite PWA a nasazení na GitHub Pages. Komponentový framework případně doplnit podle růstu UI.
2. Přidat mapu, GPS oprávnění a bezpečné zobrazení aktuální polohy.
3. Přidat výpočet cílového tempa z vzdálenosti a času.
4. Připravit doménové moduly pro trasu, běh, tempo a hlasová doporučení.
5. Přidat jeden soukromý účet a cloudové ukládání dat přes Supabase.

## Fáze 2 — MVP běhu

1. Vytvořit trasu klepáním do mapy a zobrazit její délku.
2. Uložit plán běhu a spustit aktivní běžeckou obrazovku.
3. Sledovat polohu, vzdálenost, aktuální i průměrné tempo.
4. Hlásit odbočení, pokračování po trase a změny tempa.
5. Po doběhu zobrazit souhrn a umožnit odeslat zpětnou vazbu.

## Fáze 3 — uzavřený pilot

1. Přidat přihlášení a seznam pozvaných účtů, nejvýše 10 účastníků.
2. Vytvořit krátký dotazník po běhu: užitečnost navigace, přesnost tempa, srozumitelnost hlasu a ochota aplikaci používat.
3. Zaznamenat anonymní technická data: ztráty GPS, pády, odchylky trasy a četnost hlasových pokynů.
4. Vyhodnotit pilot před rozhodnutím o veřejném vydání.

## Fáze 4 — Territory & Clans (za 4 až 6 měsíců)

Tato fáze se začne až po úspěšném ověření běžeckého jádra a pilotu. Datový základ je připraven už nyní, ale herní obrazovky ani soutěže nebudou součástí první verze.

1. Převést uzavřený běh s dostatečnou vzdáleností, plochou a přesností GPS na polygon.
2. Pokrýt polygon agregovanými šestiúhelníkovými buňkami a atomicky převzít pouze platné buňky.
3. Zobrazit veřejně jen buňky, jejich vlastníka a agregované skóre; nikdy cizí syrovou trasu nebo startovní bod.
4. Přidat klany, členství, klanové skóre a přátelské soutěže.
5. Ověřit férovost, dopad na baterii, soukromí a odolnost proti falešné GPS před veřejným vydáním.

## Kritéria pro rozhodnutí o vydání

- Nejméně 7 z 10 pilotních běžců dokončí alespoň 3 běhy.
- Většina pilotních běžců označí vedení tempem za užitečné.
- Nebude blokující problém s GPS nebo hlasem na hlavních telefonech pilotu.
- Budeme mít jasné oprávnění a zásady soukromí pro polohová data.

## Rizika

| Riziko | Přístup |
| --- | --- |
| GPS kolísá a zkresluje tempo | Vyhlazovat tempo, pracovat s přesností a potlačovat chybné pokyny. |
| Mobilní OS omezuje GPS na pozadí | Testovat na reálných iOS i Android zařízeních od začátku. |
| Hlas obtěžuje uživatele | Zavést minimální intervaly, prahy a nastavení intenzity pokynů. |
| Kapacita veřejného pěšího routeru | Malý pilot používá OSRM / FOSSGIS bez klíče; pro větší provoz vlastní nebo smluvní služba. |
| Území odhaluje bydliště | Zobrazovat jen buňky s minimální velikostí; cizí trasy a starty nikdy nezveřejňovat. |
| Současné převzetí stejné buňky | Převzetí provádět v jedné serverové transakci a ukládat audit událostí. |

## Mimo první verzi

- Veřejně předpřipravené trasy.
- Herní území, žebříčky a sociální funkce před dokončením fáze čtyři.
- Platby, předplatné a publikace do obchodů.

## Průběžný stav — 16. 9. 2026

Osobní jádro je lokálně implementované a automaticky ověřené podle `docs/AUDIT.md`. Nejde zatím o veřejně nasazenou ani terénně otestovanou aplikaci. Připravené SQL migrace a cloudový klient čekají na propojení skutečné služby.

Nejbližší brány: dokončit živé napojení wishlistu, zpřístupnit soukromý HTTPS test, otestovat telefon a sluchátka, následně propojit cloud. Vlastní test bude trvat podle zkušenosti přibližně měsíc až dva; až potom uzavřený nábor známých a zájemců z Instagramu. Herní test a veřejná propagace zůstávají podmíněné výsledky, ne kalendářním příslibem.
