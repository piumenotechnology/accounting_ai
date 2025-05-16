const { fetchAllSheetsData } = require('../services/insert/googleSheetsService');
const { mapSheetsData } = require('../services/insert/mappingService');
const { insertMappedData } = require('../services/insert/insertService');

async function handleImport(req, res) {
  try {
    console.log('⚡ Starting Import...');

    const rawData = await fetchAllSheetsData(); // Fetch data from Google Sheets

    console.log('data 1')

    const mappedData = mapSheetsData(rawData); // Map the data to the correct format
    await insertMappedData(mappedData); // Insert the mapped data into the database

    res.json({ message: '✅ Data imported successfully!' });
  } catch (error) {
    console.error('❌ Import Error:', error.message);
    res.status(500).json({ error: 'Import failed.' });
  }
}

module.exports = { handleImport };
