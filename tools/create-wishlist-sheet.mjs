import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "C:/Users/Matěj Holeš/AppData/Local/Temp/runguide-wishlist";
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Wishlist");
sheet.showGridLines = false;
sheet.tabColor = "#163B32";

sheet.mergeCells("A1:K1");
sheet.getRange("A1").values = [["RunGuide · wishlist testerů"]];
sheet.getRange("A1:K1").format = {
  fill: "#163B32",
  font: { name: "Arial", size: 16, bold: true, color: "#FFFFFF" },
  verticalAlignment: "center",
};
sheet.getRange("A1").format.rowHeight = 30;

sheet.mergeCells("A2:K2");
sheet.getRange("A2").values = [["Přihlášky z landing page. Každý řádek představuje jednu žádost o testovací účet."]];
sheet.getRange("A2:K2").format = {
  font: { name: "Arial", size: 10, italic: true, color: "#4B5563" },
  verticalAlignment: "center",
};
sheet.getRange("A2").format.rowHeight = 22;

const headers = [[
  "Přihlášeno", "Jméno", "E-mail", "Město", "Telefon", "Jak často běháš?",
  "Proč chceš testovat?", "Souhlas s oslovením", "Stav", "Pozvánka odeslána", "Poznámky"
]];
sheet.getRange("A4:K4").values = headers;
sheet.getRange("A4:K4").format = {
  fill: "#E7F2EC",
  font: { name: "Arial", size: 10, bold: true, color: "#163B32" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "outside", style: "thin", color: "#B9D5C4" },
};
sheet.getRange("A4:K4").format.rowHeight = 34;

sheet.getRange("A5:K250").format = {
  font: { name: "Arial", size: 10, color: "#1F2937" },
  verticalAlignment: "center",
  borders: { insideHorizontal: { style: "thin", color: "#E5E7EB" } },
};
sheet.getRange("A5:A250").format.numberFormat = "yyyy-mm-dd hh:mm";
sheet.getRange("J5:J250").format.numberFormat = "yyyy-mm-dd";
sheet.getRange("A5:K250").format.rowHeight = 22;
sheet.getRange("A4:A250").format.columnWidth = 19;
sheet.getRange("B4:B250").format.columnWidth = 20;
sheet.getRange("C4:C250").format.columnWidth = 28;
sheet.getRange("D4:D250").format.columnWidth = 18;
sheet.getRange("E4:E250").format.columnWidth = 15;
sheet.getRange("F4:F250").format.columnWidth = 20;
sheet.getRange("G4:G250").format.columnWidth = 34;
sheet.getRange("H4:H250").format.columnWidth = 20;
sheet.getRange("I4:I250").format.columnWidth = 16;
sheet.getRange("J4:J250").format.columnWidth = 18;
sheet.getRange("K4:K250").format.columnWidth = 32;

sheet.getRange("H5:H250").dataValidation = { rule: { type: "list", values: ["Ano", "Ne"] } };
sheet.getRange("I5:I250").dataValidation = { rule: { type: "list", values: ["Nová", "Kontaktovat", "Pozvánka odeslána", "Testuje", "Není zájem"] } };
sheet.getRange("J5:J250").dataValidation = { rule: { type: "list", values: ["Ano", "Ne"] } };
sheet.getRange("I5:I250").conditionalFormats.add("containsText", { text: "Nová", format: { fill: "#FFF4CC", font: { color: "#7A4B00", bold: true } } });
sheet.getRange("I5:I250").conditionalFormats.add("containsText", { text: "Testuje", format: { fill: "#DCFCE7", font: { color: "#166534", bold: true } } });

sheet.freezePanes.freezeRows(4);
workbook.recalculate();

const check = await workbook.inspect({ kind: "table", range: "Wishlist!A1:K8", include: "values,formulas", tableMaxRows: 8, tableMaxCols: 11 });
console.log(check.ndjson);
const preview = await workbook.render({ sheetName: "Wishlist", range: "A1:K12", scale: 1.5, format: "png" });
await fs.writeFile(`${outputDir}/preview.png`, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/RunGuide-wishlist.xlsx`);
