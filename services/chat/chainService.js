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
           You are a PostgreSQL query generator.
          Only respond with a raw SELECT SQL query that fits the user's question using this table:
          - ${tableSchema}

          ❗ Important:
          - Use BETWEEN or >= and < for dates (not LIKE)
          - Use LIKE '%string%' only on text columns
          - NEVER explain anything
          - NEVER summarize
          - NEVER return markdown or extra text — just SQL

          Example:
          SELECT SUM(amount) FROM closed_deal WHERE closedate >= '2025-01-01' AND closedate < '2025-02-01';
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

    // const hasData =
    //   Array.isArray(result) &&
    //   result.length > 0 &&
    //   Object.values(result[0]).some(Boolean);

    // // STEP 3: If no result, suggest better tables
    // if (!hasData && !sqlError) {
    //   const relevancePrompt = [
    //     {
    //       role: 'system',
    //       content: `
    //         You're a smart assistant. A user asked a question, but the table they used returned no data.

    //         You’ll receive:
    //         - The original table name, its purpose, and its columns
    //         - A list of other available tables, each with their name, purpose, and columns
    //         - The user’s question

    //         Your task: suggest the top 2 most relevant tables for answering the question — based on what data is actually needed.

    //         Respond clearly and helpfully. Never mention SQL, databases, or technical terms.

    //     `.trim()
    //     },
    //     {
    //       role: 'user',
    //       content: `
    //         Selected table: ${table}
    //         Purpose: ${tablePurpose}
    //         Columns: ${tableSchema.replace(`${table}(`, '').replace(/\)$/, '')}

    //         Other tables:
    //         ${Object.entries(tableSchemas)
    //           .filter(([key]) => key !== table)
    //           .map(([key, schema]) => {
    //             return `- ${key}: ${tableDescriptions[key]}\n  Columns: ${schema.replace(`${key}(`, '').replace(/\)$/, '')}`;
    //           }).join('\n\n')}

    //         User question: ${input}
    //     `.trim()
    //     }
    //   ];

    //   const fallback = await openai.invoke(relevancePrompt);
    //   const fallbackMsg = fallback.content.trim();

    //   await chatHistory.addUserMessage(input);
    //   await chatHistory.addAIMessage(fallbackMsg);
    //   await setSessionMetadata(session_id, { last_table: table });
    //   return fallbackMsg;
    // }

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


// const { openai } = require('../openaiService');
// const { runSQL } = require('../databaseService');
// const { getChatHistory, getSessionMetadata, setSessionMetadata } = require('./memoryService');

// const tableSchemas = {
//   closed_deal: 'closed_deal(dealname, amount, amount_in_home_currency, closedate, dealtype, company_name, conference_code, hs_is_closed_won)',
//   invoice: 'invoice(invoice_number, invoice_date, currency, customer_name, amount_cad)',
//   payment: 'payment(supplier_invoices, payment_date, currency, detail, amount_cad, vendor_name, amount)',
//   ap: 'ap(date, transaction_type, card, supplier, due_date, amount, open_balance, foreign_amount, foreign_open_balance, currency, exchange_rate)',
//   ar: 'ar(date, transaction_type, card, customer, due_date, amount, open_balance, foreign_amount, foreign_open_balance, curency, exchange_rate)'
// };

// const tableDescriptions = {
//   closed_deal: 'Tracks closed sales deals including sponsorships, delegate registrations, revenue, close dates, and company/conference information.',
//   invoice: 'Contains invoice records issued to customers including date, invoice number, currency, and amount.',
//   payment: 'Stores vendor payment transactions including payment date, vendor name, invoice reference, and payment details.',
//   ap: 'Accounts payable data: amounts owed to suppliers, with due dates, transaction types, currency, and balances.',
//   ar: 'Accounts receivable data: amounts customers owe, including due dates, balances, and foreign currency information.'
// };

// function cleanSQL(text) {
//   return text.trim().replace(/```sql|```/gi, '').trim();
// }

// async function loadChain(session_id) {
//   const chatHistory = getChatHistory(session_id);
//   const lastSessionMeta = await getSessionMetadata(session_id);
//   const lastTable = lastSessionMeta?.last_table;

//   return async ({ input, table }) => {
//     const tableSchema = tableSchemas[table];
//     const tablePurpose = tableDescriptions[table];

//     if (!tableSchema || !tablePurpose) {
//       throw new Error(`❌ Unknown table: ${table}`);
//     }

//     // 🧠 Include recent memory to validate follow-ups
//     // const pastMessages = await chatHistory.getMessages();
//     const pastMessages = await chatHistory.getMessages();

//     const previousUserMsg = pastMessages.reverse().find(m => m.role === 'user')?.content || '';
//     const previousBotMsg = pastMessages.find(m => m.role === 'assistant')?.content || '';

//     const recentContext = pastMessages
//       .slice(-4)
//       .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
//       .join('\n');

//     // ✅ Step 1: Validate if question belongs to the selected table
//     const validationPrompt = [
//       {
//         role: 'system',
//         content: `
//           You are a smart assistant helping verify if a user's question belongs to the correct table.

//           You will receive:
//           - A user question
//           - A selected table
//           - What the table tracks
//           - The table's columns
//           - Recent conversation context

//           Instructions:
//           ✅ If the selected table fits, return only this: ✅
//           ❌ If not, explain briefly which table fits better and why (e.g., "This is more related to the payment table because...")

//           Never suggest the same table.
//           Never explain if it's ✅.
//           Never return markdown or SQL.`.trim()
//     },
//     {
//       role: 'user',
//       content: `
//         Previous question: ${previousUserMsg}
//         Assistant reply: ${previousBotMsg}

//         Current question: ${input}

//         Selected table: ${table}
//         Table purpose: ${tablePurpose}
//         Available columns: ${tableSchema.replace(`${table}(`, '').replace(/\)$/, '')}`.trim()
//   }
// ];

//     const validationResponse = await openai.invoke(validationPrompt);
//     const validationReply = validationResponse.content.trim();
//     const lowerReply = validationReply.toLowerCase();

//     console.log('🧠 Table Relevance GPT:', validationReply);

//     const isClearlyWrong =
//       lowerReply.startsWith('this question') ||
//       lowerReply.startsWith('❌') ||
//       lowerReply.includes('a better table would be') ||
//       lowerReply.includes('is not appropriate') ||
//       lowerReply.includes('not suitable') ||
//       lowerReply.includes('does not match') ||
//       lowerReply.includes('not related to');

//     if (isClearlyWrong) {
//       await chatHistory.addUserMessage(input);
//       await chatHistory.addAIMessage(validationReply);
//       await setSessionMetadata(session_id, { last_table: table });
//       return validationReply;
//     }

//     // ✅ Step 2: Generate SQL
//     const chatML = (table === lastTable ? pastMessages : []).map(m => ({
//       role: m._getType?.() || m.role,
//       content: m.content
//     }));

//   const sqlPrompt = [
//       {
//         role: 'system',
//         content: `
//       You are a PostgreSQL query generator.

//       Only respond with a raw SELECT SQL query that fits the user's question using this table:
//       - ${tableSchema}

//       ❗ Important:
//       - Use BETWEEN or >= and < for dates (not LIKE)
//       - Use LIKE '%string%' only on text columns
//       - NEVER explain anything
//       - NEVER summarize
//       - NEVER return markdown or extra text — just SQL

//       Example:
//       SELECT SUM(amount) FROM closed_deal WHERE closedate >= '2025-01-01' AND closedate < '2025-02-01';
//       `.trim()
//             },{
//         role: 'system',
//         content: `
//       You are a PostgreSQL query generator.

//       Your ONLY job is to write one SELECT SQL statement that matches the user's question.

//       ⚠️ NEVER explain or summarize.
//       ⚠️ NEVER answer the question.
//       ⚠️ NEVER say anything outside the SQL query.

//       Output example:
//       SELECT SUM(amount) FROM ap WHERE due_date >= '2025-01-01';

//       ❌ DO NOT say "The total is..." or include natural language.
//       ❌ DO NOT use markdown, backticks, or formatting.
//       Just return the SQL code only.
//       `.trim()
//       },
//       ...chatML,
//       { role: 'user', content: input }
//     ];

//     const sqlResponse = await openai.invoke(sqlPrompt);
//     const sql = cleanSQL(sqlResponse.content);
//     console.log('⚡ SQL:', sql);

//     if (!sql.toLowerCase().startsWith('select') || sql.includes('the') || sql.includes('is')) {
//       return '⚠️ GPT returned an invalid SQL statement. Please rephrase.';
//     }

//     // ✅ Step 3: Execute SQL
//     let result;
//     let sqlError = null;

//     try {
//       result = await runSQL(sql);
//     } catch (err) {
//       console.warn('❌ SQL error:', err.message);
//       sqlError = err.message;
//     }

//     const hasData =
//       Array.isArray(result) &&
//       result.length > 0 &&
//       Object.values(result[0]).some(Boolean);

//     // ✅ Step 4: Summarize
//     const summaryPrompt = [
//       {
//         role: 'system',
//         content: `
// You are a helpful business assistant.

// ✅ If there's useful data, summarize it naturally.
// ❌ If no data is found, say: "I couldn’t find anything for that."

// Do not mention SQL or technical terms.
//         `.trim()
//       },
//       ...chatML,
//       { role: 'user', content: input },
//       {
//         role: 'user',
//         content: sqlError
//           ? 'There was an error retrieving the data.'
//           : hasData
//             ? `✅ Result: ${JSON.stringify(result)}`
//             : 'There was no matching data found.'
//       }
//     ];

//     const final = await openai.invoke(summaryPrompt);

//     await chatHistory.addUserMessage(input);
//     await chatHistory.addAIMessage(final.content);
//     await setSessionMetadata(session_id, { last_table: table });

//     return final.content.trim();
//   };
// }

// module.exports = { loadChain };
