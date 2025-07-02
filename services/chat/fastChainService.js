// const { openai } = require("../openaiService");
// const { runSQL } = require("../databaseService");

// const { 
//   getChatHistory, 
//   getSessionMetadata, 
//   setSessionMetadata,
//   clearFailedQueries,
//   getSuccessfulQueriesOnly 
// } = require("./memoryServicePostgres");

// const { getTablePrompt, selectBestTable } = require('./tablePrompts');

// const tableDescriptions = {
//   closed_deal: "Tracks closed sales deals such as sponsorships and delegate registrations.",
//   lead: "Tracks active sales opportunities and pipeline deals that are not yet closed, including deal stages, sources, and sales activities.",
//   invoice: "Contains invoices issued to customers, with details like invoice number, date, customer name, and billed amount.",
//   payment: "Captures outgoing payments to vendors, including invoice references, vendor names, payment details, and dates.",
//   ap: "Tracks accounts payable, including amounts owed to suppliers, due dates, and foreign balances.",
//   ar: "Tracks accounts receivable, including outstanding customer balances, due dates, and currencies.",
//   pl: "Contains profit and loss data for financial analysis, including income, expenses, and net profit by date.",
//   bs: "Contains balance sheet data, including assets, liabilities, and equity positions by reporting period.",
//   cash_flow: "Tracks cash inflows and outflows by category and date, used for liquidity and cash management analysis.",
// };

// // Cache for session metadata to avoid repeated DB calls
// const metadataCache = new Map();
// const CACHE_TTL = 30000; // 30 seconds

// // Simplified and faster continuity analysis
// function quickContinuityCheck(input, pastMessages, sessionMetadata) {
//   if (!pastMessages || pastMessages.length === 0) {
//     return {
//       isNewTopic: true,
//       contextType: 'fresh_start',
//       confidence: 1.0,
//       suggestedTable: sessionMetadata.last_successful_table || null
//     };
//   }

//   const lastUserMessage = pastMessages[pastMessages.length - 2]?.content || '';
//   const timeSinceLastQuery = sessionMetadata.last_updated ? 
//     (Date.now() - new Date(sessionMetadata.last_updated).getTime()) / (1000 * 60) : null;

//   // Simple keyword-based continuity detection
//   const continuityKeywords = ['more', 'also', 'what about', 'show me', 'and', 'additionally', 'furthermore'];
//   const hascontinuityKeyword = continuityKeywords.some(keyword => 
//     input.toLowerCase().includes(keyword)
//   );

//   const isRecent = timeSinceLastQuery && timeSinceLastQuery < 5; // Within 5 minutes
//   const hasSimilarContext = lastUserMessage && input.toLowerCase().includes(
//     lastUserMessage.split(' ').slice(0, 3).join(' ').toLowerCase()
//   );

//   const isContinuation = (hascontinuityKeyword || hasSimilarContext) && isRecent;

//   return {
//     isNewTopic: !isContinuation,
//     contextType: isContinuation ? 'continuation' : 'new_topic',
//     confidence: isContinuation ? 0.8 : 0.9,
//     suggestedTable: isContinuation ? sessionMetadata.last_successful_table : null
//   };
// }

// // Optimized table selection with caching
// async function fastTableSelection(input, continuityAnalysis, sessionMetadata) {
//   // Use cached table if continuation and high confidence
//   if (!continuityAnalysis.isNewTopic && 
//       sessionMetadata.last_successful_table && 
//       continuityAnalysis.confidence > 0.7) {
//     return sessionMetadata.last_successful_table;
//   }

//   // Quick keyword-based table detection
//   const tableKeywords = {
//     closed_deal: ['deal', 'closed', 'sale', 'sponsor', 'registration'],
//     lead: ['lead', 'opportunity', 'pipeline', 'prospect'],
//     invoice: ['invoice', 'bill', 'billing'],
//     payment: ['payment', 'paid', 'vendor'],
//     ap: ['payable', 'owe', 'supplier'],
//     ar: ['receivable', 'outstanding', 'customer balance'],
//     pl: ['profit', 'loss', 'income', 'expense'],
//     bs: ['balance sheet', 'asset', 'liability', 'equity'],
//     cash_flow: ['cash', 'flow', 'liquidity']
//   };

//   const inputLower = input.toLowerCase();
//   for (const [table, keywords] of Object.entries(tableKeywords)) {
//     if (keywords.some(keyword => inputLower.includes(keyword))) {
//       return table;
//     }
//   }

//   // Fallback to AI selection only if needed
//   if (continuityAnalysis.suggestedTable) return continuityAnalysis.suggestedTable;
  
//   return await selectBestTable(input, [], sessionMetadata);
// }

// // Streamlined SQL generation
// async function generateSQL(input, selectedTable, continuityAnalysis, pastMessages) {
//   const tablePrompt = getTablePrompt(selectedTable, input, {});
  
//   // Simplified prompt for faster generation
//   const prompt = [
//     {
//       role: "system",
//       content: `${tablePrompt}

// CRITICAL: Return ONLY a SQL SELECT statement. No explanations.
// - Must start with SELECT
// - Reference ${selectedTable} table  
// - Add LIMIT 100 unless COUNT/SUM/aggregate query
// - Use simple conditions`
//     },
//     {
//       role: "user", 
//       content: input
//     }
//   ];

//   // Add minimal context for continuations
//   if (!continuityAnalysis.isNewTopic && pastMessages.length > 0) {
//     const lastMsg = pastMessages[pastMessages.length - 1];
//     if (lastMsg && lastMsg.content.length < 200) {
//       prompt.splice(1, 0, {
//         role: "assistant",
//         content: lastMsg.content.substring(0, 200)
//       });
//     }
//   }

//   const response = await openai.invoke(prompt);
//   return cleanSQL(response.content);
// }

// // Optimized SQL cleaning
// function cleanSQL(text) {
//   if (!text) return null;
  
//   let sql = text.trim()
//     .replace(/```sql|```/gi, "")
//     .replace(/^[^s]*select/i, 'select')
//     .trim();

//   return sql.toLowerCase().includes('select') ? sql : null;
// }

// // Fast result analysis
// function quickAnalyzeResults(results, tableName) {
//   if (!Array.isArray(results) || results.length === 0) {
//     return { isEmpty: true, recordCount: 0 };
//   }

//   const firstRow = results[0];
//   const columns = Object.keys(firstRow);
  
//   const numericColumns = columns.filter(key => typeof firstRow[key] === "number");
//   const dateColumns = columns.filter(key => 
//     key.includes("date") || key.includes("time") || 
//     firstRow[key] instanceof Date
//   );

//   return {
//     isEmpty: false,
//     recordCount: results.length,
//     hasNumericData: numericColumns.length > 0,
//     hasDateData: dateColumns.length > 0,
//     bestNumericColumn: numericColumns.find(col => 
//       col.includes('amount') || col.includes('balance') || col.includes('total')
//     ) || numericColumns[0],
//     bestDateColumn: dateColumns.find(col => 
//       col === 'date' || col.includes('date') && !col.includes('create')
//     ) || dateColumns[0]
//   };
// }

// // Cached session metadata
// async function getCachedMetadata(session_id) {
//   const cacheKey = session_id;
//   const cached = metadataCache.get(cacheKey);
  
//   if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
//     return cached.data;
//   }
  
//   const metadata = await getSessionMetadata(session_id) || {};
//   metadataCache.set(cacheKey, {
//     data: metadata,
//     timestamp: Date.now()
//   });
  
//   return metadata;
// }

// // Main optimized chain
// async function fastChain(session_id) {
//   const chatHistory = getChatHistory(session_id);

//   return async ({ input, table = null, retryCount = 0 }) => {
//     const startTime = Date.now();

//     try {
//       // STEP 1: Parallel data loading
//       const [pastMessages, sessionMetadata] = await Promise.all([
//         getSuccessfulQueriesOnly(session_id, 3), // Limit to last 3 messages
//         getCachedMetadata(session_id)
//       ]);

//       // STEP 2: Quick continuity analysis (no AI call)
//       const continuityAnalysis = quickContinuityCheck(input, pastMessages, sessionMetadata);

//       // STEP 3: Fast table selection
//       const selectedTable = table?.toLowerCase() || 
//         await fastTableSelection(input, continuityAnalysis, sessionMetadata);

//       console.log("🎯 Selected table:", selectedTable, "in", Date.now() - startTime, "ms");

//       // STEP 4: Generate SQL with timeout
//       const sqlPromise = generateSQL(input, selectedTable, continuityAnalysis, pastMessages);
//       const sql = await Promise.race([
//         sqlPromise,
//         new Promise((_, reject) => 
//           setTimeout(() => reject(new Error("SQL generation timeout")), 8000)
//         )
//       ]);

//       if (!sql) {
//         throw new Error("Failed to generate SQL");
//       }

//       console.log("⚡ Generated SQL:", sql, "in", Date.now() - startTime, "ms");

//       // STEP 5: Execute query with timeout
//       const resultPromise = runSQL(sql);
//       const result = await Promise.race([
//         resultPromise,
//         new Promise((_, reject) =>
//           setTimeout(() => reject(new Error("Query timeout")), 8000)
//         )
//       ]);

//       // STEP 6: Quick analysis
//       const analysis = quickAnalyzeResults(result, selectedTable);

//       if (analysis.isEmpty) {
//         const message = `No data found in ${selectedTable} for your query. Try checking other time periods or different filters.`;
        
//         // Save minimal info
//         await Promise.all([
//           chatHistory.addUserMessage(input),
//           chatHistory.addAIMessage(message)
//         ]);

//         return { type: "text", content: message };
//       }

//       // STEP 7: Quick summary generation (parallel with metadata save)
//       const summaryPromise = openai.invoke([
//         {
//           role: "system",
//           content: `Summarize SQL results briefly. Be conversational and concise.
// Table: ${selectedTable}, Records: ${analysis.recordCount}`
//         },
//         { 
//           role: "user", 
//           content: `${input}\n\nResults: ${JSON.stringify(result.slice(0, 3))}${result.length > 3 ? `... (${result.length} total)` : ''}` 
//         }
//       ]);

//       // STEP 8: Save metadata (don't wait for this)
//       const saveMetadata = setSessionMetadata(session_id, {
//         ...sessionMetadata,
//         last_successful_table: selectedTable,
//         last_sql: sql,
//         last_result_count: result.length,
//         recent_failures: 0,
//         last_updated: new Date().toISOString(),
//       });

//       // Wait for summary, save in background
//       const [summaryResponse] = await Promise.all([
//         summaryPromise,
//         Promise.all([
//           chatHistory.addUserMessage(input),
//           saveMetadata
//         ])
//       ]);

//       const finalAnswer = summaryResponse.content.trim();
      
//       // Save AI response (don't wait)
//       chatHistory.addAIMessage(finalAnswer);

//       const executionTime = Date.now() - startTime;
//       console.log("✅ Total execution time:", executionTime, "ms");

//       // STEP 9: Return optimized response structure
//       if (analysis.hasNumericData && analysis.hasDateData && result.length > 1) {
//         return {
//           type: "chart",
//           chartType: "bar", 
//           labels: result.map(row => row[analysis.bestDateColumn]),
//           data: result.map(row => row[analysis.bestNumericColumn]),
//           sql: sql,
//           summary: finalAnswer,
//         };
//       } else if (result.length > 0) {
//         return {
//           type: "table",
//           columns: Object.keys(result[0]),
//           rows: result.map(row => Object.values(row)),
//           sql: sql,
//           summary: finalAnswer,
//         };
//       }

//     } catch (error) {
//       console.error("❌ Chain execution error:", error);
      
//       // Simple retry logic
//       if (retryCount === 0 && !error.message.includes('timeout')) {
//         return fastChain(session_id)({
//           input: `Simple query: ${input}`,
//           table: table,
//           retryCount: 1,
//         });
//       }

//       return {
//         type: "text",
//         content: "I'm having trouble with that query. Could you try rephrasing it?",
//         error: true
//       };
//     }
//   };
// }

// // Clean up cache periodically
// setInterval(() => {
//   const now = Date.now();
//   for (const [key, value] of metadataCache.entries()) {
//     if (now - value.timestamp > CACHE_TTL * 2) {
//       metadataCache.delete(key);
//     }
//   }
// }, CACHE_TTL);

// module.exports = {
//   fastChain,
//   selectBestTable,
//   quickContinuityCheck: quickContinuityCheck,
// };

const { openai } = require("../openaiService");
const { runSQL } = require("../databaseService");

const { 
  getChatHistory, 
  getSessionMetadata, 
  setSessionMetadata,
  clearFailedQueries,
  getSuccessfulQueriesOnly 
} = require("./memoryServicePostgres");

const { getTablePrompt, selectBestTable } = require('./tablePrompts');

const tableDescriptions = {
  closed_deal: "Tracks closed sales deals such as sponsorships and delegate registrations.",
  lead: "Tracks active sales opportunities and pipeline deals that are not yet closed, including deal stages, sources, and sales activities.",
  invoice: "Contains invoices issued to customers, with details like invoice number, date, customer name, and billed amount.",
  payment: "Captures outgoing payments to vendors, including invoice references, vendor names, payment details, and dates.",
  ap: "Tracks accounts payable, including amounts owed to suppliers, due dates, and foreign balances.",
  ar: "Tracks accounts receivable, including outstanding customer balances, due dates, and currencies.",
  pl: "Contains profit and loss data for financial analysis, including income, expenses, and net profit by date.",
  bs: "Contains balance sheet data, including assets, liabilities, and equity positions by reporting period.",
  cash_flow: "Tracks cash inflows and outflows by category and date, used for liquidity and cash management analysis.",
};

// Enhanced caching system
const metadataCache = new Map();
const sqlCache = new Map();
const CACHE_TTL = 30000; // 30 seconds
const SQL_CACHE_TTL = 300000; // 5 minutes for SQL cache

// Response streaming utility
class ResponseStreamer {
  constructor() {
    this.chunks = [];
    this.subscribers = [];
  }

  addChunk(chunk) {
    this.chunks.push(chunk);
    this.subscribers.forEach(callback => callback(chunk));
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    // Send existing chunks
    this.chunks.forEach(chunk => callback(chunk));
  }

  getFullResponse() {
    return this.chunks.join('');
  }
}

// Optimized OpenAI service with model selection
async function fastOpenAICall(messages, useGPT4 = false) {
  const model = useGPT4 ? 'gpt-4' : 'gpt-3.5-turbo';
  
  // Use faster model for simple tasks
  const modifiedMessages = messages.map(msg => ({
    ...msg,
    content: msg.content.length > 1000 ? msg.content.substring(0, 1000) + "..." : msg.content
  }));

  return await openai.invoke(modifiedMessages, { 
    model,
    max_tokens: useGPT4 ? 500 : 300,
    temperature: 0.1 // Lower temperature for faster, more deterministic responses
  });
}

// SQL query optimizer with automatic limits
function optimizeSQL(sql, tableName) {
  if (!sql || typeof sql !== 'string') return sql;
  
  let optimizedSQL = sql.trim();
  
  // Add LIMIT if not present and not an aggregate query
  const hasLimit = /\blimit\b/i.test(optimizedSQL);
  const isAggregate = /\b(count|sum|avg|max|min|group by)\b/i.test(optimizedSQL);
  
  if (!hasLimit && !isAggregate) {
    // Add LIMIT 50 for faster queries
    optimizedSQL += ' LIMIT 50';
  }
  
  // Optimize SELECT * to specific columns for better performance
  if (optimizedSQL.includes('SELECT *')) {
    const commonColumns = {
      closed_deal: ['id', 'deal_name', 'amount', 'close_date', 'status'],
      lead: ['id', 'company_name', 'contact_name', 'stage', 'value', 'created_date'],
      invoice: ['id', 'invoice_number', 'customer_name', 'amount', 'date', 'status'],
      payment: ['id', 'vendor_name', 'amount', 'payment_date', 'invoice_reference'],
      ap: ['id', 'supplier_name', 'amount', 'due_date', 'status'],
      ar: ['id', 'customer_name', 'amount', 'due_date', 'currency'],
      pl: ['id', 'date', 'revenue', 'expenses', 'net_profit'],
      bs: ['id', 'date', 'assets', 'liabilities', 'equity'],
      cash_flow: ['id', 'date', 'category', 'inflow', 'outflow', 'balance']
    };
    
    const columns = commonColumns[tableName];
    if (columns) {
      optimizedSQL = optimizedSQL.replace('SELECT *', `SELECT ${columns.join(', ')}`);
    }
  }
  
  return optimizedSQL;
}

// Enhanced connection pooling simulation (you'll need to implement this in your databaseService)
class QueryPool {
  constructor() {
    this.activeQueries = new Set();
    this.queryQueue = [];
    this.maxConcurrent = 5;
  }

  async executeQuery(sql) {
    return new Promise((resolve, reject) => {
      if (this.activeQueries.size >= this.maxConcurrent) {
        this.queryQueue.push({ sql, resolve, reject });
        return;
      }

      this.runQuery(sql, resolve, reject);
    });
  }

  async runQuery(sql, resolve, reject) {
    const queryId = Symbol('query');
    this.activeQueries.add(queryId);

    try {
      const result = await runSQL(sql);
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.activeQueries.delete(queryId);
      this.processQueue();
    }
  }

  processQueue() {
    if (this.queryQueue.length > 0 && this.activeQueries.size < this.maxConcurrent) {
      const { sql, resolve, reject } = this.queryQueue.shift();
      this.runQuery(sql, resolve, reject);
    }
  }
}

const queryPool = new QueryPool();

// Ultra-fast continuity analysis
function quickContinuityCheck(input, pastMessages, sessionMetadata) {
  if (!pastMessages || pastMessages.length === 0) {
    return {
      isNewTopic: true,
      contextType: 'fresh_start',
      confidence: 1.0,
      suggestedTable: sessionMetadata.last_successful_table || null
    };
  }

  const inputLower = input.toLowerCase();
  const lastUserMessage = pastMessages[pastMessages.length - 2]?.content?.toLowerCase() || '';
  
  // Fast pattern matching
  const continuityPatterns = [
    /\b(more|also|what about|show me|and|additionally|furthermore|too|as well)\b/,
    /\b(other|different|another|compare|versus|vs)\b/,
    /\b(same|similar|like that|those|these)\b/
  ];

  const hasContinuity = continuityPatterns.some(pattern => pattern.test(inputLower));
  const hasTimeContext = inputLower.includes('last') || inputLower.includes('recent') || inputLower.includes('latest');
  
  const timeSinceLastQuery = sessionMetadata.last_updated ? 
    (Date.now() - new Date(sessionMetadata.last_updated).getTime()) / (1000 * 60) : 999;

  const isRecent = timeSinceLastQuery < 10; // Within 10 minutes
  const isContinuation = (hasContinuity || hasTimeContext) && isRecent;

  return {
    isNewTopic: !isContinuation,
    contextType: isContinuation ? 'continuation' : 'new_topic',
    confidence: isContinuation ? 0.85 : 0.95,
    suggestedTable: isContinuation ? sessionMetadata.last_successful_table : null
  };
}

// Lightning-fast table selection with ML-like scoring
function selectTableByScore(input) {
  const inputLower = input.toLowerCase();
  const scores = {};
  
  // Weighted keyword scoring
  const tableKeywords = {
    closed_deal: { 
      keywords: ['deal', 'closed', 'sale', 'sponsor', 'registration', 'won', 'signed'], 
      weight: 1.2 
    },
    lead: { 
      keywords: ['lead', 'opportunity', 'pipeline', 'prospect', 'potential', 'qualify'], 
      weight: 1.0 
    },
    invoice: { 
      keywords: ['invoice', 'bill', 'billing', 'charge', 'receipt'], 
      weight: 1.1 
    },
    payment: { 
      keywords: ['payment', 'paid', 'vendor', 'expense', 'spend'], 
      weight: 1.0 
    },
    ap: { 
      keywords: ['payable', 'owe', 'supplier', 'debt', 'outstanding'], 
      weight: 0.9 
    },
    ar: { 
      keywords: ['receivable', 'collect', 'customer balance', 'due'], 
      weight: 0.9 
    },
    pl: { 
      keywords: ['profit', 'loss', 'income', 'expense', 'revenue', 'earnings'], 
      weight: 1.1 
    },
    bs: { 
      keywords: ['balance sheet', 'asset', 'liability', 'equity', 'capital'], 
      weight: 0.8 
    },
    cash_flow: { 
      keywords: ['cash', 'flow', 'liquidity', 'inflow', 'outflow'], 
      weight: 1.0 
    }
  };

  // Calculate scores
  for (const [table, config] of Object.entries(tableKeywords)) {
    let score = 0;
    for (const keyword of config.keywords) {
      if (inputLower.includes(keyword)) {
        score += (keyword.length / 10) * config.weight; // Longer keywords get higher scores
      }
    }
    scores[table] = score;
  }

  // Return highest scoring table
  const bestTable = Object.entries(scores).reduce((a, b) => scores[a[0]] > scores[b[0]] ? a : b);
  return bestTable[1] > 0 ? bestTable[0] : 'lead'; // Default to lead if no matches
}

// Cached SQL generation with templates
function generateSQLFromTemplate(input, tableName) {
  const inputLower = input.toLowerCase();
  
  // Common SQL templates for instant responses
  const templates = {
    'recent': `SELECT * FROM ${tableName} WHERE date >= CURRENT_DATE - INTERVAL '30 days' ORDER BY date DESC LIMIT 20`,
    'total': `SELECT COUNT(*) as total FROM ${tableName}`,
    'latest': `SELECT * FROM ${tableName} ORDER BY date DESC LIMIT 10`,
    'this month': `SELECT * FROM ${tableName} WHERE EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE) LIMIT 20`,
    'today': `SELECT * FROM ${tableName} WHERE DATE(date) = CURRENT_DATE LIMIT 20`,
    'summary': `SELECT COUNT(*) as count, SUM(amount) as total_amount FROM ${tableName} WHERE amount IS NOT NULL`
  };

  // Try to match templates
  for (const [pattern, sql] of Object.entries(templates)) {
    if (inputLower.includes(pattern)) {
      return sql;
    }
  }

  return null;
}

// Optimized SQL generation with caching
async function generateSQL(input, selectedTable, continuityAnalysis, pastMessages) {
  // Check SQL cache first
  const cacheKey = `${selectedTable}:${input.toLowerCase()}`;
  const cached = sqlCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < SQL_CACHE_TTL) {
    console.log("🚀 Using cached SQL");
    return cached.sql;
  }

  // Try template matching first (instant)
  const templateSQL = generateSQLFromTemplate(input, selectedTable);
  if (templateSQL) {
    console.log("⚡ Using SQL template");
    sqlCache.set(cacheKey, { sql: templateSQL, timestamp: Date.now() });
    return templateSQL;
  }

  // Streamlined AI generation
  const tablePrompt = getTablePrompt(selectedTable, input, {});
  
  const prompt = [
    {
      role: "system",
      content: `${tablePrompt}

CRITICAL: Return ONLY SQL SELECT statement. No explanations.
- Start with SELECT
- Reference ${selectedTable} table  
- Keep it simple and fast
- Auto-add reasonable limits`
    },
    {
      role: "user", 
      content: input
    }
  ];

  const response = await fastOpenAICall(prompt, false); // Use GPT-3.5 for speed
  const sql = cleanSQL(response.content);
  const optimizedSQL = optimizeSQL(sql, selectedTable);
  
  // Cache the result
  sqlCache.set(cacheKey, { sql: optimizedSQL, timestamp: Date.now() });
  
  return optimizedSQL;
}

// Ultra-fast SQL cleaning
function cleanSQL(text) {
  if (!text) return null;
  
  // Extract SQL more aggressively
  const sqlMatch = text.match(/select\s+.*?(?:;|$)/is);
  if (sqlMatch) {
    return sqlMatch[0].replace(/;$/, '').trim();
  }
  
  // Fallback to original method
  let sql = text.trim()
    .replace(/```sql|```/gi, "")
    .replace(/^[^s]*select/i, 'select')
    .trim();

  return sql.toLowerCase().includes('select') ? sql : null;
}

// Lightning-fast result analysis
function quickAnalyzeResults(results, tableName) {
  if (!Array.isArray(results) || results.length === 0) {
    return { isEmpty: true, recordCount: 0 };
  }

  const firstRow = results[0];
  const columns = Object.keys(firstRow);
  
  // Pre-compute column types for performance
  const numericColumns = [];
  const dateColumns = [];
  
  for (const key of columns) {
    const value = firstRow[key];
    if (typeof value === "number") {
      numericColumns.push(key);
    } else if (key.includes("date") || key.includes("time") || value instanceof Date) {
      dateColumns.push(key);
    }
  }

  return {
    isEmpty: false,
    recordCount: results.length,
    hasNumericData: numericColumns.length > 0,
    hasDateData: dateColumns.length > 0,
    bestNumericColumn: numericColumns.find(col => 
      /amount|balance|total|value|price|cost/.test(col)
    ) || numericColumns[0],
    bestDateColumn: dateColumns.find(col => 
      col === 'date' || /^date|_date$/.test(col)
    ) || dateColumns[0],
    columns
  };
}

// Enhanced metadata caching
async function getCachedMetadata(session_id) {
  const cacheKey = `meta:${session_id}`;
  const cached = metadataCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }
  
  const metadata = await getSessionMetadata(session_id) || {};
  metadataCache.set(cacheKey, {
    data: metadata,
    timestamp: Date.now()
  });
  
  return metadata;
}

// Streaming summary generation
async function generateStreamingSummary(input, results, tableName, streamer) {
  const analysis = quickAnalyzeResults(results, tableName);
  
  // Send initial chunk
  streamer.addChunk(`Found ${analysis.recordCount} records in ${tableName}. `);
  
  // Quick summary based on data patterns
  if (analysis.recordCount === 0) {
    streamer.addChunk("No matching data found for your query.");
    return streamer.getFullResponse();
  }
  
  if (analysis.recordCount === 1) {
    streamer.addChunk("Here's the single record that matches your criteria.");
  } else if (analysis.recordCount <= 5) {
    streamer.addChunk("Here are all the matching records.");
  } else {
    streamer.addChunk(`Showing ${Math.min(analysis.recordCount, 50)} results.`);
  }

  // Add context about the data
  if (analysis.hasNumericData && analysis.bestNumericColumn) {
    const total = results.reduce((sum, row) => sum + (row[analysis.bestNumericColumn] || 0), 0);
    streamer.addChunk(` Total ${analysis.bestNumericColumn}: ${total.toLocaleString()}.`);
  }

  return streamer.getFullResponse();
}

// Main ultra-optimized chain
async function loadChain(session_id) {
  const chatHistory = getChatHistory(session_id);

  return async ({ input, table = null, retryCount = 0 }) => {
    const startTime = Date.now();
    const streamer = new ResponseStreamer();

    try {
      console.log("🚀 Starting fast chain for:", input);

      // STEP 1: Ultra-fast parallel data loading
      const [pastMessages, sessionMetadata] = await Promise.all([
        getSuccessfulQueriesOnly(session_id, 2), // Only last 2 messages
        getCachedMetadata(session_id)
      ]);

      console.log("📊 Data loaded in:", Date.now() - startTime, "ms");

      // STEP 2: Lightning continuity analysis (no AI)
      const continuityAnalysis = quickContinuityCheck(input, pastMessages, sessionMetadata);

      // STEP 3: Instant table selection
      const selectedTable = table?.toLowerCase() || 
        continuityAnalysis.suggestedTable || 
        selectTableByScore(input);

      console.log("🎯 Table selected:", selectedTable, "in", Date.now() - startTime, "ms");

      // STEP 4: Fast SQL generation (cached/templated when possible)
      const sql = await generateSQL(input, selectedTable, continuityAnalysis, pastMessages);

      if (!sql) {
        throw new Error("Could not generate SQL");
      }

      console.log("⚡ SQL generated in:", Date.now() - startTime, "ms");

      // STEP 5: Execute with connection pooling
      const result = await Promise.race([
        queryPool.executeQuery(sql),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Query timeout")), 5000) // Shorter timeout
        )
      ]);

      console.log("💾 Query executed in:", Date.now() - startTime, "ms");

      // STEP 6: Quick analysis
      const analysis = quickAnalyzeResults(result, selectedTable);

      // STEP 7: Handle empty results quickly
      if (analysis.isEmpty) {
        const message = `No data found in ${selectedTable}. Try different filters or time periods.`;
        
        // Save asynchronously
        Promise.all([
          chatHistory.addUserMessage(input),
          chatHistory.addAIMessage(message)
        ]);

        return { type: "text", content: message };
      }

      // STEP 8: Streaming summary generation
      const summaryPromise = generateStreamingSummary(input, result, selectedTable, streamer);

      // STEP 9: Save metadata asynchronously (non-blocking)
      const savePromise = Promise.all([
        chatHistory.addUserMessage(input),
        setSessionMetadata(session_id, {
          ...sessionMetadata,
          last_successful_table: selectedTable,
          last_sql: sql,
          last_result_count: result.length,
          recent_failures: 0,
          last_updated: new Date().toISOString(),
        })
      ]);

      // Get summary
      const summary = await summaryPromise;
      
      // Save AI response asynchronously
      chatHistory.addAIMessage(summary);

      const executionTime = Date.now() - startTime;
      console.log("✅ Total execution time:", executionTime, "ms");

      // STEP 10: Return optimized response
      const baseResponse = {
        sql: sql,
        summary: summary,
        executionTime: executionTime
      };

      // Smart response type detection
      if (analysis.hasNumericData && analysis.hasDateData && 
          result.length > 1 && result.length <= 100) {
        return {
          ...baseResponse,
          type: "chart",
          chartType: "bar",
          labels: result.map(row => row[analysis.bestDateColumn]),
          data: result.map(row => row[analysis.bestNumericColumn]),
        };
      } else if (result.length > 0 && result.length <= 1000) {
        return {
          ...baseResponse,
          type: "table",
          columns: analysis.columns,
          rows: result.map(row => analysis.columns.map(col => row[col])),
        };
      } else {
        return {
          ...baseResponse,
          type: "text",
          content: summary,
        };
      }

    } catch (error) {
      console.error("❌ Error in", Date.now() - startTime, "ms:", error.message);
      
      // Ultra-fast retry with simpler approach
      if (retryCount === 0) {
        return loadChain(session_id)({
          input: input,
          table: 'lead', // Default table for retry
          retryCount: 1,
        });
      }

      return {
        type: "text",
        content: "Query failed. Please try a simpler question.",
        error: true,
        executionTime: Date.now() - startTime
      };
    }
  };
}

// Cleanup utilities
setInterval(() => {
  const now = Date.now();
  
  // Clean metadata cache
  for (const [key, value] of metadataCache.entries()) {
    if (now - value.timestamp > CACHE_TTL * 2) {
      metadataCache.delete(key);
    }
  }
  
  // Clean SQL cache
  for (const [key, value] of sqlCache.entries()) {
    if (now - value.timestamp > SQL_CACHE_TTL * 2) {
      sqlCache.delete(key);
    }
  }
}, CACHE_TTL);

module.exports = {
  loadChain,
  selectBestTable: selectTableByScore,
  quickContinuityCheck,
  ResponseStreamer,
  QueryPool
};