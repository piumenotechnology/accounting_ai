const { openai } = require('../openaiService');
const { runSQL } = require('../databaseService');
const { getChatHistory, getSessionMetadata, setSessionMetadata } = require('./memoryService');

const tableSchemas = {
  closed_deal: 'closed_deal(amount, amount_in_home_currency, closedate, hs_closed_amount, dealname, dealtype, initial_traffic_source,	traffic_source_detail_or_entry_point, company_name, conference_internal_name, hs_is_closed_won, hubspot_owner_name)', //conference_code,
  lead: 'lead(amount, amount_in_home_currency, hs_closed_amount, hs_closed_amount_in_home_currency, createdate, days_to_close, conference_internal_name,  dealname, dealtype, notes_last_updated, notes_last_contacted, num_notes, initial_traffic_source, traffic_source_detail_or_entry_point, hs_sales_email_last_replied, company_name, conference_group, hs_is_closed_won, hubspot_owner_name, dealstage_name)', //closedate, conference_code
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
        //     You are an expert PostgreSQL query generator for business analytics.
            
        //     Target Table: ${selectedTable}
        //     Purpose: ${tablePurpose}
        //     Schema: ${tableSchema}

        //     CRITICAL - COLUMN DISAMBIGUATION RULES:
        //     When user mentions companies, deals, conferences, code,  or people, choose the RIGHT column:

        //     FOR COMPANY/CLIENT SEARCHES:
        //     - "Acme Corp", "Microsoft", "company name" → Use dealname (NOT company_name)
        //     - dealname contains the actual business/client name
        //     - company_name is often internal/different

        //     FOR CONFERENCE SEARCHES:
        //     - "conference code", "event code", "ABC123" → Use conference_internal_name
        //     - Any code-like pattern (letters+numbers) → conference_internal_name

        //     FOR SALES REP SEARCHES:  
        //     - "John Smith", "sales rep", "owner" → Use hubspot_owner_name
        //     - Person names always go to hubspot_owner_name

        //     SEARCH PATTERNS:
        //     - Use ILIKE '%string%' for case-insensitive partial matching
        //     - For multiple options: dealname ILIKE ANY (ARRAY['%acme%', '%microsoft%'])
        //     - Always use % wildcards for partial matches

        //     EXAMPLES:
        //     - "Show me Acme deals" → WHERE dealname ILIKE '%acme%'
        //     - "Conference ABC123" → WHERE conference_internal_name ILIKE '%abc123%'  
        //     - "John's deals" → WHERE hubspot_owner_name ILIKE '%john%'
        //     - "Microsoft revenue" → WHERE dealname ILIKE '%microsoft%'

        //     OTHER GUIDELINES:
        //     - Use proper date formatting: '2024-01-01'::date
        //     - Add LIMIT 100 for safety unless user wants specific count
        //     - Use meaningful column aliases
        //     - Consider GROUP BY for summaries
        //     - Use ORDER BY for logical sorting

        //     Common Patterns:
        //     - Revenue: SELECT SUM(amount) as total_revenue FROM...
        //     - Counts: SELECT COUNT(*) as record_count FROM...
        //     - Recent: WHERE date >= CURRENT_DATE - INTERVAL '30 days'
        //     - Top items: ORDER BY amount DESC LIMIT 10

        //     Return ONLY the SQL query - no explanations.
        //   `.trim()
        },
        // content: `
        //     You are an expert PostgreSQL query generator for business analytics.

        //     Target Table: ${selectedTable}
        //     Purpose: ${tablePurpose}
        //     Schema: ${tableSchema}

        //     === INTELLIGENT COLUMN MAPPING ===

        //     Dynamically determine which column to filter based on both:
        //     1. The SELECTED TABLE
        //     2. The TYPE of input: human-readable string vs code-like pattern (e.g., invoice number, event code)

        //     RULES FOR IDENTIFYING CODES:
        //     - Codes typically have alphanumeric or numeric structure (e.g., ABC123, INV-2024-001, 87934)
        //     - Codes go to *_code, *number, or *id columns
        //     - String names (people, vendors, companies) are matched to *_name, *_owner, or *_customer columns

        //     TABLE-SPECIFIC MATCHING:

        //     1. **closed_deal** or **lead**
        //       - String input → match against: dealname, hubspot_owner_name, company_name
        //       - Code input (e.g., "ABC123") → match against: conference_internal_name

        //     2. **ap**
        //       - String input → match against: supplier
        //       - Code input → match against: invoice_number

        //     3. **ar**
        //       - String input → match against: customer
        //       - Code input → match against: invoice_number

        //     4. **invoice**
        //       - String input → match against: customer_name
        //       - Code input → match against: invoice_number

        //     5. **payment**
        //       - String input → match against: vendor_name
        //       - Code input → match against: supplier_invoices

        //     === MATCHING STRATEGY ===
        //     - Always use: ILIKE '%input%' for string matches
        //     - Use: ILIKE ANY(ARRAY['%value1%', '%value2%']) for multiple inputs
        //     - Use wildcards on both sides: '%string%'

        //     === EXAMPLES ===
        //     - "Show me Acme deals" → dealname ILIKE '%acme%'
        //     - "Conference ABC123" → conference_internal_name ILIKE '%abc123%'
        //     - "John's deals" → hubspot_owner_name ILIKE '%john%'
        //     - "INV-1001" in AP → invoice_number ILIKE '%inv-1001%'
        //     - "ABC Inc" in Payment → vendor_name ILIKE '%abc%'

        //     === SQL GUIDELINES ===
        //     - Use 'YYYY-MM-DD'::date for dates
        //     - Use LIMIT 100 for safety unless otherwise requested
        //     - Use clear aliases (e.g., total_revenue, record_count)
        //     - GROUP BY and ORDER BY as appropriate

        //     Return ONLY the SQL query — no explanations.
        //     `.trim()
        // },
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


