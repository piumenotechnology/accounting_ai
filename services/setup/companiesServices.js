const { pool } = require('../../config/db')
const { tokenModel } = require('../../models/tokenModel');
const { companyModels } = require('../../models/companyModels');
const { databaseModel } = require('../../models/dbModel');

async function createCompany(name, email, password, app) {
    const client = await pool.connect();
    const dbName = `${name}_${app}_db`;
    let newCompany, token, dbDetails;

    try {
        await client.query('BEGIN');
        // Create a new company
        newCompany = await companyModels.createCompany(name, email, password, app, client);
        console.log('New company created:', newCompany);
    
        // Create a token for the new company
        const generatedToken = app + newCompany.id; // Example token generation logic
        console.log('Generated token:', generatedToken);

        token = await tokenModel.createToken(generatedToken.toLowerCase(), client);

        dbDetails = await databaseModel.insertDatabaseDetails(newCompany.id, dbName.toLowerCase());
        console.log('Database details inserted:', dbDetails);

        const updatedCompany = await companyModels.updateCompanyTokenAndDatabase(newCompany.id, token.id, dbDetails.id, client);

        await client.query('COMMIT');
        console.log('✅ Transaction committed');

        await databaseModel.createDatabase(dbName.toLowerCase());
        console.log('✅ Physical database created');

        return {
            success: true,
            message: 'Company created successfully',
            data: updatedCompany
        };
    } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Transaction rolled back:', error.message);

    return {
      success: false,
      message: 'Company creation failed',
      error: error.message
    };
    }finally {
    client.release();
  }
}

module.exports = { createCompany };