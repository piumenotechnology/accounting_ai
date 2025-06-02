// const sheetColumnConfig = require('../../config/sheetColumns.js');

// const doNotLowercase = [];

// function isValidDate(value) {
//   return !isNaN(Date.parse(value));
// }

// function replaceSpacesWithUnderscores(text) {
//   return text.replace(/\s+/g, '_');
// }

// function mapSheetsData(allSheetsData) {
//   const mapped = {};

//   for (const [sheetName, rows] of Object.entries(allSheetsData)) {
//     const cleanRows = rows
//     .map((row, index) => {
//       const clean = {};

//       for (var [key, value] of Object.entries(row)) {
//         const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');

//         if ((sheetName.toLowerCase() === 'ar' || sheetName.toLowerCase() === 'ap') &&
//             (normalizedKey === 'date') && 
//             typeof value === 'string' &&
//             !isValidDate(value)) {
//           return null; 
//         }

//         if (sheetName.toLowerCase() === 'payment'  && normalizedKey === 'expenses_type'){
//           const jsonStrings = value.split(/(?<=})\s*(?={)/);

//           const firstObj = JSON.parse(jsonStrings[0]);

//           const firstAccountRefName = firstObj?.AccountRef?.name || null;

//           value = firstAccountRefName || null; 
//         }

//         if ((sheetName.toLowerCase() === 'ap' || sheetName.toLowerCase() === 'ar') && normalizedKey === 'due_date' && !isValidDate(value)){
//           value = null;
//         }

//         if (sheetName.toLowerCase() === 'lead'  && normalizedKey === 'dealstage_name') {
//           value = value.replace(/[0-9.]/g, '');
//         }

//         if (value === undefined || value === '') {
//           clean[normalizedKey] = null;
//         }else if (typeof value === 'string') {
//           clean[normalizedKey] = doNotLowercase.includes(normalizedKey)
//             ? value.trim()
//             : value.trim().toLowerCase();
//         } else {
//           clean[normalizedKey] = value;
//         }
//       }

//       return clean;
//     })
//     .filter(Boolean); 


//     const normalizedSheet = sheetName.toLowerCase().replace(/\s+/g, '_'); // Normalize sheet name

//     const excludeSheets = [
//       // 'closed_deal',
//       'lead',
//       'ar',
//       'payment',
//       'invoice',
//       'ap'
//     ];

//     if (excludeSheets.includes(normalizedSheet)) {
//       console.log(`Skipping sheet: ${sheetName}`);
//       continue;
//     }

//     const allowedColumns = sheetColumnConfig[normalizedSheet];

//     const finalRows = !allowedColumns
//       ? cleanRows
//       : cleanRows.map(row => {
//           const result = {};
//           for (const col of allowedColumns) {
//             result[col] = row[col] ?? null;
//           }
//           return result;
//         });

//     mapped[normalizedSheet] = finalRows;
//   }

//   return mapped;
// }

// module.exports = { mapSheetsData };

const sheetColumnConfig = require('../../config/sheetColumns.js');

const doNotLowercase = []; // Add fields that should preserve case

function isValidDate(value) {
  if (!value) return false;
  const parsed = Date.parse(value);
  return !isNaN(parsed) && parsed > 0;
}

function normalizeKey(key) {
  return key.toLowerCase().replace(/\s+/g, '_');
}

function parsePaymentExpenseType(value) {
  try {
    if (!value || typeof value !== 'string') return null;
    
    const jsonStrings = value.split(/(?<=})\s*(?={)/);
    if (jsonStrings.length === 0) return null;
    
    const firstObj = JSON.parse(jsonStrings[0]);
    const accountRefName = firstObj?.AccountRef?.name || null;
    
    if (!accountRefName) return { expenses_type: null };
    
    // Parse the format: "5430 direct costs:commission expense:sponsorship commissions"
    const parts = accountRefName.split(':');
    
    if (parts.length >= 3) {
      // Extract code and account type from first part (e.g., "5430 direct costs")
      const firstPart = parts[0].trim();
      const spaceIndex = firstPart.indexOf(' ');
      
      const expenses_code = spaceIndex > 0 ? firstPart.substring(0, spaceIndex) : null;
      const account_type = spaceIndex > 0 ? firstPart.substring(spaceIndex + 1) : firstPart;
      
      return {
        expenses_code: expenses_code,
        account_type: account_type,
        expenses_type: parts[1].trim(),
        expenses_detail: parts[2].trim()
      };
    } else if (parts.length === 2) {
      // Handle case with only 2 parts
      const firstPart = parts[0].trim();
      const spaceIndex = firstPart.indexOf(' ');
      
      const expenses_code = spaceIndex > 0 ? firstPart.substring(0, spaceIndex) : null;
      const account_type = spaceIndex > 0 ? firstPart.substring(spaceIndex + 1) : firstPart;
      
      return {
        expenses_code: expenses_code,
        account_type: account_type,
        expenses_type: parts[1].trim(),
        expenses_detail: null
      };
    } else {
      // Single part - treat as expenses_type
      return { expenses_type: accountRefName };
    }
    
  } catch (error) {
    console.warn('Failed to parse payment expense type:', value, error.message);
    return { expenses_type: null };
  }
}

function cleanDealStageName(value) {
  return typeof value === 'string' ? value.replace(/[0-9.]/g, '').trim() : value;
}

function processValue(sheetName, normalizedKey, value) {
  const lowerSheetName = sheetName.toLowerCase();
  
  // Handle specific field transformations
  switch (true) {
    case lowerSheetName === 'payment' && normalizedKey === 'expenses_type':
      return parsePaymentExpenseType(value);
      
    case lowerSheetName === 'lead' && normalizedKey === 'dealstage_name':
      return cleanDealStageName(value);
      
    case (lowerSheetName === 'ap' || lowerSheetName === 'ar') && normalizedKey === 'due_date':
      return isValidDate(value) ? value : null;
      
    default:
      return value;
  }
}

function cleanRowValue(normalizedKey, value) {
  if (value === undefined || value === '') {
    return null;
  }
  
  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    return doNotLowercase.includes(normalizedKey) ? trimmedValue : trimmedValue.toLowerCase();
  }
  
  return value;
}

function processRow(sheetName, row, index) {
  const clean = {};
  
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeKey(key);
    
    // Skip invalid date rows for AR/AP sheets
    if ((sheetName.toLowerCase() === 'ar' || sheetName.toLowerCase() === 'ap') &&
        normalizedKey === 'date' && 
        typeof value === 'string' &&
        !isValidDate(value)) {
      return null; // This will filter out the entire row
    }
    
    const processedValue = processValue(sheetName, normalizedKey, value);
    
    // Handle expenses_type parsing for payment sheet
    if (sheetName.toLowerCase() === 'payment' && normalizedKey === 'expenses_type' && 
        processedValue && typeof processedValue === 'object') {
      // Add all the parsed fields to the clean object
      Object.assign(clean, processedValue);
    } else {
      clean[normalizedKey] = cleanRowValue(normalizedKey, processedValue);
    }
  }
  
  return clean;
}

function filterColumns(rows, allowedColumns) {
  if (!allowedColumns) return rows;
  
  return rows.map(row => {
    const result = {};
    for (const col of allowedColumns) {
      result[col] = row[col] ?? null;
    }
    return result;
  });
}

function mapSheetsData(allSheetsData) {
  const mapped = {};
  
  // Define sheets to exclude from processing
  const excludeSheets = [
    // 'lead',
    // 'ar', 
    // 'payment',
    // 'invoice',
    // 'ap',
    // 'closed_deal' 
  ];

  for (const [sheetName, rows] of Object.entries(allSheetsData)) {
    const normalizedSheetName = normalizeKey(sheetName);
    
    // Skip excluded sheets
    if (excludeSheets.includes(normalizedSheetName)) {
      console.log(`Skipping sheet: ${sheetName}`);
      continue;
    }
    
    // Process and clean rows
    const cleanRows = rows
      .map((row, index) => processRow(sheetName, row, index))
      .filter(Boolean); // Remove null rows
    
    // Filter columns based on configuration
    const allowedColumns = sheetColumnConfig[normalizedSheetName];
    const finalRows = filterColumns(cleanRows, allowedColumns);
    
    mapped[normalizedSheetName] = finalRows;
    
    console.log(`Processed sheet: ${sheetName} (${finalRows.length} rows)`);
  }

  return mapped;
}

module.exports = { 
  mapSheetsData,
  // Export helper functions for testing
  isValidDate,
  normalizeKey,
  parsePaymentExpenseType
};