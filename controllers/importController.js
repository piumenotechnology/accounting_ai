const { fetchAllSheetsData } = require('../services/insert/googleSheetsService');
const { mapSheetsData } = require('../services/insert/mappingService');
const { insertMappedData, insert_pl, insert_bs, insert_cash_flow } = require('../services/insert/insertService');


async function handleImport(req, res) {
  try {
    console.log('⚡ Starting Import...');

    const rawData = await fetchAllSheetsData(); // Fetch data from Google Sheets

    const mappedData = mapSheetsData(rawData); // Map the data to the correct format
    await insertMappedData(mappedData); // Insert the mapped data into the database

    res.json({ message: '✅ Data imported successfully!' });
  } catch (error) {
    console.error('❌ Import Error:', error.message);
    res.status(500).json({ error: 'Import failed.' });
  }
}

async function handleInsertBS(req, res) {
  try {
    console.log('⚡ Starting Balance Sheet Import...');
    const data = await insert_bs();
    console.log('✅ Balance Sheet data inserted successfully!');
    res.json({ message: 'Balance Sheet data inserted successfully!', data });
  } catch (error) {
    console.error('❌ Error inserting Balance Sheet data:', error.message);
    res.status(500).json({ error: 'Failed to insert Balance Sheet data.' });
  } 
}

async function handleInsertPL(req, res) {
  try {     
    console.log('⚡ Starting Profit and Loss Import...');
    const data = await insert_pl();
    console.log('✅ Profit and Loss data inserted successfully!');
    res.json({ message: 'Profit and Loss data inserted successfully!', data });
  } catch (error) {
    console.error('❌ Error inserting Profit and Loss data:', error.message);
    res.status(500).json({ error: 'Failed to insert Profit and Loss data.' });
  }   
}

async function handleInsertCashFlow(req, res) {
  try {
    console.log('⚡ Starting Cash Flow Import...');
    const data = await insert_cash_flow();
    console.log('✅ Cash Flow data inserted successfully!');
    res.json({ message: 'Cash Flow data inserted successfully!', data });
  } catch (error) {
    console.error('❌ Error inserting Cash Flow data:', error.message);
    res.status(500).json({ error: 'Failed to insert Cash Flow data.' });
  }
} 


module.exports = { handleImport, 
                   handleInsertBS, 
                   handleInsertPL, 
                   handleInsertCashFlow };
