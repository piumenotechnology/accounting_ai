// const { openai } = require('../openaiService');
// const { runSQL } = require('../databaseService');
// const { getChatHistory, getSessionMetadata, setSessionMetadata } = require('./memoryService'); // Make sure these are available

// const tableSchemas = {
//   closed_deal: 'closed_deal(dealname, amount, amount_in_home_currency, closedate, dealtype, company_name, conference_code, hs_is_closed_won (True/False))',
//   invoice: 'invoice(invoice_number, invoice_date, currency, customer_name, amount_cad)',
//   payment: 'payment(supplier_invoices, payment_date, currency, detail, amount_cad, vendor_name, amount)',
//   ap: 'ap(date, transaction_type, card, supplier, due_date, amount, open_balance, foreign_amount, foreign_open_balance, currency, exchange_rate)',
//   ar: 'ar(date, transaction_type, card, customer, due_date, amount, open_balance, foreign_amount, foreign_open_balance, curency, exchange_rate)'
// };

// const tableDescriptions = {
//   closed_deal: 'Tracks closed sales deals such as sponsorships and delegate registrations.',
//   invoice: 'Contains invoices issued to customers, with details like invoice number, date, customer name, and billed amount.',
//   payment: 'Captures outgoing payments to vendors, including invoice references, vendor names, payment details, and dates.',
//   ap: 'Tracks accounts payable — amounts we owe suppliers — including due dates and foreign balances.',
//   ar: 'Tracks accounts receivable — amounts customers owe — including due dates, currencies, and outstanding balances.'
// };

// function cleanSQL(text) {
//   return text.toLowerCase().trim().replace(/```sql|```/gi, '').trim();
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

//     // 🧠 Smart reset if table changes
//     const pastMessages = table === lastTable ? await chatHistory.getMessages() : [];

//     const chatML = pastMessages.map(m => ({
//       role: m._getType?.() || m.role,
//       content: m.content
//     }));

//     // STEP 1: Generate SQL
//     const sqlPrompt = [
//       {
//         role: 'system',
//         content: `
//           You are a PostgreSQL query generator.
//           Your ONLY job is to write one SELECT SQL statement that matches the user's question.
//           not explain or summarize.
//           Only respond with a raw SELECT SQL query that fits the user's question using this table:
//           - ${tableSchema}

//           ❗ Important:
//           - Use BETWEEN or >= and < for dates (not LIKE)
//           - Use LIKE '%string%' only on text columns
//           - NEVER explain anything
//           - NEVER summarize
//           - NEVER return markdown or extra text — just SQL

//           Example:
//           SELECT SUM(amount) FROM closed_deal WHERE closedate >= '2025-01-01' AND closedate < '2025-02-01';
//         `.trim()
//       },
//       ...chatML,
//       { role: 'user', content: input }
//     ];

//     const sqlResponse = await openai.invoke(sqlPrompt);
//     const sql = cleanSQL(sqlResponse.content);
//     console.log('⚡ SQL:', sql);

//     if (!sql.startsWith('select')) {
//       return '⚠️ Only SELECT queries are supported.';
//     }

//     // STEP 2: Run SQL
//     let result;
//     let sqlError = null;

//     try {
//       result = await runSQL(sql);
//     } catch (err) {
//       sqlError = err.message;
//     }

//     console.log('⚡ SQL Result:', result);

//     const hasData =
//       Array.isArray(result) &&
//       result.length > 0 &&
//       Object.values(result[0]).some(Boolean);

//     // STEP 3: If no result, suggest better tables
//     if (!hasData && !sqlError) {
//       const relevancePrompt = [
//         {
//           role: 'system',
//           content: `
//             You're a smart assistant. A user asked a question, but the table they used returned no data.

//             You’ll receive:
//             - The original table name, its purpose, and its columns
//             - A list of other available tables, each with their name, purpose, and columns
//             - The user’s question

//             Your task: suggest the top 2 most relevant tables for answering the question — based on what data is actually needed.

//             Respond clearly and helpfully. Never mention SQL, databases, or technical terms.

//         `.trim()
//         },
//         {
//           role: 'user',
//           content: `
//             Selected table: ${table}
//             Purpose: ${tablePurpose}
//             Columns: ${tableSchema.replace(`${table}(`, '').replace(/\)$/, '')}

//             Other tables:
//             ${Object.entries(tableSchemas)
//               .filter(([key]) => key !== table)
//               .map(([key, schema]) => {
//                 return `- ${key}: ${tableDescriptions[key]}\n  Columns: ${schema.replace(`${key}(`, '').replace(/\)$/, '')}`;
//               }).join('\n\n')}

//             User question: ${input}
//         `.trim()
//         }
//       ];

//       const fallback = await openai.invoke(relevancePrompt);
//       const fallbackMsg = fallback.content.trim();

//       await chatHistory.addUserMessage(input);
//       await chatHistory.addAIMessage(fallbackMsg);
//       await setSessionMetadata(session_id, { last_table: table });
//       return fallbackMsg;
//     }

//     // STEP 4: Natural summary of result
//     const summaryPrompt = [
//       {
//         role: 'system',
//         content: `
//           You are a friendly, clear business assistant.

//           ✅ If data exists, summarize it clearly in plain English.
//           ❌ If not, say: "I couldn’t find anything matching that."

//           Never mention SQL or database terms.
//         `.trim()
//       },
//       ...chatML,
//       { role: 'user', content: input },
//       {
//         role: 'user',
//         content: sqlError
//           ? 'Something went wrong while retrieving that.'
//           : `✅ Result: ${JSON.stringify(result)}`
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


const { openai } = require('../openaiService');
const { runSQL } = require('../databaseService');
const { getChatHistory, getSessionMetadata, setSessionMetadata } = require('./memoryService');

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

// NEW: Smart table selection function
async function selectBestTable(question, chatHistory = []) {
  const tableSelectionPrompt = [
    {
      role: 'system',
      content: `
        You are a database table selector. Analyze the user's question and select the MOST RELEVANT table.

        Available tables:
        ${Object.entries(tableSchemas).map(([table, schema]) => 
          `- ${table}: ${tableDescriptions[table]}\n  Columns: ${schema}`
        ).join('\n\n')}

        Rules:
        1. Choose the table that BEST matches what the user is asking about
        2. Consider keywords in the question (deals, invoices, payments, receivables, payables)
        3. Think about the business context
        4. Only respond with the table name (e.g., "closed_deal")
        5. If unsure between 2 tables, pick the more specific one

        Examples:
        - "How much did we sell last month?" → closed_deal
        - "What invoices are outstanding?" → invoice  
        - "How much do we owe suppliers?" → ap
        - "Which customers haven't paid?" → ar
        - "What payments did we make?" → payment
      `.trim()
    },
    ...chatHistory.map(m => ({
      role: m._getType?.() || m.role,
      content: m.content
    })),
    { role: 'user', content: question }
  ];

  const response = await openai.invoke(tableSelectionPrompt);
  const selectedTable = response.content.trim().toLowerCase();
  
  // Validate the selected table exists
  if (!tableSchemas[selectedTable]) {
    console.warn(`⚠️ Invalid table selected: ${selectedTable}, defaulting to closed_deal`);
    return 'closed_deal';
  }
  
  return selectedTable;
}

async function loadChain(session_id) {
  const chatHistory = getChatHistory(session_id);

  return async ({ input, table = null }) => {
    const pastMessages = await chatHistory.getMessages();
    
    // STEP 1: Smart table selection (if not provided)
    let selectedTable = table;
    if (!selectedTable) {
      selectedTable = await selectBestTable(input, pastMessages);
      console.log('🎯 Auto-selected table:', selectedTable);
    }

    const tableSchema = tableSchemas[selectedTable];
    const tablePurpose = tableDescriptions[selectedTable];

    if (!tableSchema || !tablePurpose) {
      throw new Error(`❌ Unknown table: ${selectedTable}`);
    }

    const chatML = pastMessages.map(m => ({
      role: m._getType?.() || m.role,
      content: m.content
    }));

    // STEP 2: Generate SQL with better context
    const sqlPrompt = [
      {
        role: 'system',
        content: `
          You are a PostgreSQL query generator for business data analysis.
          
          Table: ${selectedTable}
          Purpose: ${tablePurpose}
          Schema: ${tableSchema}

          Generate a SELECT query that answers the user's question.
          
          Guidelines:
          - Use BETWEEN or >= and < for date ranges
          - Use ILIKE '%term%' for case-insensitive text search
          - Use appropriate aggregations (SUM, COUNT, AVG) when needed
          - Consider GROUP BY for categorical breakdowns
          - Use ORDER BY for meaningful sorting
          - ONLY return raw SQL - no explanations or markdown

          Example patterns:
          - Revenue questions: SELECT SUM(amount) FROM...
          - Count questions: SELECT COUNT(*) FROM...  
          - Recent data: WHERE date >= CURRENT_DATE - INTERVAL '30 days'
          - Breakdowns: GROUP BY category ORDER BY total DESC
        `.trim()
      },
      ...chatML,
      { role: 'user', content: input }
    ];

    const sqlResponse = await openai.invoke(sqlPrompt);
    const sql = cleanSQL(sqlResponse.content);
    console.log('⚡ Generated SQL:', sql);

    if (!sql.startsWith('select')) {
      return '⚠️ Only SELECT queries are supported.';
    }

    // STEP 3: Execute SQL
    let result;
    let sqlError = null;

    try {
      result = await runSQL(sql);
      console.log('✅ Query executed successfully');
    } catch (err) {
      sqlError = err.message;
      console.error('❌ SQL Error:', sqlError);
    }

    // STEP 4: Handle empty results with intelligent fallback
    const hasData = Array.isArray(result) && result.length > 0 && 
                   Object.values(result[0] || {}).some(val => val !== null && val !== undefined && val !== '');

    if (!hasData && !sqlError) {
      // Try to suggest alternative tables
      const alternativePrompt = [
        {
          role: 'system',
          content: `
            The user asked a question, but the selected table (${selectedTable}) returned no data.
            
            Suggest 1-2 alternative tables that might have the data they're looking for.
            Be helpful and explain why those tables might be better.
            
            Available alternatives:
            ${Object.entries(tableSchemas)
              .filter(([key]) => key !== selectedTable)
              .map(([key, schema]) => `- ${key}: ${tableDescriptions[key]}`)
              .join('\n')}
            
            Keep it conversational and helpful.
          `.trim()
        },
        { role: 'user', content: `Question: ${input}\nSelected table: ${selectedTable} (no results)` }
      ];

      const alternativeResponse = await openai.invoke(alternativePrompt);
      const message = `I couldn't find any data in the ${selectedTable} table for that question.\n\n${alternativeResponse.content}`;
      
      await chatHistory.addUserMessage(input);
      await chatHistory.addAIMessage(message);
      await setSessionMetadata(session_id, { last_table: selectedTable });
      
      return message;
    }

    // STEP 5: Generate natural language summary
    const summaryPrompt = [
      {
        role: 'system',
        content: `
          You are a helpful business data analyst. Convert SQL results into clear, actionable insights.
          
          Guidelines:
          - Use business language, not technical terms
          - Include specific numbers and dates when relevant
          - Highlight key insights or patterns
          - Be concise but informative
          - If there's an error, explain it simply
          
          Context: User asked about ${tablePurpose.toLowerCase()}
        `.trim()
      },
      ...chatML,
      { role: 'user', content: input },
      {
        role: 'assistant', 
        content: sqlError 
          ? `I encountered an issue retrieving that data: ${sqlError}`
          : `Here's what I found: ${JSON.stringify(result, null, 2)}`
      }
    ];

    const summaryResponse = await openai.invoke(summaryPrompt);
    const finalAnswer = summaryResponse.content.trim();

    // Save to chat history
    await chatHistory.addUserMessage(input);
    await chatHistory.addAIMessage(finalAnswer);
    await setSessionMetadata(session_id, { 
      last_table: selectedTable,
      last_sql: sql,
      last_result_count: result?.length || 0
    });

    return finalAnswer;
  };
}

// Helper function for manual table override
async function queryWithTable(session_id, question, forcedTable) {
  const chain = await loadChain(session_id);
  return chain({ input: question, table: forcedTable });
}

module.exports = { loadChain, queryWithTable };