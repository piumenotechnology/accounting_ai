const { pgClient } = require('../databaseService');
const { sheets } = require('./googleSheetsService');

const spreadsheetId = process.env.GOOGLE_SHEET_ID;

async function insertMappedData(mappedData) {
  for (const [tableName, rows] of Object.entries(mappedData)) {
    if (rows.length === 0) continue;

    console.log(`⚡ Inserting into ${tableName}: ${rows.length} rows`);

    //Delete old data first
    await pgClient.query(`DELETE FROM ${tableName}`);

    const columns = Object.keys(rows[0]);

    await pgClient.query('BEGIN');

    try {
      for (const row of rows) {
        const values = columns.map(col => row[col]);

        const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
        
        const insertQuery = `
          INSERT INTO ${tableName} (${columns.join(', ')})
          VALUES (${placeholders})
        `;
        await pgClient.query(insertQuery, values);
      }

      await pgClient.query('COMMIT');
      console.log(`✅ Inserted ${rows.length} rows into ${tableName}`);
    } catch (error) {
      await pgClient.query('ROLLBACK');
      console.error(`❌ Failed inserting rows into ${tableName}:`, error.message);
      throw error;
    }
  }
}

function getWeekOfMonth(date) {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfMonth = date.getDate();
  const dayOfWeekOfFirst = startOfMonth.getDay(); // 0 = Sunday, 6 = Saturday
  const week = Math.floor((dayOfMonth + dayOfWeekOfFirst - 1) / 7) + 1;
  return `Week ${week}`;
}

// async function insert_pl() {
//   // 1. Fetch data from Google Sheets
//   const res = await sheets.spreadsheets.values.get({
//     spreadsheetId,
//     range: 'PL',
//   });

//   const rows = res.data.values;
//   if (!rows || rows.length < 2) throw new Error('Not enough data');

//   const dates = rows[0].slice(1); 
//   const longFormat = [];

//   // 2. Unpivot the table (wide → long format)
//   for (let i = 1; i < rows.length; i++) {
//     const row = rows[i];
//     const name = row[0].toLowerCase(); 

//     for (let j = 1; j < row.length; j++) {
//       const rawDate = dates[j - 1];
//       const date = new Date(rawDate); 
//       const amount = parseFloat(row[j]) || 0;

//       longFormat.push({ date, name, amount });
//     }
//   }

//   // try {
//   //   await pgClient.query(`DELETE FROM pl`);
//   //   await pgClient.query('BEGIN');

//   //   const insertSQL = 'INSERT INTO pl (date, name, amount) VALUES ($1, $2, $3)';

//   //   for (const entry of longFormat) {
//   //     await pgClient.query(insertSQL, [entry.date, entry.name, entry.amount]);
//   //   }

//   //   await pgClient.query('COMMIT');
//   //   console.log('✅ Data inserted successfully.');
//   // } catch (err) {
//   //   await pgClient.query('ROLLBACK');
//   //   console.error('❌ Insert failed:', err);
//   // }

//   return longFormat;
// }

// async function insert_bs() {
//   const res = await sheets.spreadsheets.values.get({
//     spreadsheetId,
//     range: 'BS', // Replace with your actual sheet/tab name
//   });

//   const rows = res.data.values;
//   if (!rows || rows.length < 2) throw new Error('Not enough data');

//   const weekLabels = rows[0].slice(1); // e.g., "Jan. 1–4, 2025"
//   const longFormat = [];

//   for (let i = 1; i < rows.length; i++) {
//     const row = rows[i];
//     const name = row[0];

//     for (let j = 1; j < row.length; j++) {
//       const weekLabel = weekLabels[j - 1]; // "Jan. 1–4, 2025"
//       const amount = parseFloat(row[j]) || 0;

//       // Parse date from label
//       const match = weekLabel.match(/([A-Za-z]+)\.? (\d{1,2})[–-]/);
//       const yearMatch = weekLabel.match(/(\d{4})$/);
//       if (!match || !yearMatch) continue;

//       const monthText = match[1]; // Jan
//       const day = match[2]; // 1
//       const year = yearMatch[1]; // 2025

//       const dateStr = `${monthText} ${day}, ${year}`;
//       const parsedDate = new Date(dateStr);
//       if (isNaN(parsedDate)) continue;

//       // Format as "Jan 2025"
//       const month = `${parsedDate.toLocaleString('en-US', { month: 'short' })} ${parsedDate.getFullYear()}`;
//       const week = getWeekOfMonth(parsedDate);


//       longFormat.push({
//         date: parsedDate,
//         month : month.toLowerCase(),
//         week: week.toLowerCase(),
//         name: name.toLowerCase(),
//         amount
//       });
//     }
//   }

//   try {
//     await pgClient.query(`DELETE FROM bs`);
//     await pgClient.query('BEGIN');
//     const insertSQL = 'INSERT INTO bs (date, month, week, name, amount) VALUES ($1, $2, $3, $4, $5)';

//     for (const entry of longFormat) {
//       await pgClient.query(insertSQL, [entry.date, entry.month, entry.week, entry.name, entry.amount]);
//     }

//     await pgClient.query('COMMIT');
//     console.log('✅ Data with month and week inserted.');
//   } catch (err) {
//     await pgClient.query('ROLLBACK');
//     console.error('❌ Insert failed:', err);
//   }

//   return longFormat;
// }

async function insert_bs() {
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: ['BS'],
    includeGridData: true,
  });

  const grid = res.data.sheets[0].data[0].rowData;
  if (!grid || grid.length < 2) throw new Error('Not enough data');

  const monthMap = {
    Jan: 'january', Feb: 'february', Mar: 'march',
    Apr: 'april', May: 'may', Jun: 'june',
    Jul: 'july', Aug: 'august', Sep: 'september',
    Oct: 'october', Nov: 'november', Dec: 'december'
  };

  const monthYearLabels = grid[0].values.slice(1).map(cell => cell.formattedValue);
  const longFormat = [];

  let currentActivity = '';

  for (let i = 1; i < grid.length; i++) {
    const row = grid[i];
    if (!row || !row.values) continue;

    const nameCell = row.values[0];
    if (!nameCell || !nameCell.formattedValue) continue;

    const rawName = nameCell.formattedValue.trim();
    const name = rawName.toLowerCase();

    // Log and check background color of the name cell
    const bg = nameCell.effectiveFormat?.backgroundColor;
    const isBlue = bg && bg.blue > 0.6 && (bg.red ?? 1) < 0.4;
    if (isBlue) {
      currentActivity = rawName.toLowerCase().trim();
      console.log(`🔵 Activity set to: ${currentActivity}`);
      continue;
    }

    for (let j = 1; j < row.values.length; j++) {
      const cell = row.values[j];
      if (!cell || !cell.formattedValue) continue;

      const label = monthYearLabels[j - 1];
      if (!label) continue;

      // Skip cells with background color (not plain white)
      const cellBg = cell.effectiveFormat?.backgroundColor;
      const isCellColored = cellBg && (
        (cellBg.red ?? 1) !== 1 ||
        (cellBg.green ?? 1) !== 1 ||
        (cellBg.blue ?? 1) !== 1
      );
      if (isCellColored) continue;

      const cleanLabel = label.replace('.', '');
      const [abbrMonth, year] = cleanLabel.split(' ');
      const fullMonth = monthMap[abbrMonth];
      if (!fullMonth || !year) continue;

      const amount = parseFloat(cell.formattedValue) || 0;
      // const type = name === 'net income' ? 'net_income' : 'net_cost';

      longFormat.push({
        name,
        month: fullMonth,
        year,
        amount,
        type: currentActivity,
      });
    }
  }

  try {
    await pgClient.query(`DELETE FROM cash_flow`);
    await pgClient.query('BEGIN');
    const insertSQL = `
      INSERT INTO cash_flow (name, month, year, amount, type, activity)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    for (const entry of longFormat) {
      await pgClient.query(insertSQL, [
        entry.name,
        entry.month,
        entry.year,
        entry.amount,
        entry.type,
        entry.activity
      ]);
    }

    await pgClient.query('COMMIT');
    console.log('✅ Data inserted with type and activity.');
  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.error('❌ Insert failed:', err);
  }

  return longFormat;
}

async function insert_cash_flow() {
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: ['CASH FLOW'],
    includeGridData: true,
  });

  const grid = res.data.sheets[0].data[0].rowData;
  if (!grid || grid.length < 2) throw new Error('Not enough data');

  const monthMap = {
    Jan: 'january', Feb: 'february', Mar: 'march',
    Apr: 'april', May: 'may', Jun: 'june',
    Jul: 'july', Aug: 'august', Sep: 'september',
    Oct: 'october', Nov: 'november', Dec: 'december'
  };

  const monthYearLabels = grid[0].values.slice(1).map(cell => cell.formattedValue);
  const longFormat = [];

  let currentActivity = '';

  for (let i = 1; i < grid.length; i++) {
    const row = grid[i];
    if (!row || !row.values) continue;

    const nameCell = row.values[0];
    if (!nameCell || !nameCell.formattedValue) continue;

    const rawName = nameCell.formattedValue.trim();
    const name = rawName.toLowerCase();

    // Log and check background color of the name cell
    const bg = nameCell.effectiveFormat?.backgroundColor;
    const isBlue = bg && bg.blue > 0.6 && (bg.red ?? 1) < 0.4;
    if (isBlue) {
      currentActivity = rawName.toLowerCase().replace(' activities', '').trim();
      console.log(`🔵 Activity set to: ${currentActivity}`);
      continue;
    }

    for (let j = 1; j < row.values.length; j++) {
      const cell = row.values[j];
      if (!cell || !cell.formattedValue) continue;

      const label = monthYearLabels[j - 1];
      if (!label) continue;

      // Skip cells with background color (not plain white)
      const cellBg = cell.effectiveFormat?.backgroundColor;
      const isCellColored = cellBg && (
        (cellBg.red ?? 1) !== 1 ||
        (cellBg.green ?? 1) !== 1 ||
        (cellBg.blue ?? 1) !== 1
      );
      if (isCellColored) continue;

      const cleanLabel = label.replace('.', '');
      const [abbrMonth, year] = cleanLabel.split(' ');
      const fullMonth = monthMap[abbrMonth];
      if (!fullMonth || !year) continue;

      const amount = parseFloat(cell.formattedValue) || 0;
      const type = name === 'net income' ? 'net_income' : 'net_cost';

      longFormat.push({
        name,
        month: fullMonth,
        year,
        amount,
        type,
        activity: currentActivity
      });
    }
  }

  try {
    await pgClient.query(`DELETE FROM cash_flow`);
    await pgClient.query('BEGIN');
    const insertSQL = `
      INSERT INTO cash_flow (name, month, year, amount, type, activity)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    for (const entry of longFormat) {
      await pgClient.query(insertSQL, [
        entry.name,
        entry.month,
        entry.year,
        entry.amount,
        entry.type,
        entry.activity
      ]);
    }

    await pgClient.query('COMMIT');
    console.log('✅ Data inserted with type and activity.');
  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.error('❌ Insert failed:', err);
  }

  return longFormat;
}

async function insert_pl() {
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: ['PL!A1:FB100'], // Adjust range as needed
    includeGridData: true,
  });

  const grid = res.data.sheets[0].data[0].rowData;
  if (!grid || grid.length < 2) throw new Error('Not enough data');

  const dateLabels = grid[0].values.slice(1).map(cell => cell.formattedValue);
  const longFormat = [];

  let currentType = '';
  const rowTypes = new Array(grid.length).fill('');

  // Pass 1: work bottom-up to detect and assign types
  for (let i = grid.length - 1; i >= 1; i--) {
    const row = grid[i];
    if (!row || !row.values || !row.values[0]?.formattedValue) continue;

    const cell = row.values[0];
    const label = cell.formattedValue.trim();

    // Detect blue background
    const bg = cell.effectiveFormat?.backgroundColor;
    const isBlue = bg && bg.blue > 0.6 && (bg.red ?? 1) < 0.4;

    // If this is a blue "Total" row, set the current type
    if (isBlue && label.toLowerCase().startsWith('total ')) {
      currentType = label.replace(/^total\s+/i, '').replace(/\d+/g, '') .trim().toLowerCase();
      continue;
    }

    rowTypes[i] = currentType; // assign the current type to this row (if any)
  }

  // Pass 2: extract values (top-down)
  for (let i = 1; i < grid.length; i++) {
    const row = grid[i];
    const type = rowTypes[i];
    if (!type) continue; // skip if no type assigned

    const cell = row.values[0];
    const label = cell.formattedValue.trim();
    const parts = label.split(' ');
    const codeCandidate = parts[0];
    const isCode = /^\d{5}$/.test(codeCandidate);
    if (!isCode) continue;

    const code = codeCandidate;
    const name = parts.slice(1).join(' ').toLowerCase().trim();

    for (let j = 1; j < row.values.length; j++) {
      const cell = row.values[j];
      if (!cell || !cell.formattedValue) continue;

      const rawDate = dateLabels[j - 1];
      const date = new Date(rawDate);
      if (isNaN(date)) continue;

      const amount = parseFloat(cell.formattedValue) || 0;

      longFormat.push({ date, code, name, type, amount });
    }
  }

  try {
    await pgClient.query('DELETE FROM pl');
    await pgClient.query('BEGIN');

    const insertSQL = 'INSERT INTO pl (date, code, name, type, amount) VALUES ($1, $2, $3, $4, $5)';

    for (const entry of longFormat) {
      await pgClient.query(insertSQL, [
        entry.date,
        entry.code,
        entry.name,
        entry.type,
        entry.amount,
      ]);
    }

    await pgClient.query('COMMIT');
    console.log('✅ PL data inserted with correct type from below totals.');
  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.error('❌ Insert failed:', err);
  }

  return longFormat;
}

module.exports = { insertMappedData, insert_pl, insert_bs, insert_cash_flow };
