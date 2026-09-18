# Návrh backendu

## Rozdělení odpovědností

GitHub Pages hostuje pouze PWA. Supabase obsluhuje přihlášení a databázi. Žádný tajný klíč se nevkládá do klienta; PWA používá výhradně veřejný anon klíč s Row Level Security.

## První verze

- `profiles`: soukromý profil přihlášeného člověka.
- `running_routes`: uložené, ručně vytvořené trasy.
- `runs`: souhrn a zjednodušený záznam dokončeného běhu.

Přesné trasy čte a upravuje jen jejich vlastník. Mapový náhled historie se vykresluje z uložené zjednodušené trasy, bez ukládání obrázků.

## Připraveno pro fázi Territory & Clans

- `territory_cells`: aktuální vlastník každé budoucí šestiúhelníkové buňky; aktuálně žádný přístup pro klienta.
- `territory_claims`: neměnný audit převzetí buněk.
- `squads` a `squad_members`: budoucí klany.

Klient nebude mít právo buňky přímo měnit. Pozdější serverová funkce ověří běh, zjednoduší polygon, dopočítá buňky a provede převzetí atomicky. První verze tyto tabulky nepoužívá.

## Soukromí

- Raw GPS trasa nikdy není veřejný zdroj dat.
- Veřejná herní mapa může později ukazovat jen buňky s rozumně hrubým rozlišením.
- Přesné starty, konce a historie zůstávají soukromé.
- Uživatel musí moci kdykoli smazat trasu i účet.

## Stav implementace po auditu

Klient v `src/services/cloud.ts` podporuje přihlášení pozvaného e-mailu (`shouldCreateUser: false`), serverové ověření identity před synchronizací, dávkové vložení soukromých dokončených běhů, stránkované načtení a smazání jednoho běhu. Místní úložiště má oddělený prostor pro osobní režim a každý účet. Převzetí místních běhů do účtu vyžaduje výslovnou akci v UI.

GPS záznamy se při synchronizaci vkládají jako neměnné snímky (`ignoreDuplicates`). Starší zařízení nesmí přepsat novější cloudový záznam. Pozdější lokální poznámky a uložené plány ještě nemají synchronizaci změn. Smazání běhu přes `delete_private_run` odstraní GPS data a atomicky uloží soukromý marker obsahující jen ID. Trigger odmítne znovuvložení stejného ID a synchronizace marker promítne i do místní historie staršího telefonu.

Migrace `20260916220000_private_beta_security.sql` přidává admin-only seznam `beta_access`, RLS podmínku schváleného vlastníka, automatický profil při schválení, kontrolu vlastníka odkazované trasy a úplné uzavření herních tabulek. Celý `client_record` je pouze soukromý záznam pro historii; žádná budoucí herní funkce mu nesmí důvěřovat jako ověřenému sportovnímu výkonu.

## Propojení skutečného projektu (dosud neprovedeno)

1. Vytvořit Supabase projekt ve zvolené oblasti a aplikovat obě SQL migrace v pořadí.
2. V Auth vypnout veřejnou registraci. Nastavit Site URL a redirect URL na přesnou HTTPS adresu `runner.html` (včetně cesty repozitáře).
3. Správcem pozvat osobní účet; jeho UUID vložit do `public.beta_access`. Trigger vytvoří soukromý profil. Klient nemá oprávnění uživatele sám schválit.
4. Vyplnit `.env` podle `.env.example`; klient smí znát pouze URL a veřejný anon/publishable klíč. Znovu sestavit aplikaci.
5. Ověřit přihlášení, vlastní zápis/načtení/smazání, dvě skutečné identity a odebrání beta přístupu. Testy v PGlite ověřují SQL pravidla, ne konfiguraci živé služby.

## Brána před zpřístupněním dalším lidem

Musí projít živá izolace dvou účtů, odmítnutí nepozvaného uživatele, expirace session, export a úplné smazání účtu, správa záloh a retence. Také je potřeba ověřit markery smazání napříč skutečnými zařízeními. Přesné GPS údaje se nesmějí dostat do analytiky ani veřejných logů. Toto není prohlášení o absolvovaném penetračním testu.
