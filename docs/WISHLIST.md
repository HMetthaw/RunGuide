# Wishlist landing page

## Co je hotové

- `index.html` je mobilní landing page připravená pro GitHub Pages.
- Google Sheet **RunGuide – wishlist testerů** obsahuje seznam přihlášek a ručně měnitelný stav každého zájemce.
- `apps-script/Code.gs` je konektor, který zapisuje formulář do konkrétního listu.

## Jednorázové propojení formuláře a Google Sheets

1. Otevři [script.new](https://script.new) pod stejným Google účtem jako tabulku.
2. Vlož obsah `apps-script/Code.gs` a projekt ulož jako `RunGuide Wishlist`.
3. Klikni na **Nasadit → Nové nasazení → Webová aplikace**. Spouštět jako: **já**. Přístup: **kdokoli**.
4. Potvrď Google oprávnění, zkopíruj adresu končící na `/exec` a vlož ji do `public-config.js` do `wishlistEndpoint`.
5. Nahraj změnu na GitHub Pages, odešli testovací formulář a ověř nový řádek v Google Sheets.

## Soukromí

Sbírají se jen údaje nutné pro pozvání do testu. Tabulku nesdílej veřejně. Aplikace nezakládá účet automaticky; vybraným lidem pošleš pozvánku až po ručním schválení.
