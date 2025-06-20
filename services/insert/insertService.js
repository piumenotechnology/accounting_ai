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

// function getWeekOfMonth(date) {
//   const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
//   const dayOfMonth = date.getDate();
//   const dayOfWeekOfFirst = startOfMonth.getDay(); // 0 = Sunday, 6 = Saturday
//   const week = Math.floor((dayOfMonth + dayOfWeekOfFirst - 1) / 7) + 1;
//   return `Week ${week}`;
// }

/*data cash flow*/
// async function insert_cash_flow() {
//   const res = await sheets.spreadsheets.get({
//     spreadsheetId,
//     ranges: ['CASH FLOW'],
//     includeGridData: true,
//   });

//   const grid = res.data.sheets[0].data[0].rowData;
//   if (!grid || grid.length < 2) throw new Error('Not enough data');

//   const monthMap = {
//     Jan: 'january', Feb: 'february', Mar: 'march',
//     Apr: 'april', May: 'may', Jun: 'june',
//     Jul: 'july', Aug: 'august', Sep: 'september',
//     Oct: 'october', Nov: 'november', Dec: 'december'
//   };

//   const monthYearLabels = grid[0].values.slice(1).map(cell => cell.formattedValue);
//   const longFormat = [];

//   let currentActivity = '';

//   for (let i = 1; i < grid.length; i++) {
//     const row = grid[i];
//     if (!row || !row.values) continue;

//     const nameCell = row.values[0];
//     if (!nameCell || !nameCell.formattedValue) continue;

//     const rawName = nameCell.formattedValue.trim();
//     const name = rawName.toLowerCase();

//     // Log and check background color of the name cell
//     const bg = nameCell.effectiveFormat?.backgroundColor;
//     const isBlue = bg && bg.blue > 0.6 && (bg.red ?? 1) < 0.4;
//     if (isBlue) {
//       currentActivity = rawName.toLowerCase().replace(' activities', '').trim();
//       console.log(`🔵 Activity set to: ${currentActivity}`);
//       continue;
//     }

//     for (let j = 1; j < row.values.length; j++) {
//       const cell = row.values[j];
//       if (!cell || !cell.formattedValue) continue;

//       const label = monthYearLabels[j - 1];
//       if (!label) continue;

//       // Skip cells with background color (not plain white)
//       const cellBg = cell.effectiveFormat?.backgroundColor;
//       const isCellColored = cellBg && (
//         (cellBg.red ?? 1) !== 1 ||
//         (cellBg.green ?? 1) !== 1 ||
//         (cellBg.blue ?? 1) !== 1
//       );
//       if (isCellColored) continue;

//       const cleanLabel = label.replace('.', '');
//       const [abbrMonth, year] = cleanLabel.split(' ');
//       const fullMonth = monthMap[abbrMonth];
//       if (!fullMonth || !year) continue;

//       const amount = parseFloat(cell.formattedValue) || 0;
//       const type = name === 'net income' ? 'net_income' : 'net_cost';

//       longFormat.push({
//         name,
//         month: fullMonth,
//         year,
//         amount,
//         type,
//         activity: currentActivity
//       });
//     }
//   }

//   try {
//     await pgClient.query(`DELETE FROM cash_flow`);
//     await pgClient.query('BEGIN');
//     const insertSQL = `
//       INSERT INTO cash_flow (name, month, year, amount, type, activity)
//       VALUES ($1, $2, $3, $4, $5, $6)
//     `;

//     for (const entry of longFormat) {
//       await pgClient.query(insertSQL, [
//         entry.name,
//         entry.month,
//         entry.year,
//         entry.amount,
//         entry.type,
//         entry.activity
//       ]);
//     }

//     await pgClient.query('COMMIT');
//     console.log('✅ Data inserted with type and activity.');
//   } catch (err) {
//     await pgClient.query('ROLLBACK');
//     console.error('❌ Insert failed:', err);
//   }

//   return longFormat;
// }

/*data bs*/
// async function insert_bs() {
//   const res = await sheets.spreadsheets.get({
//     spreadsheetId,
//     ranges: ['BS!A1:M212'],
//     includeGridData: true,
//   });

//   const grid = res.data.sheets[0].data[0].rowData;
//   if (!grid || grid.length < 2) throw new Error('Not enough data');

//   const monthMap = {
//     Jan: 'january', Feb: 'february', Mar: 'march',
//     Apr: 'april', May: 'may', Jun: 'june',
//     Jul: 'july', Aug: 'august', Sep: 'september',
//     Oct: 'october', Nov: 'november', Dec: 'december'
//   };

//   const monthYearLabels = grid[0].values.slice(1).map(cell => cell.formattedValue);
//   const longFormat = [];

//   let currentActivity = '';

//   for (let i = 1; i < grid.length; i++) {
//     const row = grid[i];
//     if (!row || !row.values) continue;

//     const nameCell = row.values[0];
//     if (!nameCell || !nameCell.formattedValue) continue;

//     const rawName = nameCell.formattedValue.trim();
//     const name = rawName.toLowerCase();

//     // Log and check background color of the name cell
//     const bg = nameCell.effectiveFormat?.backgroundColor;
//     const isBlue = bg && bg.blue > 0.6 && (bg.red ?? 1) < 0.4;
//     if (isBlue) {
//       currentActivity = rawName.toLowerCase().trim();
//       console.log(`🔵 Activity set to: ${currentActivity}`);
//       continue;
//     }

//     for (let j = 1; j < row.values.length; j++) {
//       const cell = row.values[j];
//       if (!cell || !cell.formattedValue) continue;

//       const label = monthYearLabels[j - 1];
//       if (!label) continue;

//       // Skip cells with background color (not plain white)
//       const cellBg = cell.effectiveFormat?.backgroundColor;
//       const isCellColored = cellBg && (
//         (cellBg.red ?? 1) !== 1 ||
//         (cellBg.green ?? 1) !== 1 ||
//         (cellBg.blue ?? 1) !== 1
//       );
//       if (isCellColored) continue;

//       const cleanLabel = label.replace('.', '');
//       const [abbrMonth, year] = cleanLabel.split(' ');
//       const fullMonth = monthMap[abbrMonth];
//       if (!fullMonth || !year) continue;

//       const amount = parseFloat(cell.formattedValue) || 0;
//       if (!amount) continue; // ✅ Skip null or 0 values)
//       // const type = name === 'net income' ? 'net_income' : 'net_cost';

//       longFormat.push({
//         name,
//         month: fullMonth,
//         year,
//         amount,
//         type: currentActivity,
//       });
//     }
//   }

//   try {
//     await pgClient.query(`DELETE FROM cash_flow`);
//     await pgClient.query('BEGIN');
//     const insertSQL = `
//       INSERT INTO cash_flow (name, month, year, amount, type, activity)
//       VALUES ($1, $2, $3, $4, $5, $6)
//     `;

//     for (const entry of longFormat) {
//       await pgClient.query(insertSQL, [
//         entry.name,
//         entry.month,
//         entry.year,
//         entry.amount,
//         entry.type,
//         entry.activity
//       ]);
//     }

//     await pgClient.query('COMMIT');
//     console.log('✅ Data inserted with type and activity.');
//   } catch (err) {
//     await pgClient.query('ROLLBACK');
//     console.error('❌ Insert failed:', err);
//   }

//   return longFormat;
// }

/*data pl*/
async function insert_pl() {
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: ['PL!A1:FB90'], // Adjust range as needed
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
      currentType = label.replace(/^total\s+/i, '').replace(/\d+/g, '').trim().replace(/\s+/g, '_').toLowerCase();
      continue;
    }

    rowTypes[i] = currentType;
  }

  // Pass 2: extract values (top-down)
  for (let i = 1; i < grid.length; i++) {
    const row = grid[i];
    let category = rowTypes[i];

    const cell = row.values[0];
    const label = cell.formattedValue.trim();

    const parts = label.split(' ');
    const codeCandidate = parts[0];
    const isCode = /^\d{4,}$/.test(codeCandidate);
    // if (!isCode) continue;
    // const code = codeCandidate;
    // const name = parts.slice(1).join(' ').toLowerCase().trim();
    const name = parts.join(' ').toLowerCase().trim();

    if(!category && name.includes('total')){
      category = name.replace(/^total\s+/i, '').replace(/\d+/g, '').trim().replace(/\s+/g, '_').toLowerCase();;
    }else if (!category) {
      category = name.replace(/\s+/g, '_');
    }

    for (let j = 1; j < row.values.length; j++) {
      const cell = row.values[j];
      if (!cell || !cell.formattedValue) continue;

      const rawDate = dateLabels[j - 1];
      const date = new Date(rawDate);
      if (isNaN(date)) continue;

      const amount = parseFloat(cell.formattedValue) || 0;
      if (!amount) continue;

      let line_type = isCode ? 'data' : 'total' ;

      if (name === 'gross profit'){
        category = name.replace(/\s+/g, '_');
      }

      longFormat.push({ name, category, line_type, amount,  date });
    }
  }

  try {
    await pgClient.query('BEGIN');
    await pgClient.query('DELETE FROM pl');

    const insertSQL = 'INSERT INTO pl (name, category, line_type, amount, date) VALUES ($1, $2, $3, $4, $5)';

    for (const entry of longFormat) {
      await pgClient.query(insertSQL, [
        entry.name,
        entry.category,
        entry.line_type,
        entry.amount,
        entry.date,
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



async function insert_cash_flow() {
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: ['CASH FLOW!A1:M38'],
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

    // Check if name cell has a blue background
    const bg = nameCell.effectiveFormat?.backgroundColor;
    const isBlue = bg && bg.blue > 0.6 && (bg.red ?? 1) < 0.4;
    if (isBlue) {
      let cleanName = rawName.toLowerCase().trim();
      if (cleanName.endsWith(' activities')) {
        cleanName = cleanName.replace(' activities', '');
      }
      currentActivity = cleanName.trim();
      console.log(`🔵 Activity set to: ${currentActivity}`);
      continue;
    }

    for (let j = 1; j < row.values.length; j++) {
      const cell = row.values[j];
      if (!cell || !cell.formattedValue) continue;

      const label = monthYearLabels[j - 1];
      if (!label) continue;

      const cellBg = cell.effectiveFormat?.backgroundColor;

      const isRedBg = cellBg &&
        (cellBg.red ?? 0) > 0.6 &&
        (cellBg.green ?? 0) < 0.4 &&
        (cellBg.blue ?? 0) < 0.4;

      const isNonWhite = cellBg && (
        (cellBg.red ?? 1) !== 1 ||
        (cellBg.green ?? 1) !== 1 ||
        (cellBg.blue ?? 1) !== 1
      );

      // Skip all non-white, non-red backgrounds
      if (isNonWhite && !isRedBg) continue;

      const cleanLabel = label.replace('.', '');
      const [abbrMonth, year] = cleanLabel.split(' ');
      const fullMonth = monthMap[abbrMonth];
      if (!fullMonth || !year) continue;

      const amount = parseFloat(cell.formattedValue) || 0;
      if (!amount) continue; // ✅ Skip null or 0 values

      // const category = isRedBg ? 'analysis' : (name === 'net income' ? 'net_income' : 'net_cash');

      let category = 'net_cash';
      let activity_type = currentActivity;

      // Determine category and possibly override activity_type based on `name`
      const lowerName = name.toLowerCase().trim();

      if (lowerName === 'net income') {
        category = 'net_income';
      } else if (
        lowerName === 'total adjustments to reconcile net income to net cash provided by operations:'
      ) {
        category = 'subtotal';
      } else if (lowerName.includes('net cash increase for period')) {
        category = 'summary';
        activity_type = 'summary';
      } else if (lowerName.includes('net cash provided')) {
        category = 'total';
      }

      const date = new Date(`${fullMonth} 1, ${year}`);
      const dbDate = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

      longFormat.push({
        name,
        month: fullMonth,
        year,
        amount,
        category,
        activity_type,
        date : dbDate
      });
    }
  }

  try {
    await pgClient.query(`DELETE FROM cash_flow`);
    await pgClient.query('BEGIN');
    const insertSQL = `
      INSERT INTO cash_flow (name, month, year, amount, category, activity_type, date_)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    for (const entry of longFormat) {
      await pgClient.query(insertSQL, [
        entry.name,
        entry.month,
        entry.year,
        entry.amount,
        entry.category,
        entry.activity_type,
        entry.date,
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

async function insert_bs() {
  try {
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: ['BS!A1:M212'],
      includeGridData: true,
    });

    const grid = res.data.sheets?.[0]?.data?.[0]?.rowData;
    if (!grid || grid.length < 2) {
      throw new Error('Insufficient data: Grid must have at least 2 rows');
    }

    const monthMap = {
      Jan: 'january', Feb: 'february', Mar: 'march',
      Apr: 'april', May: 'may', Jun: 'june',
      Jul: 'july', Aug: 'august', Sep: 'september',
      Oct: 'october', Nov: 'november', Dec: 'december'
    };

    // Extract month-year labels from header row
    const monthYearLabels = grid[0].values?.slice(1)
      .map(cell => cell?.formattedValue)
      .filter(Boolean) || [];

    const longFormat = [];
    let currentCategory = '';
    let currentType = '';
    let currentSubCategory = '';

    // Helper function to normalize account names
    const normalizeAccountName = (name) => {
      return name
        .toLowerCase()
        .replace(/\s*\(.*?\)\s*/g, '')   // Remove parentheses and contents
        .replace(/[^a-z0-9]+/g, '_')     // Replace non-alphanumeric with "_"
        .replace(/^_+|_+$/g, '');        // Remove leading/trailing underscores
    };

    // Helper function to check background color
    const checkBackgroundColor = (bg) => {
      if (!bg) return 'white';
      
      const red = bg.red ?? 0;
      const green = bg.green ?? 0;
      const blue = bg.blue ?? 0;

      if (green > 0.6 && red < 0.5 && blue < 0.5) return 'green';
      if (blue > 0.6 && red < 0.4) return 'blue';
      if (red > 0.8 && green > 0.7 && blue < 0.3) return 'yellow';
      if (red > 0.6 && green < 0.4 && blue < 0.4) return 'red';
      
      // Check if it's truly white
      if (red === 1 && green === 1 && blue === 1) return 'white';
      
      return 'other';
    };

    // Process each row
    for (let i = 1; i < grid.length; i++) {
      const row = grid[i];
      if (!row?.values?.[0]?.formattedValue) continue;

      const rawName = row.values[0].formattedValue.trim();
      const account_name = rawName.toLowerCase();

      // Skip total rows with numbers
      if (/^total\s+\d+/i.test(account_name)) {
        console.log("Skipped:", account_name);
        continue;
      }

      const nameCell = row.values[0];
      const bgColor = checkBackgroundColor(nameCell.effectiveFormat?.backgroundColor);

      // Handle category headers based on background color
      switch (bgColor) {
        case 'green':
          currentType = normalizeAccountName(account_name);
          console.log(`🟢 Activity Type set to: ${currentType}`);
          continue;
        
        case 'blue':
          currentCategory = normalizeAccountName(account_name);
          console.log(`🔵 Category set to: ${currentCategory}`);
          continue;
        
        case 'yellow':
          currentSubCategory = normalizeAccountName(account_name);
          console.log(`🟡 Sub-category set to: ${currentSubCategory}`);
          continue;
      }

      // Process data cells for this account
      for (let j = 1; j < row.values.length && j <= monthYearLabels.length; j++) {
        const cell = row.values[j];
        if (!cell?.formattedValue) continue;

        const label = monthYearLabels[j - 1];
        if (!label) continue;

        const cellBgColor = checkBackgroundColor(cell.effectiveFormat?.backgroundColor);
        
        // Skip non-white, non-red backgrounds
        if (cellBgColor !== 'white' && cellBgColor !== 'red') continue;

        // Parse month and year
        const cleanLabel = label.replace('.', '');
        const [abbrMonth, year] = cleanLabel.split(' ');
        const fullMonth = monthMap[abbrMonth];
        
        if (!fullMonth || !year) {
          console.warn(`Invalid date format: ${label}`);
          continue;
        }

        const amount = parseFloat(cell.formattedValue.replace(/[,$]/g, '')) || 0;
        if (amount === 0) continue; // Skip zero values

        // Determine line type and category overrides
        let activity_type = currentType;
        let category = currentCategory;
        let category_type = currentSubCategory;
        let line_type = cellBgColor === 'red' ? 'subtotal' : 'data';

        // Special handling for summary accounts
        const summaryAccounts = ['retained earnings', 'profit for the year', 'total liabilities and equity'];
        if (summaryAccounts.includes(account_name)) {
          activity_type = 'summary';
          category = '';
          category_type = '';
          line_type = 'total';
        }

        // Handle total rows
        if (account_name === `total ${activity_type}`) {
          line_type = 'total';
          category = '';
          category_type = '';
        }

        // Category-specific rules
        if (activity_type === 'equity') {
          category = '';
          category_type = '';
        }

        if (category === 'non_current_liabilities') {
          category_type = '';
        }

        longFormat.push({
          account_name,
          month: fullMonth,
          year: parseInt(year),
          amount,
          activity_type,
          category,
          category_type,
          line_type
        });
      }
    }

    // Database transaction
    await pgClient.query('BEGIN');
    
    try {
      // Clear existing data
      await pgClient.query('DELETE FROM bs');
      
      // Prepare bulk insert
      const insertSQL = `
        INSERT INTO bs (account_name, month, year, amount, activity_type, category, category_type, line_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;

      // Batch insert for better performance
      const batchSize = 100;
      for (let i = 0; i < longFormat.length; i += batchSize) {
        const batch = longFormat.slice(i, i + batchSize);
        const promises = batch.map(entry => 
          pgClient.query(insertSQL, [
            entry.account_name,
            entry.month,
            entry.year,
            entry.amount,
            entry.activity_type,
            entry.category,
            entry.category_type,
            entry.line_type,
          ])
        );
        await Promise.all(promises);
      }

      await pgClient.query('COMMIT');
      console.log(`✅ Successfully inserted ${longFormat.length} records`);
      
    } catch (insertErr) {
      await pgClient.query('ROLLBACK');
      throw insertErr;
    }

    return longFormat;

  } catch (error) {
    console.error('❌ Function failed:', error.message);
    throw error;
  }
}


module.exports = { insertMappedData, insert_pl, insert_bs, insert_cash_flow };
