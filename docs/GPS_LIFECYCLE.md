# GPS při uspání a obnovení RunGuide

Stav implementace a primárních podkladů: 19. 9. 2026. Operační systém uživatelova telefonu není známý. PWA ochrany jsou hotové v této změně; nativní záznam níže je další práce, není součástí buildu.

## Příčina a oprava PWA

Nahlášený běh měl 4,84 km oproti přibližně 5,7 km podle Stravy. Nemáme jeho GPS vzorky ani telefon, takže nelze připsat celý rozdíl konkrétnímu zařízení nebo dopočítat chybějící trasu. Reprodukce v testech potvrdila, že dosavadní běžecký čas pokračoval bez GPS, ale průměr používal neúplnou vzdálenost. Mezera se evidovala až po příštím použitelném bodu; ukončení bez další GPS ji nezaznamenalo. Obnova neměla informaci, zda uložený běh běžel, nebo byl ručně pozastavený. Návrat stránky obnovoval pouze wake lock, nikoli GPS watcher.

- `GpsTracker` v `src/services/gps-tracker.ts` vlastní jeden watcher, ochranu displeje a lifecycle. Staré callbacky ignoruje podle generace. Po návratu z `visibilitychange` nebo `pageshow` nahradí watcher; souběh obou událostí nevytváří dvě sledování.
- O wake lock žádá už při hledání první GPS. Zobrazuje úspěch, nepodporovaný prohlížeč, odmítnutí i uvolnění systémem. Po návratu jej žádá znovu; při selhání zkouší nejvýš jednou za 30 sekund. Pauza a ukončení jej uvolní. Pozdě dokončená žádost nemůže převzít ochranu nového běhu.
- Skrytí nebo `pagehide` ihned označí přerušení probíhajícího běhu, synchronně uloží checkpoint a ukončí webový watcher. I velmi krátké přepnutí je záměrně konzervativně označené. Web spolehlivě nerozliší zamknutí od přepnutí aplikace, proto nevymýšlí příčinu události `hidden`.
- Bez nového použitelného bodu déle než 15 sekund doména otevře jednu mezeru. Kontroluje ji timer, příjem GPS, checkpoint i ukončení běhu, takže funguje i po zablokování timerů nebo když GPS už neodpoví. Po 30 sekundách bez použitelné GPS se viditelná aplikace pokusí watcher znovu spustit. Zamítnutí oprávnění běh pozastaví; nepřesná/nedostupná GPS zůstává viditelná a čeká na návrat.
- Výpadek má samostatné viditelné upozornění a krátký český hlas při aktivní aplikaci, nejvýš jednou za minutu pro výpadek a jednou pro obnovení. Zvuk při skutečném uspání nelze slíbit. Aktuální tempo se po návratu znovu ustaluje z čerstvých vzorků.
- Přijatý bod se ihned ukládá do stávajícího prostoru vlastníka. Čas/jitter mají zálohu přibližně každých 5 sekund; ukládá se i začátek, pauza, pokračování a skrytí. Nelze garantovat poslední zápis při pádu OS, plném úložišti nebo vymazání dat webu. Chyba ukládání zůstává viditelná, export zálohy obsahuje i aktuální stav v paměti.

## Význam metrik

| Situace | Čas | Vzdálenost a tempo |
| --- | --- | --- |
| První hledání GPS | Ještě neběží | Začne až prvním použitelným bodem. |
| Ruční pauza a čekání po Pokračovat | Nezapočítávají se | Nový segment, bez propojování pohybu během pauzy. |
| Výpadek ve stále existujícím běhu | Dál běží | Jen naměřená vzdálenost; celý běh je neúplný a průměrné tempo je `—`. |
| Obnovení běžícího/neurčitého checkpointu po reloadu či ukončení procesu | Jen čas do posledního checkpointu, dále až po Pokračovat a získání GPS | Otevře se v pauze, trvale označí nejistotu a neznámou dobu mimo aplikaci. Nic automaticky nepřičte. |
| Obnovení ručně pozastaveného checkpointu | Pauza trvá | Samotné otevření nevytváří falešný výpadek. Starší checkpoint bez uložené fáze se považuje za nejistý. |

`quality.untrackedSeconds` je součet intervalů bez souvislého záznamu od posledního použitelného bodu do obnovení, pauzy či uložení po výpadku. Není to odhad pohybu. `quality.recoveryUncertain` označuje, že za posledním checkpointem existuje neznámá doba; tato doba se nevydává za nulu, ani se neodhaduje. Nová pole jsou volitelná pro zpětnou čitelnost v2 dat.

Průměr je potlačený také v historii, souhrnu období obsahujícím neúplný běh a v novém cloudovém zápisu (`average_pace_seconds_per_km = null`). Souhrnná vzdálenost nadále znamená součet zachycených kilometrů. Chybějící body nejsou vytvořené, segmenty mapy/GPX nejsou propojené. Dříve uložené neměnné cloudové snímky se nepřepisují; staré běhy bez zaznamenané informace o výpadku nelze zpětně automaticky opravit. Soukromí, RLS a uzavřené pozvánky se nemění.

## Co platformy umožňují

| Stav telefonu | PWA RunGuide | Potřebná další práce |
| --- | --- | --- |
| Automatické zhasnutí při otevřené aplikaci | Screen Wake Lock mu může zabránit; stav je vidět v UI. | Ověřit dostupnost a bateriové režimy na konkrétním telefonu. |
| Ruční zamknutí, přepnutí do pozadí | Aktualizace GPS nejsou garantované; aplikace může být pozastavená. Ochrana řeší označení a obnovení. | Pro průběžný záznam se zamčeným displejem nativní lokalizační služba Android/iOS. |
| Skutečné ukončení procesu | Žádné průběžné GPS ani hlas. Po otevření pouze obnova uloženého stavu. | I nativně je nutné rozlišit odebrání UI, systémové ukončení a vynucené zastavení; nelze slíbit nepřerušený záznam po libovolném ukončení. |

Geolocation specifikace doručuje watch aktualizace pouze plně aktivním viditelným dokumentům. Čas čekání na zviditelnění se nepočítá do GPS `timeout`; samotný callback chyby proto nestačí. API je vystavené na `Window`, nikoli jako GPS služba service workeru. [W3C Geolocation](https://www.w3.org/TR/geolocation/).

Screen Wake Lock chrání obrazovku aktivního dokumentu, při skrytí se uvolňuje a systém může žádost odmítnout například kvůli baterii. Nejde o záruku běhu procesu. [Chrome: Screen Wake Lock](https://developer.chrome.com/docs/capabilities/web-apis/wake-lock).

## Konkrétní cesta k nativnímu RunGuide — zatím neimplementováno

1. Zachovat Vite UI, `Fix`, segmenty a doménové regresní testy; přidat samostatné Android/iOS projekty přes Capacitor s `webDir: "dist"` a vstupem do běžecké aplikace. Aktuální dvojici HTML vstupů je potřeba přizpůsobit nativnímu startu. Samotné zabalení webu ani výměna za standardní `@capacitor/geolocation` nestačí: plugin přímý background tracking nepodporuje. [Capacitor Geolocation](https://capacitorjs.com/docs/apis/geolocation).
2. Definovat port `start(runId, ownerId)`, `pause`, `resume`, `stop`, `readAfter(sequence)` a stav služby. Nativní část musí sama přijímat a transakčně ukládat každý vzorek a událost pauzy do místní SQLite/fronty; JavaScript listener nesmí být jediným vlastníkem záznamu. Zapisovat `runId`, vlastníka, sekvenci, souřadnice, přesnost, čas pořízení a monotónní čas. UI po návratu čte potvrzenou sekvenci a neduplikuje body.
3. Android: spustit uživatelskou akcí v popředí foreground service typu `location` s trvalým oznámením a ovládáním pauzy/ukončení. Deklarovat `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` a oprávnění polohy; pro běh vyžadovat přesnou polohu. Použít `FusedLocationProviderClient.requestLocationUpdates` v této službě, ne ve WebView. Oprávnění se ověřují před startem; při zahajování služby z pozadí platí další omezení a požadavek `ACCESS_BACKGROUND_LOCATION`. [Android: location foreground service](https://developer.android.com/develop/background-work/services/fgs/service-types#location). Běžná background poloha bez této služby je omezena na několik aktualizací za hodinu. [Android: background location](https://developer.android.com/develop/sensors-and-location/location/background).
4. iOS: držet `CLLocationManager` v nativní službě, doplnit srozumitelné usage descriptions a Background Modes / Location updates (`UIBackgroundModes: location`), nastavit `allowsBackgroundLocationUpdates = true` a zahájit měření v popředí po uživatelské akci. Nastavení přesnosti, `activityType = .fitness`, filtru vzdálenosti a automatické pauzy naladit na terénních testech; automatickou pauzu vždy zaznamenat. Zpracovávat všechny body z `didUpdateLocations`, ne pouze poslední. [Apple: background updates](https://developer.apple.com/documentation/corelocation/cllocationmanager/allowsbackgroundlocationupdates).
5. Native replay oddělit od živého PWA vstupu: dnešní `Runner.ingest` právem odmítá staré body vůči `Date.now()`. Ověřená dávka z místního nativního záznamu potřebuje vlastní validaci časové posloupnosti, duplicit, přesnosti a mezer podle časů pořízení; nesmí se jen vypnout kontrola stáří živé GPS. Sdílet výpočet vzdálenosti a segmentů, zpracovat start/pauzu/stop v pořadí a obnovit čítače deterministicky. Ověřit na stejných zaznamenaných fixtures i nativním replay testem.
6. Zastavení uživatelem respektovat, nic tajně nerestartovat. Android Task Manager může ukončit celou aplikaci se službou bez závěrečného callbacku. [Android: user stopping](https://developer.android.com/develop/background-work/services/fgs/handle-user-stopping). iOS significant-change relaunch není náhradou sportovního záznamu: jde o hrubé změny polohy, nikoli úplnou běžeckou stopu. [Apple: Location Programming Guide, archiv](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/LocationAwarenessPG/CoreLocation/CoreLocation.html). Spolehlivost po systémovém ukončení řešit frontou a označením mezery, ne slibem nesmrtelného procesu.
7. Nativní frontu svázat s původním vlastníkem a při změně účtu ji nikdy nepřiřadit jinému uživateli. Upload přes stávající soukromé RLS, beze změny pozvánek a bez polohy v diagnostických logách. Přidat testy vymazání dat, přerušení zápisu, odhlášení, obnovení fronty, duplicit a bateriových režimů. iOS build a telefonní ověření vyžadují macOS/Xcode a podepsaný build.

## Krátký test na skutečném telefonu (~2 km)

Provést zvlášť na skutečném Androidu (Chrome/PWA) a iPhonu (Safari/PWA). Zapsat model, OS, prohlížeč, režim baterie, verzi buildu a zda jde o nainstalovanou PWA. Tato změna nic nenasazuje; test vyžaduje nejdříve uživatelem zpřístupněný HTTPS build této změny. Starý nasazený web opravu neobsahuje.

1. Venku spustit běh bez trasy, povolit přesnou polohu a počkat na první měření. Prvních přibližně 500 m nechat aplikaci viditelnou. Vyčkat déle než běžný interval automatického zhasnutí; zkontrolovat hlášku ochrany displeje a že stále přibývá GPS. Ověřit zamítnutí oprávnění a pokračování ještě před ostrým testem.
2. Bez pauzy ručně zamknout na 30–60 s a pokračovat v bezpečném úseku. Po odemknutí musí být běh označený jako neúplný, GPS se musí znovu chytit a nesmí přibýt přímka přes chybějící část. Čas pokračuje, průměr je `—`. Vyzkoušet též přepnutí do jiné aplikace a návrat. Hlas poslouchat ve sluchátkách; v pozadí není jeho přehrání podmínkou průchodu.
3. V popředí krátce ztratit použitelnou polohu (bezpečné místo se slabým signálem). Po více než 15 s zkontrolovat varování a potlačení tempa, po návratu čerstvé GPS nové ustálení aktuálního tempa. Vyzkoušet i Ukončit před návratem signálu: historie musí být neúplná.
4. V samostatném krátkém záznamu po alespoň 20 m aplikaci skutečně ukončit a znovu otevřít. Obnova musí nabídnout pauzu, uloženou trasu a nejistý záznam; čas mimo aplikaci se nesmí automaticky přičíst. Pokračovat, doběhnout zbytek a uložit. Samostatně ověřit totéž z ruční pauzy: samotný restart tehdy nepřidává výpadek.
5. V historii ověřit mezery, chybějící průměr, vysvětlení času a export GPX s oddělenými segmenty. Porovnávat pouze zachycené úseky s referenční aplikací, neočekávat dorovnání na Stravu. Ověřit přerušení hovorem a úsporný režim. Soukromou zálohu neposílat do veřejného issue.

## Automatické ověření

Regresní testy reprodukují a ověřují koncový výpadek bez další GPS, aktivní versus pozastavenou obnovu, staré checkpointy, opakované lifecycle události, staré callbacky, timeout watcheru, wake lock včetně závodů, čerstvost bodů po návratu, čas/vzdálenost/tempo, soukromé ukládání, cloudový null průměr a segmenty GPX. Integrační test používá skutečné UI handlery a repository s mockovaným GPS v jsdom. To ověřuje programové chování, nikoli GPS hardware, background chování OS, fyzický displej, baterii, reproduktor/sluchátka ani živý cloud.

Provedeno v přiděleném worktree 19. 9. 2026: `npm run typecheck` PASS, `npm run lint` PASS, `npm test` PASS (79 testů v 16 souborech), `npm run build` PASS včetně ověření obou HTML vstupů, assetů, manifestu, ikon a service workeru. `git diff --check` PASS. Skutečný telefon ani živý cloud nebyly testované. Nic nebylo publikováno ani nasazeno.
