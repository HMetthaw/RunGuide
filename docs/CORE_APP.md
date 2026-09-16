# Běžecké jádro — první prototyp

`runner.html` je samostatná mobilní obrazovka aplikace RunGuide.

## Co už umí

- nastavit cílovou vzdálenost a čas a spočítat tempo;
- naklikat vlastní trasu na mapě a zobrazit její délku;
- načíst GPS polohu a během běhu počítat vzdálenost, čas, tempo a odchylku;
- hlasem říct radu k tempu a při dostupném směru GPS i levou/pravou instrukci k dalšímu bodu;
- uložit plán i dokončené běhy lokálně do telefonu.

## Záměrné limity této fáze

- Mapa pracuje s ručně zvolenými body, ne s routováním po silnicích. Přesné instrukce pro každou křižovatku vyžadují pozdější routingovou službu.
- PWA prohlížeč může omezit GPS, pokud je aplikace dlouho na pozadí. Pro první test nech aplikaci otevřenou.
- Historie je zatím pouze v `localStorage`. Před uzavřenou betou se připojí Supabase se zabezpečeným účtem a cloudovým ukládáním.
- Běh se neodešle na žádný server a přesná poloha se nikam nesdílí.
