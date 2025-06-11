// // const { openai } = require('../openaiService');
// // const { runSQL } = require('../databaseService');
// // const { getChatHistory, getSessionMetadata, setSessionMetadata } = require('./memoryService'); // Make sure these are available

// // const tableSchemas = {
// //   closed_deal: 'closed_deal(dealname, amount, amount_in_home_currency, closedate, dealtype, company_name, conference_code, hs_is_closed_won (True/False))',
// //   invoice: 'invoice(invoice_number, invoice_date, currency, customer_name, amount_cad)',
// //   payment: 'payment(supplier_invoices, payment_date, currency, detail, amount_cad, vendor_name, amount)',
// //   ap: 'ap(date, transaction_type, card, supplier, due_date, amount, open_balance, foreign_amount, foreign_open_balance, currency, exchange_rate)',
// //   ar: 'ar(date, transaction_type, card, customer, due_date, amount, open_balance, foreign_amount, foreign_open_balance, curency, exchange_rate)'
// // };

// // const tableDescriptions = {
// //   closed_deal: 'Tracks closed sales deals such as sponsorships and delegate registrations.',
// //   invoice: 'Contains invoices issued to customers, with details ilike  invoice number, date, customer name, and billed amount.',
// //   payment: 'Captures outgoing payments to vendors, including invoice references, vendor names, payment details, and dates.',
// //   ap: 'Tracks accounts payable — amounts we owe suppliers — including due dates and foreign balances.',
// //   ar: 'Tracks accounts receivable — amounts customers owe — including due dates, currencies, and outstanding balances.'
// // };

// // function cleanSQL(text) {
// //   return text.toLowerCase().trim().replace(/```sql|```/gi, '').trim();
// // }

// // async function loadChain(session_id) {
// //   const chatHistory = getChatHistory(session_id);
// //   const lastSessionMeta = await getSessionMetadata(session_id);
// //   const lastTable = lastSessionMeta?.last_table;

// //   return async ({ input, table }) => {
// //     const tableSchema = tableSchemas[table];
// //     const tablePurpose = tableDescriptions[table];

// //     if (!tableSchema || !tablePurpose) {
// //       throw new Error(`❌ Unknown table: ${table}`);
// //     }

// //     // 🧠 Smart reset if table changes
// //     const pastMessages = table === lastTable ? await chatHistory.getMessages() : [];

// //     const chatML = pastMessages.map(m => ({
// //       role: m._getType?.() || m.role,
// //       content: m.content
// //     }));

// //     // STEP 1: Generate SQL
// //     const sqlPrompt = [
// //       {
// //         role: 'system',
// //         content: `
// //           You are a PostgreSQL query generator.
// //           Your ONLY job is to write one SELECT SQL statement that matches the user's question.
// //           not explain or summarize.
// //           Only respond with a raw SELECT SQL query that fits the user's question using this table:
// //           - ${tableSchema}

// //           ❗ Important:
// //           - Use BETWEEN or >= and < for dates (not ilike )
// //           - Use ilike  '%string%' only on text columns
// //           - NEVER explain anything
// //           - NEVER summarize
// //           - NEVER return markdown or extra text — just SQL

// //           Example:
// //           SELECT SUM(amount) FROM closed_deal WHERE closedate >= '2025-01-01' AND closedate < '2025-02-01';
// //         `.trim()
// //       },
// //       ...chatML,
// //       { role: 'user', content: input }
// //     ];

// //     const sqlResponse = await openai.invoke(sqlPrompt);
// //     const sql = cleanSQL(sqlResponse.content);
// //     console.log('⚡ SQL:', sql);

// //     if (!sql.startsWith('select')) {
// //       return '⚠️ Only SELECT queries are supported.';
// //     }

// //     // STEP 2: Run SQL
// //     let result;
// //     let sqlError = null;

// //     try {
// //       result = await runSQL(sql);
// //     } catch (err) {
// //       sqlError = err.message;
// //     }

// //     console.log('⚡ SQL Result:', result);

// //     const hasData =
// //       Array.isArray(result) &&
// //       result.length > 0 &&
// //       Object.values(result[0]).some(Boolean);

// //     // STEP 3: If no result, suggest better tables
// //     if (!hasData && !sqlError) {
// //       const relevancePrompt = [
// //         {
// //           role: 'system',
// //           content: `
// //             You're a smart assistant. A user asked a question, but the table they used returned no data.

// //             You’ll receive:
// //             - The original table name, its purpose, and its columns
// //             - A list of other available tables, each with their name, purpose, and columns
// //             - The user’s question

// //             Your task: suggest the top 2 most relevant tables for answering the question — based on what data is actually needed.

// //             Respond clearly and helpfully. Never mention SQL, databases, or technical terms.

// //         `.trim()
// //         },
// //         {
// //           role: 'user',
// //           content: `
// //             Selected table: ${table}
// //             Purpose: ${tablePurpose}
// //             Columns: ${tableSchema.replace(`${table}(`, '').replace(/\)$/, '')}

// //             Other tables:
// //             ${Object.entries(tableSchemas)
// //               .filter(([key]) => key !== table)
// //               .map(([key, schema]) => {
// //                 return `- ${key}: ${tableDescriptions[key]}\n  Columns: ${schema.replace(`${key}(`, '').replace(/\)$/, '')}`;
// //               }).join('\n\n')}

// //             User question: ${input}
// //         `.trim()
// //         }
// //       ];

// //       const fallback = await openai.invoke(relevancePrompt);
// //       const fallbackMsg = fallback.content.trim();

// //       await chatHistory.addUserMessage(input);
// //       await chatHistory.addAIMessage(fallbackMsg);
// //       await setSessionMetadata(session_id, { last_table: table });
// //       return fallbackMsg;
// //     }

// //     // STEP 4: Natural summary of result
// //     const summaryPrompt = [
// //       {
// //         role: 'system',
// //         content: `
// //           You are a friendly, clear business assistant.

// //           ✅ If data exists, summarize it clearly in plain English.
// //           ❌ If not, say: "I couldn’t find anything matching that."

// //           Never mention SQL or database terms.
// //         `.trim()
// //       },
// //       ...chatML,
// //       { role: 'user', content: input },
// //       {
// //         role: 'user',
// //         content: sqlError
// //           ? 'Something went wrong while retrieving that.'
// //           : `✅ Result: ${JSON.stringify(result)}`
// //       }
// //     ];

// //     const final = await openai.invoke(summaryPrompt);

// //     await chatHistory.addUserMessage(input);
// //     await chatHistory.addAIMessage(final.content);
// //     await setSessionMetadata(session_id, { last_table: table });

// //     return final.content.trim();
// //   };
// // }

// // module.exports = { loadChain };


// // const { openai } = require('../openaiService');
// // const { runSQL } = require('../databaseService');
// // const { getChatHistory, getSessionMetadata, setSessionMetadata } = require('./memoryService');

// // const tableSchemas = {
// //   closed_deal: 'closed_deal(dealname, amount, amount_in_home_currency, closedate, dealtype, company_name, conference_code, hs_is_closed_won (True/False))',
// //   invoice: 'invoice(invoice_number, invoice_date, currency, customer_name, amount_cad)',
// //   payment: 'payment(supplier_invoices, payment_date, currency, detail, amount_cad, vendor_name, amount)',
// //   ap: 'ap(date, transaction_type, card, supplier, due_date, amount, open_balance, foreign_amount, foreign_open_balance, currency, exchange_rate)',
// //   ar: 'ar(date, transaction_type, card, customer, due_date, amount, open_balance, foreign_amount, foreign_open_balance, curency, exchange_rate)'
// // };

// // const tableDescriptions = {
// //   closed_deal: 'Tracks closed sales deals such as sponsorships and delegate registrations.',
// //   invoice: 'Contains invoices issued to customers, with details ilike  invoice number, date, customer name, and billed amount.',
// //   payment: 'Captures outgoing payments to vendors, including invoice references, vendor names, payment details, and dates.',
// //   ap: 'Tracks accounts payable — amounts we owe suppliers — including due dates and foreign balances.',
// //   ar: 'Tracks accounts receivable — amounts customers owe — including due dates, currencies, and outstanding balances.'
// // };

// // function cleanSQL(text) {
// //   return text.toLowerCase().trim().replace(/```sql|```/gi, '').trim();
// // }

// // // NEW: Smart table selection function
// // async function selectBestTable(question, chatHistory = []) {
// //   const tableSelectionPrompt = [
// //     {
// //       role: 'system',
// //       content: `
// //         You are a database table selector. Analyze the user's question and select the MOST RELEVANT table.

// //         Available tables:
// //         ${Object.entries(tableSchemas).map(([table, schema]) => 
// //           `- ${table}: ${tableDescriptions[table]}\n  Columns: ${schema}`
// //         ).join('\n\n')}

// //         Rules:
// //         1. Choose the table that BEST matches what the user is asking about
// //         2. Consider keywords in the question (deals, invoices, payments, receivables, payables)
// //         3. Think about the business context
// //         4. Only respond with the table name (e.g., "closed_deal")
// //         5. If unsure between 2 tables, pick the more specific one

// //         Examples:
// //         - "How much did we sell last month?" → closed_deal
// //         - "What invoices are outstanding?" → invoice  
// //         - "How much do we owe suppliers?" → ap
// //         - "Which customers haven't paid?" → ar
// //         - "What payments did we make?" → payment
// //       `.trim()
// //     },
// //     ...chatHistory.map(m => ({
// //       role: m._getType?.() || m.role,
// //       content: m.content
// //     })),
// //     { role: 'user', content: question }
// //   ];

// //   const response = await openai.invoke(tableSelectionPrompt);
// //   const selectedTable = response.content.trim().toLowerCase();
  
// //   // Validate the selected table exists
// //   if (!tableSchemas[selectedTable]) {
// //     console.warn(`⚠️ Invalid table selected: ${selectedTable}, defaulting to closed_deal`);
// //     return 'closed_deal';
// //   }
  
// //   return selectedTable;
// // }

// // async function loadChain(session_id) {
// //   const chatHistory = getChatHistory(session_id);

// //   return async ({ input, table = null }) => {
// //     const pastMessages = await chatHistory.getMessages();
    
// //     // STEP 1: Smart table selection (if not provided)
// //     let selectedTable = table;
// //     if (!selectedTable) {
// //       selectedTable = await selectBestTable(input, pastMessages);
// //       console.log('🎯 Auto-selected table:', selectedTable);
// //     }

// //     const tableSchema = tableSchemas[selectedTable];
// //     const tablePurpose = tableDescriptions[selectedTable];

// //     if (!tableSchema || !tablePurpose) {
// //       throw new Error(`❌ Unknown table: ${selectedTable}`);
// //     }

// //     const chatML = pastMessages.map(m => ({
// //       role: m._getType?.() || m.role,
// //       content: m.content
// //     }));

// //     // STEP 2: Generate SQL with better context
// //     const sqlPrompt = [
// //       {
// //         role: 'system',
// //         content: `
// //           You are a PostgreSQL query generator for business data analysis.
          
// //           Table: ${selectedTable}
// //           Purpose: ${tablePurpose}
// //           Schema: ${tableSchema}

// //           Generate a SELECT query that answers the user's question.
          
// //           Guidelines:
// //           - Use BETWEEN or >= and < for date ranges
// //           - Use ilike  '%term%' for case-insensitive text search
// //           - Use appropriate aggregations (SUM, COUNT, AVG) when needed
// //           - Consider GROUP BY for categorical breakdowns
// //           - Use ORDER BY for meaningful sorting
// //           - ONLY return raw SQL - no explanations or markdown

// //           Example patterns:
// //           - Revenue questions: SELECT SUM(amount) FROM...
// //           - Count questions: SELECT COUNT(*) FROM...  
// //           - Recent data: WHERE date >= CURRENT_DATE - INTERVAL '30 days'
// //           - Breakdowns: GROUP BY category ORDER BY total DESC
// //         `.trim()
// //       },
// //       ...chatML,
// //       { role: 'user', content: input }
// //     ];

// //     const sqlResponse = await openai.invoke(sqlPrompt);
// //     const sql = cleanSQL(sqlResponse.content);
// //     console.log('⚡ Generated SQL:', sql);

// //     if (!sql.startsWith('select')) {
// //       return '⚠️ Only SELECT queries are supported.';
// //     }

// //     // STEP 3: Execute SQL
// //     let result;
// //     let sqlError = null;

// //     try {
// //       result = await runSQL(sql);
// //       console.log('✅ Query executed successfully');
// //     } catch (err) {
// //       sqlError = err.message;
// //       console.error('❌ SQL Error:', sqlError);
// //     }

// //     // STEP 4: Handle empty results with intelligent fallback
// //     const hasData = Array.isArray(result) && result.length > 0 && 
// //                    Object.values(result[0] || {}).some(val => val !== null && val !== undefined && val !== '');

// //     if (!hasData && !sqlError) {
// //       // Try to suggest alternative tables
// //       const alternativePrompt = [
// //         {
// //           role: 'system',
// //           content: `
// //             The user asked a question, but the selected table (${selectedTable}) returned no data.
            
// //             Suggest 1-2 alternative tables that might have the data they're looking for.
// //             Be helpful and explain why those tables might be better.
            
// //             Available alternatives:
// //             ${Object.entries(tableSchemas)
// //               .filter(([key]) => key !== selectedTable)
// //               .map(([key, schema]) => `- ${key}: ${tableDescriptions[key]}`)
// //               .join('\n')}
            
// //             Keep it conversational and helpful.
// //           `.trim()
// //         },
// //         { role: 'user', content: `Question: ${input}\nSelected table: ${selectedTable} (no results)` }
// //       ];

// //       const alternativeResponse = await openai.invoke(alternativePrompt);
// //       const message = `I couldn't find any data in the ${selectedTable} table for that question.\n\n${alternativeResponse.content}`;
      
// //       await chatHistory.addUserMessage(input);
// //       await chatHistory.addAIMessage(message);
// //       await setSessionMetadata(session_id, { last_table: selectedTable });
      
// //       return message;
// //     }

// //     // STEP 5: Generate natural language summary
// //     const summaryPrompt = [
// //       {
// //         role: 'system',
// //         content: `
// //           You are a helpful business data analyst. Convert SQL results into clear, actionable insights.
          
// //           Guidelines:
// //           - Use business language, not technical terms
// //           - Include specific numbers and dates when relevant
// //           - Highlight key insights or patterns
// //           - Be concise but informative
// //           - If there's an error, explain it simply
          
// //           Context: User asked about ${tablePurpose.toLowerCase()}
// //         `.trim()
// //       },
// //       ...chatML,
// //       { role: 'user', content: input },
// //       {
// //         role: 'assistant', 
// //         content: sqlError 
// //           ? `I encountered an issue retrieving that data: ${sqlError}`
// //           : `Here's what I found: ${JSON.stringify(result, null, 2)}`
// //       }
// //     ];

// //     const summaryResponse = await openai.invoke(summaryPrompt);
// //     const finalAnswer = summaryResponse.content.trim();

// //     // Save to chat history
// //     await chatHistory.addUserMessage(input);
// //     await chatHistory.addAIMessage(finalAnswer);
// //     await setSessionMetadata(session_id, { 
// //       last_table: selectedTable,
// //       last_sql: sql,
// //       last_result_count: result?.length || 0
// //     });

// //     return finalAnswer;
// //   };
// // }

// // // Helper function for manual table override
// // async function queryWithTable(session_id, question, forcedTable) {
// //   const chain = await loadChain(session_id);
// //   return chain({ input: question, table: forcedTable });
// // }

// // module.exports = { loadChain, queryWithTable };



// // ENHANCED: Table Selection Prompt (keeping your original structure)
// async function selectBestTable(question, chatHistory = [], sessionMetadata = {}) {
//   const lastTable = sessionMetadata?.last_table;
//   const questionLower = question.toLowerCase();
  
//   // Check for explicit table mentions
//   const explicitTable = Object.keys(tableSchemas).find(table => 
//     questionLower.includes(table.replace('_', ' ')) || 
//     questionLower.includes(table)
//   );
  
//   if (explicitTable) {
//     console.log('🎯 Explicit table found:', explicitTable);
//     return explicitTable;
//   }

//   // Pattern-based pre-filtering (your existing logic)
//   const patternMatches = [];
//   for (const [pattern, keywords] of Object.entries(BUSINESS_PATTERNS)) {
//       if (keywords.some(keyword => questionLower.includes(keyword))) {
//         switch (pattern) {
//           case 'revenue': patternMatches.push('closed_deal'); break;
//           case 'pipeline': patternMatches.push('lead'); break;
//           case 'conversion': patternMatches.push('lead', 'closed_deal'); break;
//           case 'sources': patternMatches.push('lead'); break;
//           case 'activities': patternMatches.push('lead'); break;
//           case 'expenses': patternMatches.push('payment'); break;
//           case 'customers': patternMatches.push('ar', 'invoice'); break;
//           case 'suppliers': patternMatches.push('ap', 'payment'); break;
//           case 'outstanding': patternMatches.push('ar', 'ap'); break;
//         }
//       }
//     }

//   const candidateTables = patternMatches.length > 0 ? 
//     [...new Set(patternMatches)] : Object.keys(tableSchemas);

//   // IMPROVED: Your original prompt structure with better guidance
//   const tableSelectionPrompt = [
//     {
//       role: 'system',
//       content: `
//         You are an expert database table selector for business queries.

//         Question: "${question}"
//         ${lastTable ? `Last used table: ${lastTable}` : ''}

//         Candidate tables (prioritized):
//         ${candidateTables.map(table => 
//           `- ${table}: ${tableDescriptions[table]}\n  Schema: ${tableSchemas[table]}`
//         ).join('\n\n')}

//         Selection Rules:
//         1. Match the PRIMARY data type the user wants
//         2. Consider context from previous questions
//         3. For ambiguous questions, prefer the most specific table
//         4. Only respond with ONE table name

//         Business Logic:
//         - Revenue/Sales questions → closed_deal
//         - Pipeline/Lead questions → lead
//         - Lead sources/activities → lead
//         - Conversion rates → lead (open) vs closed_deal (won)
//         - Customer payments/invoices → invoice or ar
//         - Vendor payments → payment or ap  
//         - Outstanding amounts → ar (customer owes us) or ap (we owe supplier)

//         Respond with ONLY the table name.
//       `.trim()
//     },
//     { role: 'user', content: question }
//   ];

//   const response = await openai.invoke(tableSelectionPrompt);
//   const selectedTable = response.content.trim().toLowerCase();
  
//   if (!tableSchemas[selectedTable]) {
//     console.warn(`⚠️ Invalid table selected: ${selectedTable}, using pattern match or default`);
//     return candidateTables[0] || 'closed_deal';
//   }
  
//   return selectedTable;
// }

// // ENHANCED: SQL Generation with Column Disambiguation
// const sqlPrompt = [
//   {
//     role: 'system',
//     content: `
//       You are an expert PostgreSQL query generator for business analytics.
      
//       Target Table: ${selectedTable}
//       Purpose: ${tablePurpose}
//       Schema: ${tableSchema}

//       CRITICAL - COLUMN DISAMBIGUATION RULES:
//       When user mentions companies, deals, conferences, or people, choose the RIGHT column:

//       FOR COMPANY/CLIENT SEARCHES:
//       - "Acme Corp", "Microsoft", "company name" → Use dealname (NOT company_name)
//       - dealname contains the actual business/client name
//       - company_name is often internal/different

//       FOR CONFERENCE SEARCHES:
//       - "conference code", "event code", "ABC123" → Use conference_internal_name
//       - Any code-like pattern (letters+numbers) → conference_internal_name

//       FOR SALES REP SEARCHES:  
//       - "John Smith", "sales rep", "owner" → Use hubspot_owner_name
//       - Person names always go to hubspot_owner_name

//       SEARCH PATTERNS:
//       - Use ILIKE '%string%' for case-insensitive partial matching
//       - For multiple options: dealname ILIKE ANY (ARRAY['%acme%', '%microsoft%'])
//       - Always use % wildcards for partial matches

//       EXAMPLES:
//       - "Show me Acme deals" → WHERE dealname ILIKE '%acme%'
//       - "Conference ABC123" → WHERE conference_internal_name ILIKE '%abc123%'  
//       - "John's deals" → WHERE hubspot_owner_name ILIKE '%john%'
//       - "Microsoft revenue" → WHERE dealname ILIKE '%microsoft%'

//       OTHER GUIDELINES:
//       - Use proper date formatting: '2024-01-01'::date
//       - Add LIMIT 100 for safety unless user wants specific count
//       - Use meaningful column aliases
//       - Consider GROUP BY for summaries
//       - Use ORDER BY for logical sorting

//       Common Patterns:
//       - Revenue: SELECT SUM(amount) as total_revenue FROM...
//       - Counts: SELECT COUNT(*) as record_count FROM...
//       - Recent: WHERE date >= CURRENT_DATE - INTERVAL '30 days'
//       - Top items: ORDER BY amount DESC LIMIT 10

//       Return ONLY the SQL query - no explanations.
//     `.trim()
//   },
//   ...recentContext.map(m => ({
//     role: m._getType?.() || m.role,
//     content: m.content
//   })),
//   { role: 'user', content: input }
// ];

// // ENHANCED: Business Summary with Column Context
// const summaryPrompt = [
//   {
//     role: 'system',
//     content: `
//       You are a business data analyst. Create clear, actionable insights from SQL results.
      
//       Context:
//       - Table: ${selectedTable} (${tablePurpose})
//       - Question: "${input}"
//       - Records found: ${analysis.recordCount || 0}
//       - Has numeric data: ${analysis.hasNumericData}
      
//       IMPORTANT - COLUMN UNDERSTANDING:
//       When explaining results, use business-friendly terms:
//       - dealname = "company/client name" (not "deal name")
//       - conference_internal_name = "conference/event code"
//       - hubspot_owner_name = "sales rep" or "account owner"
//       - amount/amount_in_home_currency = "revenue" or "deal value"
      
//       Guidelines:
//       - Lead with the key answer to their question
//       - Include specific numbers and percentages
//       - Highlight patterns or notable findings  
//       - Use business language, not technical terms
//       - Be concise but comprehensive
//       - If error occurred, explain it simply
      
//       EXAMPLES:
//       Good: "Found 3 deals from Microsoft totaling $150K, with Sarah as the account owner"
//       Bad: "Found 3 records where dealname matched Microsoft with hubspot_owner_name Sarah"
//     `.trim()
//   },
//   { role: 'user', content: input },
//   {
//     role: 'assistant',
//     content: sqlError 
//       ? `Query error: ${sqlError}`
//       : `Analysis: ${JSON.stringify({ results: result, insights: analysis.insights })}`
//   }
// ];

// // ENHANCED: Alternative Suggestion with Column Clarity
// const alternativePrompt = [
//   {
//     role: 'system',
//     content: `
//       No data found in ${selectedTable} table. Suggest better alternatives with SPECIFIC examples.
      
//       Available tables:
//       ${Object.entries(tableDescriptions)
//         .filter(([key]) => key !== selectedTable)
//         .map(([key, desc]) => `- ${key}: ${desc}`)
//         .join('\n')}
      
//       PROVIDE SPECIFIC HELP:
//       1. Suggest exact search terms they could try
//       2. Recommend different tables if relevant  
//       3. Give 2-3 concrete alternative questions
      
//       COLUMN GUIDANCE FOR SUGGESTIONS:
//       - For company searches: "Try the exact company name as it appears in deals"
//       - For conference searches: "Try the conference code (like ABC123)"
//       - For people searches: "Try the sales rep's full name"
      
//       EXAMPLE RESPONSE:
//       "No results found. Try these alternatives:
//       • 'Microsoft deals' (using exact company name)
//       • 'Conference DEF456' (using specific conference code)  
//       • 'Show me all active leads' (broader search)"
      
//       Be specific about what to search for, not just which table to use.
//     `.trim()
//   },
//   { role: 'user', content: `Question: "${input}" returned no results from ${selectedTable}` }
// ];

// // ADD: Column Disambiguation Helper Function
// function getColumnGuidance(question, selectedTable) {
//   const questionLower = question.toLowerCase();
//   const guidance = [];
  
//   if (['lead', 'closed_deal'].includes(selectedTable)) {
//     // Check what user is looking for
//     if (questionLower.includes('company') || questionLower.includes('client') || 
//         /\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(question)) { // Company-like patterns
//       guidance.push("Use dealname for company/client names");
//     }
    
//     if (questionLower.includes('conference') || questionLower.includes('event') ||
//         /\b[A-Z]{2,}\d+\b/.test(question)) { // Code-like patterns
//       guidance.push("Use conference_internal_name for conference codes");
//     }
    
//     if (questionLower.includes('rep') || questionLower.includes('owner') ||
//         questionLower.includes('sales')) {
//       guidance.push("Use hubspot_owner_name for sales reps");
//     }
//   }
  
//   return guidance;
// }

// // USAGE: Add this guidance to your SQL prompt
// const columnGuidance = getColumnGuidance(input, selectedTable);
// if (columnGuidance.length > 0) {
//   sqlPrompt[0].content += `\n\nSPECIFIC GUIDANCE FOR THIS QUERY:\n${columnGuidance.join('\n')}`;
// }


public async Task SendPostRequestAsync()
{
    // Create the HttpClient
    using (var client = new HttpClient())
    {
        // Define the data to send
        var requestData = new
        {
            name = "John Doe",
            age = 30
        };

        // Serialize the data to JSON
        var json = JsonConvert.SerializeObject(requestData);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        // Send the POST request
        var response = await client.PostAsync("https://your-api-url.com/api/endpoint", content);

        // Read the response
        if (response.IsSuccessStatusCode)
        {
            string result = await response.Content.ReadAsStringAsync();
            Console.WriteLine("Success: " + result);
        }
        else
        {
            Console.WriteLine("Error: " + response.StatusCode);
        }
    }
}


var Cht = new ChatModel
 {
     session_id = _session_id.Text,
     table = _table.Text,
      message = _message.Text
 };
 var httpClient = new HttpClient();
 string Json = JsonConvert.SerializeObject(Cht);
 HttpContent httpContent = new StringContent(Json);
 httpContent.Headers.ContentType = new MediaTypeHeaderValue("application/Json");
 httpClient.PutAsync(string.Format("https://accountingai-production.up.railway.app/chat?/{0}", Id), httpContent);
 DisplayAlert("Added", "Your Data has been Update", "OK");