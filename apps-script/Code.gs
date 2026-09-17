const SPREADSHEET_ID = '1yp1FJxfVxJLuommDqfAFb3GPzpq7ItNaPWqUcq6IYeQ';
const SHEET_NAME = 'Wishlist';
const HEADER_ROW = 4;
const DEVICES = ['iPhone', 'Android', 'Jiné / nevím'];
const FREQUENCIES = ['Více než 3× týdně', '1–3× týdně', 'Občas, ale chci začít víc'];

function doPost(event) {
  let lock;
  let locked = false;
  try {
    const body = event && event.postData && event.postData.contents;
    if (typeof body !== 'string' || body.length > 12000) return response_({ok: false, error: 'invalid'});
    const input = JSON.parse(body);
    if (!input || typeof input !== 'object' || Array.isArray(input)) return response_({ok: false, error: 'invalid'});
    if (input.website) return response_({ok: false, error: 'invalid'});
    const name = text_(input.name, 80, true);
    const email = text_(input.email, 254, true).toLowerCase();
    const city = text_(input.city, 100, false);
    const message = text_(input.message, 1500, false);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || /^[=+\-@]/.test(email)
      || !DEVICES.includes(input.device) || !FREQUENCIES.includes(input.frequency)
      || input.consent !== 'Ano') return response_({ok: false, error: 'invalid'});

    lock = LockService.getScriptLock();
    locked = lock.tryLock(10000);
    if (!locked) return response_({ok: false, error: 'busy'});
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet || sheet.getRange(HEADER_ROW, 3).getValue() !== 'E-mail') throw new Error('schema');
    const lastRow = sheet.getLastRow();
    const existing = lastRow > HEADER_ROW
      ? sheet.getRange(HEADER_ROW + 1, 3, lastRow - HEADER_ROW, 1).getValues() : [];
    if (existing.some(row => String(row[0]).trim().toLowerCase() === email)) {
      // Same response for new/existing emails; no membership or applicant details exposed.
      return response_({ok: true, status: 'received'});
    }

    const rowNumber = Math.max(HEADER_ROW + 1, lastRow + 1);
    const values = [new Date(), safeCell_(name), email, safeCell_(city), input.device,
      input.frequency, safeCell_(message), 'Ano', 'Nová', 'Ne', ''];
    sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
    SpreadsheetApp.flush();
    const saved = sheet.getRange(rowNumber, 1, 1, values.length).getValues()[0];
    if (saved[2] !== email || saved[7] !== 'Ano' || saved[8] !== 'Nová') throw new Error('readback');
    return response_({ok: true, status: 'received'});
  } catch (_error) {
    // Do not log request bodies or personal details.
    return response_({ok: false, error: 'unconfirmed'});
  } finally {
    if (locked) lock.releaseLock();
  }
}

function text_(value, maximum, required) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') throw new Error('type');
  const text = value.trim();
  if (text.length > maximum || (required && !text.length)
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new Error('length');
  return text;
}

function safeCell_(text) {
  // Apostrophe forces literal text in Sheets and guards formula starters on CSV export.
  return /^[=+\-@\t\r\n]/.test(text) ? "'" + text : text;
}

function response_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
