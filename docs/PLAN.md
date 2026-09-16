# RunGuide — plán MVP a pilotu

## Produktová hypotéza

Běžec chce před vyběhnutím rychle vytvořit vlastní trasu, zvolit si cíl a během běhu nemuset kontrolovat displej. RunGuide má spojit navigaci po trase a průběžné vedení cílovým tempem hlasem do sluchátek.

## Fáze 1 — technický základ

1. Založit Expo/TypeScript aplikaci a základní navigaci.
2. Přidat mapu, GPS oprávnění a bezpečné zobrazení aktuální polohy.
3. Přidat výpočet cílového tempa z vzdálenosti a času.
4. Připravit doménové moduly pro trasu, běh, tempo a hlasová doporučení.

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
| Mapa/routing vyžaduje placené API | Pro MVP kreslit ruční trasu; routing řešit až podle potřeb pilotu. |

## Mimo první verzi

- Veřejně předpřipravené trasy.
- Sdílení tras, žebříčky a sociální funkce.
- Platby, předplatné a publikace do obchodů.
