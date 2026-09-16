# Návrh backendu

## Rozdělení odpovědností

GitHub Pages hostuje pouze PWA. Supabase obsluhuje přihlášení a databázi. Žádný tajný klíč se nevkládá do klienta; PWA používá výhradně veřejný anon klíč s Row Level Security.

## První verze

- `profiles`: soukromý profil přihlášeného člověka.
- `running_routes`: uložené, ručně vytvořené trasy.
- `runs`: souhrn a zjednodušený záznam dokončeného běhu.

Přesné trasy čte a upravuje jen jejich vlastník. Mapový náhled historie se vykresluje z uložené zjednodušené trasy, bez ukládání obrázků.

## Připraveno pro fázi Territory & Clans

- `territory_cells`: aktuální vlastník každé budoucí šestiúhelníkové buňky.
- `territory_claims`: neměnný audit převzetí buněk.
- `squads` a `squad_members`: budoucí klany.

Klient nebude mít právo buňky přímo měnit. Pozdější serverová funkce ověří běh, zjednoduší polygon, dopočítá buňky a provede převzetí atomicky. První verze tyto tabulky nepoužívá.

## Soukromí

- Raw GPS trasa nikdy není veřejný zdroj dat.
- Veřejná herní mapa může později ukazovat jen buňky s rozumně hrubým rozlišením.
- Přesné starty, konce a historie zůstávají soukromé.
- Uživatel musí moci kdykoli smazat trasu i účet.
