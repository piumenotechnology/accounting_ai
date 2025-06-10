const { google } = require('googleapis');
require('dotenv').config();
const { pgClient } = require('../databaseService');

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

function getWeekOfMonth(date) {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfMonth = date.getDate();
  const dayOfWeekOfFirst = startOfMonth.getDay(); // 0 = Sunday, 6 = Saturday
  const week = Math.floor((dayOfMonth + dayOfWeekOfFirst - 1) / 7) + 1;
  return `Week ${week}`;
}


async function insert_pl() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // 1. Fetch data from Google Sheets
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'PL',
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) throw new Error('Not enough data');

  const dates = rows[0].slice(1); 
  const longFormat = [];

  // 2. Unpivot the table (wide → long format)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = row[0];

    for (let j = 1; j < row.length; j++) {
      const rawDate = dates[j - 1];
      const date = new Date(rawDate); 
      const amount = parseFloat(row[j]) || 0;

      longFormat.push({ date, name, amount });
    }
  }

  try {
    await pgClient.query(`DELETE FROM pl`);
    await pgClient.query('BEGIN');

    const insertSQL = 'INSERT INTO pl (date, name, amount) VALUES ($1, $2, $3)';

    for (const entry of longFormat) {
      await pgClient.query(insertSQL, [entry.date, entry.name, entry.amount]);
    }

    await pgClient.query('COMMIT');
    console.log('✅ Data inserted successfully.');
  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.error('❌ Insert failed:', err);
  }

  return longFormat;
}

async function insert_bs() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'BS', // Replace with your actual sheet/tab name
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) throw new Error('Not enough data');

  const weekLabels = rows[0].slice(1); // e.g., "Jan. 1–4, 2025"
  const longFormat = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = row[0];

    for (let j = 1; j < row.length; j++) {
      const weekLabel = weekLabels[j - 1]; // "Jan. 1–4, 2025"
      const amount = parseFloat(row[j]) || 0;

      // Parse date from label
      const match = weekLabel.match(/([A-Za-z]+)\.? (\d{1,2})[–-]/);
      const yearMatch = weekLabel.match(/(\d{4})$/);
      if (!match || !yearMatch) continue;

      const monthText = match[1]; // Jan
      const day = match[2]; // 1
      const year = yearMatch[1]; // 2025

      const dateStr = `${monthText} ${day}, ${year}`;
      const parsedDate = new Date(dateStr);
      if (isNaN(parsedDate)) continue;

      // Format as "Jan 2025"
      const month = `${parsedDate.toLocaleString('en-US', { month: 'short' })} ${parsedDate.getFullYear()}`;
      const week = getWeekOfMonth(parsedDate);


      longFormat.push({
        date: parsedDate,
        month,
        week,
        name,
        amount
      });
    }
  }

  try {
    await pgClient.query(`DELETE FROM bs`);
    await pgClient.query('BEGIN');
    const insertSQL = 'INSERT INTO bs (date, month, week, name, amount) VALUES ($1, $2, $3, $4, $5)';

    for (const entry of longFormat) {
      await pgClient.query(insertSQL, [entry.date, entry.month, entry.week, entry.name, entry.amount]);
    }

    await pgClient.query('COMMIT');
    console.log('✅ Data with month and week inserted.');
  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.error('❌ Insert failed:', err);
  }

  return longFormat;
}

async function insert_cash_flow() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'CASH FLOW', // Replace with your actual sheet/tab name
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) throw new Error('Not enough data');

  const weekLabels = rows[0].slice(1); // e.g., "Jan. 1–4, 2025"
  const longFormat = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = row[0];

    for (let j = 1; j < row.length; j++) {
      const weekLabel = weekLabels[j - 1]; // "Jan. 1–4, 2025"
      const amount = parseFloat(row[j]) || 0;

      // Parse date from label
      const match = weekLabel.match(/([A-Za-z]+)\.? (\d{1,2})[–-]/);
      const yearMatch = weekLabel.match(/(\d{4})$/);
      if (!match || !yearMatch) continue;

      const monthText = match[1]; // Jan
      const day = match[2]; // 1
      const year = yearMatch[1]; // 2025

      const dateStr = `${monthText} ${day}, ${year}`;
      const parsedDate = new Date(dateStr);
      if (isNaN(parsedDate)) continue;

      // Format as "Jan 2025"
      const month = `${parsedDate.toLocaleString('en-US', { month: 'short' })} ${parsedDate.getFullYear()}`;
      const week = getWeekOfMonth(parsedDate);


      longFormat.push({
        date: parsedDate,
        month,
        week,
        name,
        amount
      });
    }
  }

  try {
    await pgClient.query(`DELETE FROM cash_flow`);
    await pgClient.query('BEGIN');
    const insertSQL = 'INSERT INTO cash_flow (date, month, week, name, amount) VALUES ($1, $2, $3, $4, $5)';

    for (const entry of longFormat) {
      await pgClient.query(insertSQL, [entry.date, entry.month, entry.week, entry.name, entry.amount]);
    }

    await pgClient.query('COMMIT');
    console.log('✅ Data with month and week inserted.');
  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.error('❌ Insert failed:', err);
  }

  return longFormat;
}


module.exports = { fetchAllSheetsData, insert_pl, insert_bs, insert_cash_flow };
