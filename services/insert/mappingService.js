const sheetColumnConfig = require('../../config/sheetColumns.js');

const doNotLowercase = [];

function isValidDate(value) {
  return !isNaN(Date.parse(value));
}

function replaceSpacesWithUnderscores(text) {
  return text.replace(/\s+/g, '_');
}

function mapSheetsData(allSheetsData) {
  const mapped = {};

  for (const [sheetName, rows] of Object.entries(allSheetsData)) {
    const cleanRows = rows
    .map((row, index) => {
      const clean = {};

      for (var [key, value] of Object.entries(row)) {
        const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');

        if ((sheetName.toLowerCase() === 'ar' || sheetName.toLowerCase() === 'ap') &&
            (normalizedKey === 'date') && 
            typeof value === 'string' &&
            !isValidDate(value)) {
          return null; 
        }

        if ((sheetName.toLowerCase() === 'ap' || sheetName.toLowerCase() === 'ar') && normalizedKey === 'due_date' && !isValidDate(value)){
          value = null;
        }

        if (value === undefined || value === '') {
          clean[normalizedKey] = null;
        }else if (typeof value === 'string') {
          clean[normalizedKey] = doNotLowercase.includes(normalizedKey)
            ? value.trim()
            : value.trim().toLowerCase();
        } else {
          clean[normalizedKey] = value;
        }
      }

      return clean;
    })
    .filter(Boolean); 


    const normalizedSheet = sheetName.toLowerCase().replace(/\s+/g, '_'); // Normalize sheet name

    const excludeSheets = [
      // 'marketing',
      // 'lead',
      // 'payment',
      // 'invoice',
      // 'ap'
    ];

    if (excludeSheets.includes(normalizedSheet)) {
      console.log(`Skipping sheet: ${sheetName}`);
      continue;
    }

    const allowedColumns = sheetColumnConfig[normalizedSheet];

    const finalRows = !allowedColumns
      ? cleanRows
      : cleanRows.map(row => {
          const result = {};
          for (const col of allowedColumns) {
            result[col] = row[col] ?? null;
          }
          return result;
        });

    mapped[normalizedSheet] = finalRows;
  }

  return mapped;
}

module.exports = { mapSheetsData };
