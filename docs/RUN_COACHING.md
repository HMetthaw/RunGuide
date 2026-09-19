# Průměrné tempo a průběžné hodnocení cíle

První běžná rada zazní nejdřív po minutě aktivního běhu a až z ustáleného
vyhlazeného tempa. Přibližně ve druhé minutě a dále každé dvě aktivní minuty
zazní celkový průměr a odhad cíle. Mezi souhrny zůstávají rady k aktuálnímu
tempu. Mezi běžnými hlášeními je alespoň 60 aktivních sekund; navigace má vždy
přednost a může souhrn odložit. Zmeškaná hlášení se nehromadí.

Průměr je **dosavadní aktivní čas / celá naměřená vzdálenost**, nikoli průměr
jednotlivých okamžitých temp. Používá přímo čas běžeckého jádra: ruční pauza
a čekání na první GPS po obnovení se nezapočítávají, běžné stání se započítává.
Hlášení používají společný český formatter s výslovnými minutami a sekundami
na kilometr, například „5 minut 30 sekund na kilometr“.

## Co znamená odhad cíle

Cílové tempo je cílový čas dělený cílovou vzdáleností. Předpokládaný čas v cíli
je aktivní čas plus zbývající vzdálenost krát dosavadní průměrné tempo. Odhad
tedy říká, co by se stalo **při zachování dosavadního průměru**; není příslibem
výsledku ani výpočtem z poslední GPS polohy.

- Průměr rychlejší o více než 20 s/km: při jeho zachování vychází časová rezerva.
- Průměr pomalejší o více než 20 s/km: při jeho zachování vychází překročení času.
- Blízko cílového tempa: přibližně na cílovém tempu, stále pouze odhad.
- Po vstupu do rychlejšího/pomalejšího pásma se rada vrací do neutrálního až
  při odchylce nejvýš 10 s/km. Tato hystereze omezuje přeskakování rad na hranici.
- Po uplynutí cílového času už hlas nevyzývá k jeho dohánění. Zbývající čas
  neklesne pod nulu a požadované tempo pro již uplynulý limit nemá hodnotu.

Příklad: cíl 2 km za 12 minut, uběhnuto 1 km za 7 minut. Průměr je 7 minut/km,
projekce dokončení 14 minut; na zbývající kilometr zbývá 5 minut. Výpočet
požadovaného zbývajícího tempa je oddělený od předpovědi při dosavadním průměru.

## Nejistá GPS a dosažení cíle

Při nepřesné nebo staré GPS a během ustalování nejsou běžné rady vysílány.
Po zaznamenané mezeře v trase zůstává průměr označený jako orientační a hlas
výslovně říká, že splnění cíle nelze spolehlivě posoudit. Stejně konzervativně
postupuje obnovený záznam ze zálohy, protože nelze znát pohyb po posledním
checkpointu. Chybějící vzdálenost se nedopočítává. Čas přebíráme z `Runner.elapsed`;
pokud při výpadku podle pravidel jádra pokračoval, ovlivní orientační průměr.

Dosažení naměřené cílové vzdálenosti se oznámí jednou, nejdříve 20 aktivních
sekund od poslední rady. Výsledek se zachytí při prvním pozorovaném dosažení,
takže odložený hlas po odbočce nebo pokračování v běhu výsledek nezmění.
Při prvním zjištění až po časovém limitu hlas pouze oznámí, že cílový čas už
uplynul; neodhaduje zpětně přesný okamžik průběhu cílem. Po dosažení vzdálenosti
už nejsou vydávány další rady ke zrychlení. Neúplná GPS nikdy nevede k oznámení
jistého splnění cíle.

## Ověření před krátkým během

Automatické testy pokrývají výpočty, nulovou vzdálenost, časový limit, pauzy,
obnovu, rozdíl mezi aktuálním a celkovým tempem, hysterézi, intervaly,
odložené hlášení kvůli navigaci a jednorázové dosažení cíle.

Na skutečném telefonu ještě ověřit při přibližně 2 km běhu:

1. Po minutě přijde aktuální tempo; kolem druhé minuty celkový průměr a odhad.
2. Pauza dlouhá alespoň minutu nemění průměr. Po obnovení nepřijde série starých rad.
3. Odbočka má přednost; souhrn zazní až po ní a nepřeruší ji.
4. Ztráta GPS nebo přepnutí/uspání aplikace nevytvoří sebejisté hlášení cíle.
5. Český hlas ve sluchátkách říká minuty a sekundy. Ověřit také přerušení zvuku
   jinou aplikací, návrat a jednorázové hlášení cíle.

Desktopové testy negarantují GPS ani řeč při zamčeném telefonu nebo na pozadí.
