const { createCompany } = require('../services/setup/companiesServices')
const { hashPassword, comparePasswords, generateToken } = require('../services/secret/tokenServices');
const { companyModels } = require('../models/companyModels')

const create = async (req, res) => {
    try {
        const { name, email, password, app } = req.body;

        if (!name || !email || !password || !app) {
            return res.status(400).json({
                error: 'Missing required fields'
            });
        }

        const cekEmail = await companyModels.existCompany(email)
        if(cekEmail){
            return res.status(500).json({error: 'email taken'})
        }

        const hashedPassword = await hashPassword(password);
        const result = await createCompany(name, email, hashedPassword, app);

        if (result.success) {
            return res.status(201).json(result);
        } else {
            return res.status(500).json({
                error: result.message,
                details: result.error
            });
        }
    } catch (error) {
        console.error('❌ Error in createCompany controller:', error.message);
        res.status(500).json({
            error: 'Failed to create company'
        });
    }
}

module.exports = { create };