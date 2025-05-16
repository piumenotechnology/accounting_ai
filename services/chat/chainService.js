const { openai } = require('../openaiService');
const { runSQL } = require('../databaseService');
const { getChatHistory, getSessionMetadata, setSessionMetadata } = require('./memoryService'); // Make sure these are available

const tableSchemas = {
  closed_deal: 'closed_deal(dealname, amount, amount_in_home_currency, closedate, dealtype, company_name, conference_code, hs_is_closed_won (True/False))',
  invoice: 'invoice(invoice_number, invoice_date, currency, customer_name, amount_cad)',
  payment: 'payment(supplier_invoices, payment_date, currency, detail, amount_cad, vendor_name, amount)',
  ap: 'ap(date, transaction_type, card, supplier, due_date, amount, open_balance, foreign_amount, foreign_open_balance, currency, exchange_rate)',
  ar: 'ar(date, transaction_type, card, customer, due_date, amount, open_balance, foreign_amount, foreign_open_balance, curency, exchange_rate)'
};

const tableDescriptions = {
  closed_deal: 'Tracks closed sales deals such as sponsorships and delegate registrations.',
  invoice: 'Contains invoices issued to customers, with details like invoice number, date, customer name, and billed amount.',
  payment: 'Captures outgoing payments to vendors, including invoice references, vendor names, payment details, and dates.',
  ap: 'Tracks accounts payable — amounts we owe suppliers — including due dates and foreign balances.',
  ar: 'Tracks accounts receivable — amounts customers owe — including due dates, currencies, and outstanding balances.'
};

function cleanSQL(text) {
  return text.toLowerCase().trim().replace(/```sql|```/gi, '').trim();
}

async function loadChain(session_id) {
  const chatHistory = getChatHistory(session_id);
  const lastSessionMeta = await getSessionMetadata(session_id);
  const lastTable = lastSessionMeta?.last_table;

  return async ({ input, table }) => {
    const tableSchema = tableSchemas[table];
    const tablePurpose = tableDescriptions[table];

    if (!tableSchema || !tablePurpose) {
      throw new Error(`❌ Unknown table: ${table}`);
    }

    // 🧠 Smart reset if table changes
    const pastMessages = table === lastTable ? await chatHistory.getMessages() : [];

    const chatML = pastMessages.map(m => ({
      role: m._getType?.() || m.role,
      content: m.content
    }));

    // STEP 1: Generate SQL
    const sqlPrompt = [
      {
        role: 'system',
        content: `
          You are a PostgreSQL assistant. Use only SELECT queries.
          Only reference this table:
          - ${tableSchema}

          Use LIKE "%value%" for text but not in date type. Do not explain. Return raw SQL only.
        `.trim()
      },
      ...chatML,
      { role: 'user', content: input }
    ];

    const sqlResponse = await openai.invoke(sqlPrompt);
    const sql = cleanSQL(sqlResponse.content);
    console.log('⚡ SQL:', sql);

    if (!sql.startsWith('select')) {
      return '⚠️ Only SELECT queries are supported.';
    }

    // STEP 2: Run SQL
    let result;
    let sqlError = null;

    try {
      result = await runSQL(sql);
    } catch (err) {
      sqlError = err.message;
    }

    console.log('⚡ SQL Result:', result);

    const hasData =
      Array.isArray(result) &&
      result.length > 0 &&
      Object.values(result[0]).some(Boolean);

    // STEP 3: If no result, suggest better tables
    if (!hasData && !sqlError) {
      const relevancePrompt = [
        {
          role: 'system',
          content: `
            You're a smart assistant. A user asked a question, but the table they used returned no data.

            You’ll receive:
            - The original table name, its purpose, and its columns
            - A list of other available tables, each with their name, purpose, and columns
            - The user’s question

            Your task: suggest the top 2 most relevant tables for answering the question — based on what data is actually needed.

            Respond clearly and helpfully. Never mention SQL, databases, or technical terms.

        `.trim()
        },
        {
          role: 'user',
          content: `
            Selected table: ${table}
            Purpose: ${tablePurpose}
            Columns: ${tableSchema.replace(`${table}(`, '').replace(/\)$/, '')}

            Other tables:
            ${Object.entries(tableSchemas)
              .filter(([key]) => key !== table)
              .map(([key, schema]) => {
                return `- ${key}: ${tableDescriptions[key]}\n  Columns: ${schema.replace(`${key}(`, '').replace(/\)$/, '')}`;
              }).join('\n\n')}

            User question: ${input}
        `.trim()
        }
      ];

      const fallback = await openai.invoke(relevancePrompt);
      const fallbackMsg = fallback.content.trim();

      await chatHistory.addUserMessage(input);
      await chatHistory.addAIMessage(fallbackMsg);
      await setSessionMetadata(session_id, { last_table: table });
      return fallbackMsg;
    }

    // STEP 4: Natural summary of result
    const summaryPrompt = [
      {
        role: 'system',
        content: `
          You are a friendly, clear business assistant.

          ✅ If data exists, summarize it clearly in plain English.
          ❌ If not, say: "I couldn’t find anything matching that."

          Never mention SQL or database terms.
        `.trim()
      },
      ...chatML,
      { role: 'user', content: input },
      {
        role: 'user',
        content: sqlError
          ? 'Something went wrong while retrieving that.'
          : `✅ Result: ${JSON.stringify(result)}`
      }
    ];

    const final = await openai.invoke(summaryPrompt);

    await chatHistory.addUserMessage(input);
    await chatHistory.addAIMessage(final.content);
    await setSessionMetadata(session_id, { last_table: table });

    return final.content.trim();
  };
}

module.exports = { loadChain };
