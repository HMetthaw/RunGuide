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

## Fáze 4 — Territory & Clans a žebříčky (za 4 až 6 měsíců)

Tato fáze se začne až po úspěšném ověření běžeckého jádra a pilotu. Datový základ je připraven už nyní, ale herní obrazovky ani soutěže nebudou součástí první verze.

1. Převést uzavřený běh s dostatečnou vzdáleností, plochou a přesností GPS na polygon.
2. Pokrýt polygon agregovanými šestiúhelníkovými buňkami a atomicky převzít pouze platné buňky.
3. Zobrazit veřejně jen buňky, jejich vlastníka a agregované skóre; nikdy cizí syrovou trasu nebo startovní bod.
4. Přidat klany, členství, klanové skóre a přátelské soutěže.
5. Přidat žebříčky s přepínáním území a disciplíny podle zadání níže.
6. Počítat výsledky na serveru do všech příslušných žebříčků nezávisle na tom, který si uživatel právě prohlíží.
7. Ověřit férovost, dopad na baterii, soukromí a odolnost proti falešné GPS před veřejným vydáním.

### Výběr území a zobrazení

- Uživatel si přepne žebříček na konkrétní obec (město nebo vesnici) nebo celou zemi. Kraje a okresy mohou rozšířit stejný princip později; město a vesnice jsou alternativní typy obce, nikoli dvě povinné úrovně nad sebou.
- Výběr území mění pouze zobrazení. Běžec může sledovat jen soutěž ve své obci, ale jeho způsobilé výsledky se současně započítávají i do příslušného celostátního žebříčku a všech dalších zavedených nadřazených území.
- Přepnutí žebříčku nesmí měnit příslušnost výsledků, resetovat skóre ani vyžadovat samostatné přihlašování do každého území. Neznamená to započítávání do nesouvisejících obcí nebo zemí.
- Obrazovka má samostatné volby území, disciplíny a období. Zapamatuje poslední výběr a ukáže vlastní umístění, hodnotu výsledku a prázdný stav, pokud v daném žebříčku ještě nikdo není.
- Pro území používat stabilní identifikátory a vztah k nadřazenému území; stejnojmenné obce rozlišit podle země a regionu.

### Disciplíny

| Žebříček | Výsledek a pořadí |
| --- | --- |
| Území | Skóre z platných ověřených buněk podle pravidel teritorií, vyšší skóre je lepší. Individuální a klanový žebříček vést samostatně. |
| Nejdelší běh | Nejdelší jednotlivý dokončený a serverem ověřený běh v kilometrech, vyšší vzdálenost je lepší. Nejde o součet více běhů. |
| Nejrychlejší výkon na X km | Samostatné kategorie pro pevné vzdálenosti; návrh pro první vydání: 1 km, 5 km a 10 km. Řadit podle nejkratšího času na dané vzdálenosti, zobrazovat také průměrné tempo jako `m:ss / km`. |

U rekordových disciplín zobrazit jeden nejlepší způsobilý výsledek každého běžce v daném území a období. Jedním během lze získat rekord v několika vzdálenostních kategoriích současně. Pro rychlost použít nejlepší souvislý úsek přesné délky X km v ověřeném záznamu, nikoli okamžité GPS tempo ani průměr celého delšího běhu. Čas úseku zahrnuje i případné pauzy; úseky s neověřitelným průběhem nebo výpadkem GPS do rekordů nezařazovat.

Další možné disciplíny po ověření prvních žebříčků: celkový počet kilometrů za období a rekordy na půlmaraton či maraton. Kategorie navrhnout rozšiřitelně, aby přidání disciplíny nevyžadovalo změnu principu územních filtrů.

### Výpočet, férovost a soukromí

- Území se nadále získává pouze platným uzavřeným během. Výkonnostní rekordy mohou pocházet i z otevřené trasy, pokud jde o platný dokončený a ověřený běh.
- Klient posílá soukromý záznam; ověření výkonu, přiřazení území, výpočet rekordů a změny skóre provádí pouze server. Klientské souhrny ani ručně zadané výsledky nejsou důkaz výkonu.
- Opakovaná synchronizace stejného běhu nesmí přidat body znovu. Nadřazený žebříček nesmí tentýž výkon započítat vícekrát kvůli překryvu území nebo více dílčím výsledkům.
- Stanovit jednotná pravidla přesnosti GPS, podezřelých skoků, pauz, časové interpolace hranic úseku, shodných výsledků a zaokrouhlení. Pořadí určovat z přesných hodnot, nikoli ze zaokrouhleného zobrazení.
- Veřejný záznam obsahuje jen soutěžní přezdívku, pořadí, disciplínu, území, období a souhrnný výsledek. Přesnou trasu, rekordní úsek, start, konec ani soukromé údaje profilu nezveřejňovat; mapa území dál vystavuje pouze agregované buňky.
- Vyřazení neplatného nebo smazaného běhu musí promítnout změnu do všech dotčených žebříčků, případně dosadit další nejlepší způsobilý rekord. Totéž řešit při smazání účtu podle pravidel uchování soutěžních agregací.

### Rozhodnutí před implementací

- Upřesnit, zda místní výkonnostní žebříček porovnává výkony uskutečněné na daném území, nebo běžce z jejich zvolené soutěžní obce. Pro teritoriální skóre navrhovat příslušnost podle polohy buněk. Výběr prohlíženého žebříčku nikdy nepoužívat jako určení soutěžní příslušnosti.
- Podle této volby určit pravidla pro běhy přes hranice obcí či zemí, buňky na hranicích a změny soutěžní obce; nezjišťovat ani nezveřejňovat domovskou adresu z GPS.
- Potvrdit období: návrh týden, měsíc a celkově; upřesnit časová pásma, hranice období a zda se u teritorií porovnává aktuálně držená plocha, nebo body získané v sezoně.
- Potvrdit veřejnou soutěžní identitu a možnost nezveřejňovat vlastní výsledky. Automatické započítání do příslušných žebříčků musí respektovat nastavenou účast v soutěžích.

### Ověření fáze 4

- Otestovat současné zařazení výsledku do obecního a celostátního žebříčku a to, že přepínání zobrazení nemění skóre.
- Otestovat nejdelší jednotlivý běh, rekord na přesné vzdálenosti uvnitř delšího běhu, pauzy, chyby GPS, shodné výsledky, opakovanou synchronizaci a přepočet po vyřazení či smazání výsledku.
- Otestovat hranice území a období, stejnojmenné obce a oddělení individuálních a klanových výsledků.
- Ověřit, že veřejné odpovědi neobsahují cizí trasu ani údaje soukromého profilu a klient nemůže zapisovat soutěžní výsledky přímo.
- Před zpřístupněním spustit TypeScript kontrolu, linter a relevantní testy; na telefonu ověřit přepínání žebříčků a srozumitelnost vlastního umístění.

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
