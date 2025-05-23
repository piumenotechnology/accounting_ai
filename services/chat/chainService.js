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
//   invoice: 'Contains invoices issued to customers, with details ilike  invoice number, date, customer name, and billed amount.',
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
//           - Use BETWEEN or >= and < for dates (not ilike )
//           - Use ilike  '%string%' only on text columns
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


// const { openai } = require('../openaiService');
// const { runSQL } = require('../databaseService');
// const { getChatHistory, getSessionMetadata, setSessionMetadata } = require('./memoryService');

// const tableSchemas = {
//   closed_deal: 'closed_deal(dealname, amount, amount_in_home_currency, closedate, dealtype, company_name, conference_code, hs_is_closed_won (True/False))',
//   invoice: 'invoice(invoice_number, invoice_date, currency, customer_name, amount_cad)',
//   payment: 'payment(supplier_invoices, payment_date, currency, detail, amount_cad, vendor_name, amount)',
//   ap: 'ap(date, transaction_type, card, supplier, due_date, amount, open_balance, foreign_amount, foreign_open_balance, currency, exchange_rate)',
//   ar: 'ar(date, transaction_type, card, customer, due_date, amount, open_balance, foreign_amount, foreign_open_balance, curency, exchange_rate)'
// };

// const tableDescriptions = {
//   closed_deal: 'Tracks closed sales deals such as sponsorships and delegate registrations.',
//   invoice: 'Contains invoices issued to customers, with details ilike  invoice number, date, customer name, and billed amount.',
//   payment: 'Captures outgoing payments to vendors, including invoice references, vendor names, payment details, and dates.',
//   ap: 'Tracks accounts payable — amounts we owe suppliers — including due dates and foreign balances.',
//   ar: 'Tracks accounts receivable — amounts customers owe — including due dates, currencies, and outstanding balances.'
// };

// function cleanSQL(text) {
//   return text.toLowerCase().trim().replace(/```sql|```/gi, '').trim();
// }

// // NEW: Smart table selection function
// async function selectBestTable(question, chatHistory = []) {
//   const tableSelectionPrompt = [
//     {
//       role: 'system',
//       content: `
//         You are a database table selector. Analyze the user's question and select the MOST RELEVANT table.

//         Available tables:
//         ${Object.entries(tableSchemas).map(([table, schema]) => 
//           `- ${table}: ${tableDescriptions[table]}\n  Columns: ${schema}`
//         ).join('\n\n')}

//         Rules:
//         1. Choose the table that BEST matches what the user is asking about
//         2. Consider keywords in the question (deals, invoices, payments, receivables, payables)
//         3. Think about the business context
//         4. Only respond with the table name (e.g., "closed_deal")
//         5. If unsure between 2 tables, pick the more specific one

//         Examples:
//         - "How much did we sell last month?" → closed_deal
//         - "What invoices are outstanding?" → invoice  
//         - "How much do we owe suppliers?" → ap
//         - "Which customers haven't paid?" → ar
//         - "What payments did we make?" → payment
//       `.trim()
//     },
//     ...chatHistory.map(m => ({
//       role: m._getType?.() || m.role,
//       content: m.content
//     })),
//     { role: 'user', content: question }
//   ];

//   const response = await openai.invoke(tableSelectionPrompt);
//   const selectedTable = response.content.trim().toLowerCase();
  
//   // Validate the selected table exists
//   if (!tableSchemas[selectedTable]) {
//     console.warn(`⚠️ Invalid table selected: ${selectedTable}, defaulting to closed_deal`);
//     return 'closed_deal';
//   }
  
//   return selectedTable;
// }

// async function loadChain(session_id) {
//   const chatHistory = getChatHistory(session_id);

//   return async ({ input, table = null }) => {
//     const pastMessages = await chatHistory.getMessages();
    
//     // STEP 1: Smart table selection (if not provided)
//     let selectedTable = table;
//     if (!selectedTable) {
//       selectedTable = await selectBestTable(input, pastMessages);
//       console.log('🎯 Auto-selected table:', selectedTable);
//     }

//     const tableSchema = tableSchemas[selectedTable];
//     const tablePurpose = tableDescriptions[selectedTable];

//     if (!tableSchema || !tablePurpose) {
//       throw new Error(`❌ Unknown table: ${selectedTable}`);
//     }

//     const chatML = pastMessages.map(m => ({
//       role: m._getType?.() || m.role,
//       content: m.content
//     }));

//     // STEP 2: Generate SQL with better context
//     const sqlPrompt = [
//       {
//         role: 'system',
//         content: `
//           You are a PostgreSQL query generator for business data analysis.
          
//           Table: ${selectedTable}
//           Purpose: ${tablePurpose}
//           Schema: ${tableSchema}

//           Generate a SELECT query that answers the user's question.
          
//           Guidelines:
//           - Use BETWEEN or >= and < for date ranges
//           - Use ilike  '%term%' for case-insensitive text search
//           - Use appropriate aggregations (SUM, COUNT, AVG) when needed
//           - Consider GROUP BY for categorical breakdowns
//           - Use ORDER BY for meaningful sorting
//           - ONLY return raw SQL - no explanations or markdown

//           Example patterns:
//           - Revenue questions: SELECT SUM(amount) FROM...
//           - Count questions: SELECT COUNT(*) FROM...  
//           - Recent data: WHERE date >= CURRENT_DATE - INTERVAL '30 days'
//           - Breakdowns: GROUP BY category ORDER BY total DESC
//         `.trim()
//       },
//       ...chatML,
//       { role: 'user', content: input }
//     ];

//     const sqlResponse = await openai.invoke(sqlPrompt);
//     const sql = cleanSQL(sqlResponse.content);
//     console.log('⚡ Generated SQL:', sql);

//     if (!sql.startsWith('select')) {
//       return '⚠️ Only SELECT queries are supported.';
//     }

//     // STEP 3: Execute SQL
//     let result;
//     let sqlError = null;

//     try {
//       result = await runSQL(sql);
//       console.log('✅ Query executed successfully');
//     } catch (err) {
//       sqlError = err.message;
//       console.error('❌ SQL Error:', sqlError);
//     }

//     // STEP 4: Handle empty results with intelligent fallback
//     const hasData = Array.isArray(result) && result.length > 0 && 
//                    Object.values(result[0] || {}).some(val => val !== null && val !== undefined && val !== '');

//     if (!hasData && !sqlError) {
//       // Try to suggest alternative tables
//       const alternativePrompt = [
//         {
//           role: 'system',
//           content: `
//             The user asked a question, but the selected table (${selectedTable}) returned no data.
            
//             Suggest 1-2 alternative tables that might have the data they're looking for.
//             Be helpful and explain why those tables might be better.
            
//             Available alternatives:
//             ${Object.entries(tableSchemas)
//               .filter(([key]) => key !== selectedTable)
//               .map(([key, schema]) => `- ${key}: ${tableDescriptions[key]}`)
//               .join('\n')}
            
//             Keep it conversational and helpful.
//           `.trim()
//         },
//         { role: 'user', content: `Question: ${input}\nSelected table: ${selectedTable} (no results)` }
//       ];

//       const alternativeResponse = await openai.invoke(alternativePrompt);
//       const message = `I couldn't find any data in the ${selectedTable} table for that question.\n\n${alternativeResponse.content}`;
      
//       await chatHistory.addUserMessage(input);
//       await chatHistory.addAIMessage(message);
//       await setSessionMetadata(session_id, { last_table: selectedTable });
      
//       return message;
//     }

//     // STEP 5: Generate natural language summary
//     const summaryPrompt = [
//       {
//         role: 'system',
//         content: `
//           You are a helpful business data analyst. Convert SQL results into clear, actionable insights.
          
//           Guidelines:
//           - Use business language, not technical terms
//           - Include specific numbers and dates when relevant
//           - Highlight key insights or patterns
//           - Be concise but informative
//           - If there's an error, explain it simply
          
//           Context: User asked about ${tablePurpose.toLowerCase()}
//         `.trim()
//       },
//       ...chatML,
//       { role: 'user', content: input },
//       {
//         role: 'assistant', 
//         content: sqlError 
//           ? `I encountered an issue retrieving that data: ${sqlError}`
//           : `Here's what I found: ${JSON.stringify(result, null, 2)}`
//       }
//     ];

//     const summaryResponse = await openai.invoke(summaryPrompt);
//     const finalAnswer = summaryResponse.content.trim();

//     // Save to chat history
//     await chatHistory.addUserMessage(input);
//     await chatHistory.addAIMessage(finalAnswer);
//     await setSessionMetadata(session_id, { 
//       last_table: selectedTable,
//       last_sql: sql,
//       last_result_count: result?.length || 0
//     });

//     return finalAnswer;
//   };
// }

// // Helper function for manual table override
// async function queryWithTable(session_id, question, forcedTable) {
//   const chain = await loadChain(session_id);
//   return chain({ input: question, table: forcedTable });
// }

// module.exports = { loadChain, queryWithTable };

const { openai } = require('../openaiService');
const { runSQL } = require('../databaseService');
const { getChatHistory, getSessionMetadata, setSessionMetadata } = require('./memoryService');

const tableSchemas = {
  closed_deal: 'closed_deal(dealname, amount, amount_in_home_currency, closedate, dealtype, company_name, conference_code, hs_is_closed_won (True/False), hubspot_owner_name)',
  lead: 'lead(amount, amount_in_home_currency, closedate, hs_closed_amount, hs_closed_amount_in_home_currency, days_to_close, description, dealname, dealtype, notes_last_updated, notes_last_contacted, num_notes, hs_analytics_source, hs_analytics_source_data_1, hs_analytics_source_data_2, hs_sales_email_last_replied, conference_code, company_name, conference_group, conference_internal_name, deal_age, hs_is_closed_won, hubspot_owner_name, dealstage_name)',
  invoice: 'invoice(invoice_number, invoice_date, currency, customer_name, amount_cad)',
  payment: 'payment(supplier_invoices, payment_date, currency, detail, amount_cad, vendor_name, amount)',
  ap: 'ap(date, transaction_type, invoice_number, supplier, due_date, amount, open_balance, foreign_amount, foreign_open_balance, currency, exchange_rate)',
  ar: 'ar(date, transaction_type, invoice_number, customer, due_date, amount, open_balance, foreign_amount, foreign_open_balance, curency, exchange_rate)'
};


const tableDescriptions = {
  closed_deal: 'Tracks closed sales deals such as sponsorships and delegate registrations.',
  lead: 'Tracks active sales opportunities and pipeline deals that are not yet closed, including deal stages, sources, and sales activities.',
  invoice: 'Contains invoices issued to customers, with details like invoice number, date, customer name, and billed amount.',
  payment: 'Captures outgoing payments to vendors, including invoice references, vendor names, payment details, and dates.',
  ap: 'Tracks accounts payable — amounts we owe suppliers — including due dates and foreign balances.',
  ar: 'Tracks accounts receivable — amounts customers owe — including due dates, currencies, and outstanding balances.'
};

// NEW: Question intent classification
const QUESTION_INTENTS = {
  AGGREGATION: 'sum, total, count, average, how much, how many',
  COMPARISON: 'compare, vs, versus, difference, higher, lower, best, worst',
  TREND: 'trend, over time, monthly, yearly, growth, decline',
  FILTER: 'show me, list, find, where, specific',
  STATUS: 'outstanding, overdue, pending, paid, unpaid'
};

// NEW: Common business patterns
const BUSINESS_PATTERNS = {
  revenue: ['sales', 'revenue', 'income', 'earnings', 'closed deals'],
  pipeline: ['leads', 'opportunities', 'pipeline', 'prospects', 'potential', 'funnel', 'stages'],
  conversion: ['conversion', 'close rate', 'win rate', 'success rate'],
  sources: ['source', 'channel', 'marketing', 'campaign', 'referral'],
  activities: ['notes', 'emails', 'contacts', 'touched', 'activity'],
  expenses: ['payments', 'costs', 'expenses', 'spent', 'paid out'],
  customers: ['clients', 'customers', 'buyers', 'accounts'],
  suppliers: ['vendors', 'suppliers', 'providers'],
  outstanding: ['due', 'overdue', 'outstanding', 'unpaid', 'pending']
};

function cleanSQL(text) {
  return text.toLowerCase().trim().replace(/```sql|```/gi, '').trim();
}

// ENHANCED: Multi-factor table selection
async function selectBestTable(question, chatHistory = [], sessionMetadata = {}) {
  const lastTable = sessionMetadata?.last_table;
  const questionLower = question.toLowerCase();
  
  // Check for explicit table mentions
  const explicitTable = Object.keys(tableSchemas).find(table => 
    questionLower.includes(table.replace('_', ' ')) || 
    questionLower.includes(table)
  );
  
  if (explicitTable) {
    console.log('🎯 Explicit table found:', explicitTable);
    return explicitTable;
  }

  // Pattern-based pre-filtering
  const patternMatches = [];
  for (const [pattern, keywords] of Object.entries(BUSINESS_PATTERNS)) {
      if (keywords.some(keyword => questionLower.includes(keyword))) {
        switch (pattern) {
          case 'revenue': patternMatches.push('closed_deal'); break;
          case 'pipeline': patternMatches.push('lead'); break;
          case 'conversion': patternMatches.push('lead', 'closed_deal'); break;
          case 'sources': patternMatches.push('lead'); break;
          case 'activities': patternMatches.push('lead'); break;
          case 'expenses': patternMatches.push('payment'); break;
          case 'customers': patternMatches.push('ar', 'invoice'); break;
          case 'suppliers': patternMatches.push('ap', 'payment'); break;
          case 'outstanding': patternMatches.push('ar', 'ap'); break;
        }
      }
    }

  const candidateTables = patternMatches.length > 0 ? 
    [...new Set(patternMatches)] : Object.keys(tableSchemas);

  const tableSelectionPrompt = [
    {
      role: 'system',
      content: `
        You are an expert database table selector for business queries.

        Question: "${question}"
        ${lastTable ? `Last used table: ${lastTable}` : ''}

        Candidate tables (prioritized):
        ${candidateTables.map(table => 
          `- ${table}: ${tableDescriptions[table]}\n  Schema: ${tableSchemas[table]}`
        ).join('\n\n')}

        Selection Rules:
        1. Match the PRIMARY data type the user wants
        2. Consider context from previous questions
        3. For ambiguous questions, prefer the most specific table
        4. Only respond with ONE table name

        Business Logic:
        - Revenue/Sales questions → closed_deal
        - Pipeline/Lead questions → lead
        - Lead sources/activities → lead
        - Conversion rates → lead (open) vs closed_deal (won)
        - Customer payments/invoices → invoice or ar
        - Vendor payments → payment or ap  
        - Outstanding amounts → ar (customer owes us) or ap (we owe supplier)

        Respond with ONLY the table name.
      `.trim()
    },
    { role: 'user', content: question }
  ];

  const response = await openai.invoke(tableSelectionPrompt);
  const selectedTable = response.content.trim().toLowerCase();
  
  if (!tableSchemas[selectedTable]) {
    console.warn(`⚠️ Invalid table selected: ${selectedTable}, using pattern match or default`);
    return candidateTables[0] || 'closed_deal';
  }
  
  return selectedTable;
}

// NEW: SQL validation and optimization
function validateAndOptimizeSQL(sql, tableName) {
  const issues = [];
  const suggestions = [];
  
  // Check for common issues
  if (!sql.includes('limit') && !sql.includes('count') && !sql.includes('sum')) {
    suggestions.push('Consider adding LIMIT for large datasets');
  }
  
  if (sql.includes('select *')) {
    suggestions.push('Consider selecting specific columns for better performance');
  }
  
  // Check for date format issues
  if (sql.includes('date') && !sql.includes('::date') && !sql.includes("'")) {
    issues.push('Date values should be quoted');
  }
  
  return { issues, suggestions, isValid: issues.length === 0 };
}

// NEW: Result analysis and insights
function analyzeResults(results, question, tableName) {
  if (!Array.isArray(results) || results.length === 0) {
    return { isEmpty: true, insights: [] };
  }

  const insights = [];
  const firstRow = results[0];
  
  // Detect data patterns
  const numericColumns = Object.keys(firstRow).filter(key => 
    typeof firstRow[key] === 'number'
  );
  
  const dateColumns = Object.keys(firstRow).filter(key => 
    key.includes('date') || key.includes('time')
  );

  if (numericColumns.length > 0) {
    const totals = numericColumns.map(col => ({
      column: col,
      total: results.reduce((sum, row) => sum + (row[col] || 0), 0),
      avg: results.reduce((sum, row) => sum + (row[col] || 0), 0) / results.length
    }));
    insights.push({ type: 'totals', data: totals });
  }

  if (results.length > 1 && dateColumns.length > 0) {
    insights.push({ type: 'time_range', count: results.length });
  }

  return {
    isEmpty: false,
    recordCount: results.length,
    insights,
    hasNumericData: numericColumns.length > 0,
    hasDateData: dateColumns.length > 0
  };
}

// ENHANCED: Main chain with error recovery
async function loadChain(session_id) {
  const chatHistory = getChatHistory(session_id);

  return async ({ input, table = null, retryCount = 0 }) => {
    try {
      const pastMessages = await chatHistory.getMessages();
      const sessionMetadata = await getSessionMetadata(session_id) || {};
      
      // STEP 1: Enhanced table selection
      let selectedTable = table;
      if (!selectedTable) {
        selectedTable = await selectBestTable(input, pastMessages, sessionMetadata);
        console.log('🎯 Selected table:', selectedTable);
      }

      const tableSchema = tableSchemas[selectedTable];
      const tablePurpose = tableDescriptions[selectedTable];

      // STEP 2: Context-aware SQL generation
      const recentContext = pastMessages.slice(-4); // Last 2 Q&A pairs
      const sqlPrompt = [
        {
          role: 'system',
          content: `
            You are an expert PostgreSQL query generator for business analytics.
            
            Target Table: ${selectedTable}
            Purpose: ${tablePurpose}
            Schema: ${tableSchema}

            Query Guidelines:
            - Use ilike  for case-insensitive text search '%string%' use proper wildcard patterns for partial ILIKE usage example: hubspot_owner_name ilike any (array['%mitch%', '%shah%'])
            - Use proper date formatting: '2024-01-01'::date
            - Add LIMIT 100 for safety unless user wants specific count
            - Use meaningful column aliases
            - Consider GROUP BY for summaries
            - Use ORDER BY for logical sorting

            Common Patterns:
            - Revenue: SELECT SUM(amount) as total_revenue FROM...
            - Counts: SELECT COUNT(*) as record_count FROM...
            - Recent: WHERE date >= CURRENT_DATE - INTERVAL '30 days'
            - Top items: ORDER BY amount DESC LIMIT 10

            Return ONLY the SQL query - no explanations.
          `.trim()
        },
        ...recentContext.map(m => ({
          role: m._getType?.() || m.role,
          content: m.content
        })),
        { role: 'user', content: input }
      ];

      const sqlResponse = await openai.invoke(sqlPrompt);
      const sql = cleanSQL(sqlResponse.content);
      
      // STEP 3: Validate SQL
      const validation = validateAndOptimizeSQL(sql, selectedTable);
      if (!validation.isValid && retryCount === 0) {
        console.warn('⚠️ SQL validation issues:', validation.issues);
        // Could retry with corrections, but skip for now
      }

      console.log('⚡ Generated SQL:', sql);

      if (!sql.startsWith('select')) {
        return '⚠️ Only SELECT queries are supported.';
      }

      // STEP 4: Execute with timeout
      let result;
      let sqlError = null;
      const startTime = Date.now();

      try {
        result = await Promise.race([
          runSQL(sql),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), 30000)
          )
        ]);
        const executionTime = Date.now() - startTime;
        console.log('result:', result);
        console.log(`✅ Query executed in ${executionTime}ms`);
      } catch (err) {
        sqlError = err.message;
        console.error('❌ SQL Error:', sqlError);
      }

      // STEP 5: Analyze results
      const analysis = analyzeResults(result, input, selectedTable);
      
      if (analysis.isEmpty && !sqlError) {
        // Smart fallback with alternative suggestions
        const alternativePrompt = [
          {
            role: 'system',
            content: `
              No data found in ${selectedTable} table. Suggest better alternatives.
              
              Available tables:
              ${Object.entries(tableDescriptions)
                .filter(([key]) => key !== selectedTable)
                .map(([key, desc]) => `- ${key}: ${desc}`)
                .join('\n')}
              
              Be specific about why other tables might work better.
            `.trim()
          },
          { role: 'user', content: `Question: "${input}" returned no results from ${selectedTable}` }
        ];

        const altResponse = await openai.invoke(alternativePrompt);
        const message = `I couldn't find any data for that question in the ${selectedTable} table.\n\n${altResponse.content}`;
        
        await chatHistory.addUserMessage(input);
        await chatHistory.addAIMessage(message);
        await setSessionMetadata(session_id, { 
          last_table: selectedTable,
          last_query_empty: true,
          suggestion_made: true
        });
        
        return message;
      }

      // STEP 6: Generate enhanced summary with insights
      const summaryPrompt = [
        {
          role: 'system',
          content: `
            You are a business data analyst. Create clear, actionable insights from SQL results.
            
            Context:
            - Table: ${selectedTable} (${tablePurpose})
            - Question: "${input}"
            - Records found: ${analysis.recordCount || 0}
            - Has numeric data: ${analysis.hasNumericData}
            
            Guidelines:
            - Lead with the key answer to their question
            - Include specific numbers and percentages
            - Highlight patterns or notable findings  
            - Use business language, not technical terms
            - Be concise but comprehensive
            - If error occurred, explain it simply
          `.trim()
        },
        { role: 'user', content: input },
        {
          role: 'assistant',
          content: sqlError 
            ? `Query error: ${sqlError}`
            : `Analysis: ${JSON.stringify({ results: result, insights: analysis.insights })}`
        }
      ];

      // const summaryPrompt = [
      //   {
      //     role: 'system',
      //     content: `
      //       You are a business data analyst. Create clear, actionable insights from SQL results.
            
      //       Rules:
      //       - Start with the direct answer to their question
      //       - Keep it short - 2-3 sentences max
      //       - Use simple business language
      //       - Include key numbers when relevant
      //       - No technical jargon or database terms
      //       - If no data found, just say "No results found"
      //       - If error, say "Unable to retrieve data"
      //     `.trim()
      //   },
      //   { role: 'user', content: input },
      //   {
      //     role: 'assistant',
      //     content: sqlError 
      //       ? `Error retrieving data`
      //       : `Results: ${JSON.stringify(result)}`
      //   }
      // ];

      const summaryResponse = await openai.invoke(summaryPrompt);
      const finalAnswer = summaryResponse.content.trim();

      // STEP 7: Enhanced session tracking
      await chatHistory.addUserMessage(input);
      await chatHistory.addAIMessage(finalAnswer);
      await setSessionMetadata(session_id, {
        last_table: selectedTable,
        last_sql: sql,
        last_result_count: result?.length || 0,
        last_execution_time: Date.now() - startTime,
        query_success: !sqlError,
        last_updated: new Date().toISOString()
      });

      return finalAnswer;

    } catch (error) {
      console.error('❌ Chain execution error:', error);
      
      // Graceful error handling
      if (retryCount < 1) {
        console.log('🔄 Retrying...');
        return loadChain(session_id)({ input, table, retryCount: retryCount + 1 });
      }
      
      return `I apologize, but I encountered an error processing your question. Please try rephrasing it or ask something else.`;
    }
  };
}

// NEW: Batch query support
async function batchQuery(session_id, questions) {
  const chain = await loadChain(session_id);
  const results = [];
  
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    try {
      const result = await chain({ input: question });
      results.push({ question, result, success: true });
    } catch (error) {
      results.push({ question, error: error.message, success: false });
    }
  }
  
  return results;
}

// NEW: Query performance analytics
async function getQueryAnalytics(session_id) {
  const metadata = await getSessionMetadata(session_id);
  return {
    totalQueries: metadata?.query_count || 0,
    avgExecutionTime: metadata?.avg_execution_time || 0,
    lastUsedTable: metadata?.last_table,
    successRate: metadata?.success_rate || 100,
    commonTables: metadata?.table_usage || {}
  };
}

module.exports = { 
  loadChain, 
  batchQuery, 
  getQueryAnalytics,
  selectBestTable // Export for testing
};