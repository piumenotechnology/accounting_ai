const { google } = require('googleapis');
require('dotenv').config();

const credentials = JSON.parse(
  Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf8')
);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Get all sheet names
async function getSheetNames(spreadsheetId) {
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetInfo = res.data.sheets || [];
  return sheetInfo.map(sheet => sheet.properties.title);
}


// Fetch rows from specific sheet
async function fetchSheetData(spreadsheetId, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
  });

  const rows = res.data.values || [];

  if (rows.length < 2) {
    console.warn(`⚠️ Warning: Sheet '${sheetName}' has no data.`);
    return [];
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  return dataRows.map(row => {
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header.trim()] = row[idx] || null;
    });
    return obj;
  });
}

// Fetch all sheets data
async function fetchAllSheetsData() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const sheetNames = await getSheetNames(spreadsheetId);

  const allData = {};

  for (const sheetName of sheetNames) {
    console.log(`📄 Fetching: ${sheetName}`);
    allData[sheetName] = await fetchSheetData(spreadsheetId, sheetName);
  }

  return allData;
}

module.exports = { fetchAllSheetsData };
