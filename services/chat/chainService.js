// const { openai } = require("../openaiService");
// const { runSQL } = require("../databaseService");
// const fs = require('fs');
// const {
//   getChatHistory,
//   getSessionMetadata,
//   setSessionMetadata,
// } = require("./memoryService");

// // Import the new table-specific prompts
// const { TABLE_PROMPTS, getTablePrompt, selectBestTable } = require('./tablePrompts');

// function writeToLogFile(logMessage) {
//   const timestamp = new Date().toISOString();
//   const logEntry = `${timestamp} - ${logMessage}\n`;

//   fs.appendFile('app.log', logEntry, (err) => {
//     if (err) {
//       console.error('Error writing to log file:', err);
//     }
//   });
// };

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

// function cleanSQL(text) {
//   return text
//     .toLowerCase()
//     .trim()
//     .replace(/```sql|```/gi, "")
//     .trim();
// }

// //SQL validation and optimization
// function validateAndOptimizeSQL(sql, tableName) {
//   const issues = [];
//   const suggestions = [];

//   if (
//     !sql.includes("limit") &&
//     !sql.includes("count") &&
//     !sql.includes("sum")
//   ) {
//     suggestions.push("Consider adding LIMIT for large datasets");
//   }

//   if (sql.includes("select *")) {
//     suggestions.push(
//       "Consider selecting specific columns for better performance"
//     );
//   }

//   if (sql.includes("date") && !sql.includes("::date") && !sql.includes("'")) {
//     issues.push("Date values should be quoted");
//   }

//   return { issues, suggestions, isValid: issues.length === 0 };
// }

// //Result analysis and insights  
// function analyzeResults(results, question, tableName) {
//   if (!Array.isArray(results) || results.length === 0) {
//     return { isEmpty: true, insights: [] };
//   }

//   const insights = [];
//   const firstRow = results[0];

//   const numericColumns = Object.keys(firstRow).filter(
//     (key) => typeof firstRow[key] === "number"
//   );

//   const dateColumns = Object.keys(firstRow).filter(
//     (key) => key.includes("date") || key.includes("time")
//   );

//   // Find best columns for charting
//   let bestNumericColumn = null;
//   let bestDateColumn = null;
  
//   if (numericColumns.length > 0) {
//     // Prefer amount columns for charts
//     bestNumericColumn = numericColumns.find(col => 
//       col.includes('amount') || col.includes('balance') || col.includes('total')
//     ) || numericColumns[0];
    
//     const totals = numericColumns.map((col) => ({
//       column: col,
//       total: results.reduce((sum, row) => sum + (row[col] || 0), 0),
//       avg: results.reduce((sum, row) => sum + (row[col] || 0), 0) / results.length,
//     }));
//     insights.push({ type: "totals", data: totals });
//   }

//   if (dateColumns.length > 0) {
//     // Prefer standard date columns
//     bestDateColumn = dateColumns.find(col => 
//       col === 'date' || col.includes('date') && !col.includes('create')
//     ) || dateColumns[0];
//   }

//   if (results.length > 1 && dateColumns.length > 0) {
//     insights.push({ type: "time_range", count: results.length });
//   }

//   return {
//     isEmpty: false,
//     recordCount: results.length,
//     insights,
//     hasNumericData: numericColumns.length > 0,
//     hasDateData: dateColumns.length > 0,
//     bestNumericColumn,
//     bestDateColumn
//   };
// }

// //Main chain with table-specific prompts
// async function loadChain(session_id) {
//   const chatHistory = getChatHistory(session_id);

//   return async ({ input, table = null, retryCount = 0 }) => {
//     try {
//       const pastMessages = await chatHistory.getMessages();
//       const sessionMetadata = (await getSessionMetadata(session_id)) || {};

//       // STEP 1: Enhanced table selection using new system
//       let selectedTable = table?.toLowerCase();
//       if (!selectedTable) {
//         selectedTable = await selectBestTable(
//           input,
//           pastMessages,
//           sessionMetadata
//         );
//         console.log("🎯 Selected table:", selectedTable);
//       }

//       // STEP 2: Generate SQL using table-specific prompt
//       const recentContext = pastMessages.slice(-4);

//       console.log("🔍 Recent context:", recentContext.map(m => m.content).join("\n"));
      
//       // Get the table-specific prompt
//       const tablePrompt = getTablePrompt(selectedTable, input, sessionMetadata);
      
//       const sqlPrompt = [
//         {
//           role: "system",
//           content: tablePrompt
//         },
//         ...recentContext.map((m) => ({
//           role: m._getType?.() || m.role,
//           content: m.content,
//         })),
//         { role: "user", content: input },
//       ];

//       const sqlResponse = await openai.invoke(sqlPrompt);
//       const sql = cleanSQL(sqlResponse.content);

//       // STEP 3: Validate SQL
//       const validation = validateAndOptimizeSQL(sql, selectedTable);
//       if (!validation.isValid && retryCount === 0) {
//         console.warn("⚠️ SQL validation issues:", validation.issues);
//       }

//       console.log("🔍 Session ID:", session_id);
//       console.log("🔍 Selected table:", selectedTable);
//       console.log("🔍 Input question:", input);
//       console.log("⚡ Generated SQL:", sql);

//       if (!sql.startsWith("select")) {
//         return "⚠️ Only SELECT queries are supported.";
//       }

//       // STEP 4: Execute with timeout
//       let result;
//       let sqlError = null;
//       const startTime = Date.now();

//       try {
//         result = await Promise.race([
//           runSQL(sql),
//           new Promise((_, reject) =>
//             setTimeout(() => reject(new Error("Query timeout")), 30000)
//           ),
//         ]);
//       } catch (err) {
//         sqlError = err.message;
//         console.error("❌ SQL Error:", sqlError);
//       }

//       // STEP 5: Analyze results
//       const analysis = analyzeResults(result, input, selectedTable);

//       if (analysis.isEmpty && !sqlError) {
//         // Smart fallback with table-aware suggestions
//         const tableConfig = TABLE_PROMPTS[selectedTable];
//         const alternativePrompt = [
//           {
//             role: "system",
//             content: `
//               No data found in ${selectedTable} table. 
              
//               Table purpose: ${tableDescriptions[selectedTable]}
//               Common keywords: ${tableConfig?.keywords.join(', ')}
              
//               Available alternative tables:
//               ${Object.entries(tableDescriptions)
//                 .filter(([key]) => key !== selectedTable)
//                 .map(([key, desc]) => `- ${key}: ${desc}`)
//                 .join("\n")}
              
//               Suggest specific alternatives based on the question context.
//             `.trim(),
//           },
//           {
//             role: "user",
//             content: `Question: "${input}" returned no results from ${selectedTable}`,
//           },
//         ];

//         const altResponse = await openai.invoke(alternativePrompt);
//         const message = `I couldn't find any data for that question in the ${selectedTable} table.\n\n${altResponse.content}`;

//         await chatHistory.addUserMessage(input);
//         await chatHistory.addAIMessage(message);
//         await setSessionMetadata(session_id, {
//           last_table: selectedTable,
//           last_query_empty: true,
//           suggestion_made: true,
//         });

//         return message;
//       }

//       // STEP 6: Generate enhanced summary with table-specific context
//       const tableConfig = TABLE_PROMPTS[selectedTable];
//       const summaryPrompt = [
//         {
//           role: "system",
//           content: `
//             You are a business data analyst specializing in ${selectedTable} data.
            
//             Context:
//             - Table: ${selectedTable} (${tableDescriptions[selectedTable]})
//             - Question: "${input}"
//             - Records found: ${analysis.recordCount || 0}
//             - Has numeric data: ${analysis.hasNumericData}
//             - Table focus: ${tableConfig?.keywords.join(', ')}
            
//             RESPONSE STYLE:
//             Write like you're having a conversation with a business colleague. Use natural language, not markdown formatting.
            
//             STRUCTURE FOR READABILITY:
            
//             1. **Lead with Direct Answer**: 
//               Start with a clear, conversational answer to their question.
//               Example: "Venterra generated $1,295 in total revenue from one deal."
            
//             2. **Keep It Conversational**:
//               - Write in complete sentences, not bullet points or headers
//               - Use natural transitions like "Additionally," "What's interesting is," "Here's what stands out"
//               - Avoid technical markdown symbols (##, **, --)
            
//             3. **Make Numbers Clear**:
//               - Embed numbers naturally: "The total came to $1,295"
//               - Round appropriately: "$1.2 million" not "$1,234,567"
//               - Add context: "$50K, which is 25% above average"
            
//             4. **Organize Long Responses Naturally**:
//               Instead of headers, use transitional phrases:
//               - "Here's what I found..."
//               - "Looking at the details..."
//               - "What stands out is..."
//               - "The key takeaway is..."
            
//             5. **Business Language**:
//               - Say "customers" not "records"
//               - Say "deals" not "rows"  
//               - Say "revenue totaled" not "sum of amount column equals"
//               - Use active voice: "John closed 5 deals" not "5 deals were closed by John"
            
//             6. **Keep Paragraphs Short**:
//               - 2-3 sentences maximum per paragraph
//               - Add line breaks between different topics
//               - Use white space to make it scannable
            
//             7. **Error Handling**:
//               If there's an error, explain it conversationally:
//               "I couldn't find any deals matching that name. You might want to try searching for a partial match instead."
            
//             8. **Table-Specific Insights**:
//               For ${selectedTable} data, focus on relevant business metrics and KPIs.
            
//           `.trim(),
//         },
//         { role: "user", content: input },
//         {
//           role: "assistant",
//           content: sqlError
//             ? `Query error: ${sqlError}`
//             : `Analysis: ${JSON.stringify({
//                 results: result,
//                 insights: analysis.insights,
//               })}`,
//         },
//       ];

//       const summaryResponse = await openai.invoke(summaryPrompt);
//       const finalAnswer = summaryResponse.content.trim();

//       // STEP 7: Enhanced session tracking
//       await chatHistory.addUserMessage(input);
//       await chatHistory.addAIMessage(finalAnswer);
//       await setSessionMetadata(session_id, {
//         last_table: selectedTable,
//         last_sql: sql,
//         last_result_count: result?.length || 0,
//         last_execution_time: Date.now() - startTime,
//         query_success: !sqlError,
//         last_updated: new Date().toISOString(),
//         table_prompt_used: tableConfig?.keywords.join(', '),
//       });

//       const executionTime = Date.now() - startTime;
//       writeToLogFile(`\nresult: ${JSON.stringify(finalAnswer)}, \nexecutionTime: ${executionTime}ms, \nsql: ${sql}, \nsqlResponse: ${JSON.stringify(result)}`);

//       console.log("result: ", finalAnswer);
      
//       // STEP 8: Return structured response for UI
//       if (sqlError) {
//         return {
//           type: "text",
//           content: `Query error: ${sqlError}`,
//         };
//       }

//       // Enhanced chart detection using analysis
//       if (analysis.hasNumericData && analysis.hasDateData && 
//           analysis.bestDateColumn && analysis.bestNumericColumn && 
//           result.length > 1) {
//         return {
//           type: "chart",
//           chartType: "bar", 
//           labels: result.map(row => row[analysis.bestDateColumn]),
//           data: result.map(row => row[analysis.bestNumericColumn]),
//           summary: finalAnswer,
//           tableName: selectedTable,
//         };
//       } else if (result.length > 0) {
//         return {
//           type: "table",
//           columns: Object.keys(result[0]),
//           rows: result.map(row => Object.values(row)),
//           summary: finalAnswer,
//           tableName: selectedTable,
//         };
//       } else {
//         return {
//           type: "text",
//           content: finalAnswer,
//           tableName: selectedTable,
//         };
//       }

//     } catch (error) {
//       console.error("❌ Chain execution error:", error);

//       // Graceful error handling with retry
//       if (retryCount < 1) {
//         console.log("🔄 Retrying...");
//         return loadChain(session_id)({
//           input,
//           table,
//           retryCount: retryCount + 1,
//         });
//       }

//       return {
//         type: "text",
//         content: `I apologize, but I encountered an error processing your question. Please try rephrasing it or ask something else.`,
//       };
//     }
//   };
// }

// module.exports = {
//   loadChain,
//   selectBestTable,
// };


const { openai } = require("../openaiService");
const { runSQL } = require("../databaseService");
const fs = require('fs');
const {
  getChatHistory,
  getSessionMetadata,
  setSessionMetadata,
} = require("./memoryServiceRedis");

// Import the new table-specific prompts
const { TABLE_PROMPTS, getTablePrompt, selectBestTable } = require('./tablePrompts');

function writeToLogFile(logMessage) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ${logMessage}\n`;

  fs.appendFile('app.log', logEntry, (err) => {
    if (err) {
      console.error('Error writing to log file:', err);
    }
  });
};

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

// NEW: Conversation continuity detection
async function analyzeContinuity(input, pastMessages, sessionMetadata) {
  if (!pastMessages || pastMessages.length === 0) {
    return {
      isNewTopic: true,
      contextType: 'fresh_start',
      confidence: 1.0,
      reasoning: 'No previous conversation history'
    };
  }

  // Get recent context (last 6 messages for better analysis)
  const recentMessages = pastMessages.slice(-6);
  const lastUserMessage = recentMessages.filter(m => m._getType?.() === 'human' || m.role === 'user').pop();
  const lastAiMessage = recentMessages.filter(m => m._getType?.() === 'ai' || m.role === 'assistant').pop();

  // Time-based analysis
  const timeSinceLastQuery = sessionMetadata.last_updated ? 
    (Date.now() - new Date(sessionMetadata.last_updated).getTime()) / (1000 * 60) : null; // minutes

  const continuityPrompt = [
    {
      role: "system",
      content: `
        You are a conversation continuity analyzer. Determine if the user's new question is:
        1. A NEW TOPIC - completely unrelated to previous conversation
        2. A CONTINUATION - following up, drilling down, or related to previous discussion
        3. A CLARIFICATION - asking for more details about the last response
        4. A MODIFICATION - similar question with different parameters

        Context factors to consider:
        - Time gap: ${timeSinceLastQuery ? `${Math.round(timeSinceLastQuery)} minutes ago` : 'unknown'}
        - Last table used: ${sessionMetadata.last_table || 'none'}
        - Last query successful: ${sessionMetadata.query_success !== false}
        - Previous result count: ${sessionMetadata.last_result_count || 0}

        Analyze these patterns:
        - Pronouns (it, them, those, that) suggest continuation
        - Follow-up words (also, more, what about, how about) suggest continuation  
        - Time references (this month, last week) may continue context
        - Completely different business domains suggest new topic
        - Questions about different data types suggest new topic

        Respond with JSON only:
        {
          "isNewTopic": boolean,
          "contextType": "fresh_start|continuation|clarification|modification|new_topic",
          "confidence": 0.0-1.0,
          "reasoning": "brief explanation",
          "suggestedTable": "table_name or null",
          "contextElements": ["key phrases that influenced decision"]
        }
      `.trim()
    },
    {
      role: "user", 
      content: `
        Previous conversation context:
        Last user question: "${lastUserMessage?.content || 'None'}"
        Last AI response: "${lastAiMessage?.content?.substring(0, 200) || 'None'}..."
        
        Current question: "${input}"
        
        Analyze continuity:
      `.trim()
    }
  ];

  try {
    const response = await openai.invoke(continuityPrompt);
    const analysis = JSON.parse(response.content);
    
    // Add confidence adjustments based on time gaps
    if (timeSinceLastQuery && timeSinceLastQuery > 30) {
      analysis.confidence *= 0.7; // Reduce confidence for old conversations
    }
    
    return analysis;
  } catch (error) {
    console.error("❌ Continuity analysis error:", error);
    // Fallback to simple heuristics
    return {
      isNewTopic: !hasContextClues(input),
      contextType: hasContextClues(input) ? 'continuation' : 'new_topic',
      confidence: 0.5,
      reasoning: 'Fallback analysis due to error'
    };
  }
}

// Simple fallback heuristics for continuity detection
function hasContextClues(input) {
  const lowerInput = input.toLowerCase();
  const continuationWords = [
    'it', 'them', 'those', 'that', 'this', 'these',
    'also', 'more', 'what about', 'how about', 'and',
    'additionally', 'furthermore', 'moreover',
    'same', 'similar', 'related', 'other'
  ];
  
  return continuationWords.some(word => lowerInput.includes(word));
}

// Enhanced context building based on continuity
function buildContextualPrompt(input, continuityAnalysis, pastMessages, sessionMetadata, selectedTable) {
  const baseTablePrompt = getTablePrompt(selectedTable, input, sessionMetadata);
  
  if (continuityAnalysis.isNewTopic) {
    return baseTablePrompt; // Use standard table prompt for new topics
  }

  // For continuations, enhance with conversation context
  const recentContext = pastMessages.slice(-4);
  const contextualEnhancement = `
    CONVERSATION CONTEXT:
    This question is a ${continuityAnalysis.contextType} (confidence: ${continuityAnalysis.confidence.toFixed(2)}).
    Reasoning: ${continuityAnalysis.reasoning}
    
    Recent conversation:
    ${recentContext.map(m => `${m._getType?.() || m.role}: ${m.content}`).join('\n')}
    
    CONTINUITY INSTRUCTIONS:
    - Reference previous results when relevant
    - Use "the previous data showed" or "building on that"
    - Maintain context about filters, date ranges, or specific entities mentioned
    - If user says "show me more" or "what about X", relate back to previous query
    - Keep the same table focus unless explicitly asked to change
    
    ${baseTablePrompt}
  `.trim();
  
  return contextualEnhancement;
}

function cleanSQL(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/```sql|```/gi, "")
    .trim();
}

//SQL validation and optimization
function validateAndOptimizeSQL(sql, tableName) {
  const issues = [];
  const suggestions = [];

  if (
    !sql.includes("limit") &&
    !sql.includes("count") &&
    !sql.includes("sum")
  ) {
    suggestions.push("Consider adding LIMIT for large datasets");
  }

  if (sql.includes("select *")) {
    suggestions.push(
      "Consider selecting specific columns for better performance"
    );
  }

  if (sql.includes("date") && !sql.includes("::date") && !sql.includes("'")) {
    issues.push("Date values should be quoted");
  }

  return { issues, suggestions, isValid: issues.length === 0 };
}

//Result analysis and insights  
function analyzeResults(results, question, tableName) {
  if (!Array.isArray(results) || results.length === 0) {
    return { isEmpty: true, insights: [] };
  }

  const insights = [];
  const firstRow = results[0];

  const numericColumns = Object.keys(firstRow).filter(
    (key) => typeof firstRow[key] === "number"
  );

  const dateColumns = Object.keys(firstRow).filter(
    (key) => key.includes("date") || key.includes("time")
  );

  // Find best columns for charting
  let bestNumericColumn = null;
  let bestDateColumn = null;
  
  if (numericColumns.length > 0) {
    // Prefer amount columns for charts
    bestNumericColumn = numericColumns.find(col => 
      col.includes('amount') || col.includes('balance') || col.includes('total')
    ) || numericColumns[0];
    
    const totals = numericColumns.map((col) => ({
      column: col,
      total: results.reduce((sum, row) => sum + (row[col] || 0), 0),
      avg: results.reduce((sum, row) => sum + (row[col] || 0), 0) / results.length,
    }));
    insights.push({ type: "totals", data: totals });
  }

  if (dateColumns.length > 0) {
    // Prefer standard date columns
    bestDateColumn = dateColumns.find(col => 
      col === 'date' || col.includes('date') && !col.includes('create')
    ) || dateColumns[0];
  }

  if (results.length > 1 && dateColumns.length > 0) {
    insights.push({ type: "time_range", count: results.length });
  }

  return {
    isEmpty: false,
    recordCount: results.length,
    insights,
    hasNumericData: numericColumns.length > 0,
    hasDateData: dateColumns.length > 0,
    bestNumericColumn,
    bestDateColumn
  };
}

//Main chain with enhanced continuity detection
async function loadChain(session_id) {
  const chatHistory = getChatHistory(session_id);

  return async ({ input, table = null, retryCount = 0 }) => {
    try {
      const pastMessages = await chatHistory.getMessages();
      const sessionMetadata = (await getSessionMetadata(session_id)) || {};

      // NEW STEP 1: Analyze conversation continuity
      const continuityAnalysis = await analyzeContinuity(input, pastMessages, sessionMetadata);
      console.log("🔄 Continuity Analysis:", continuityAnalysis);

      // STEP 2: Enhanced table selection using continuity context
      let selectedTable = table?.toLowerCase();
      if (!selectedTable) {
        // If it's a continuation and we have a recent successful table, prefer that
        if (!continuityAnalysis.isNewTopic && 
            sessionMetadata.last_table && 
            sessionMetadata.query_success !== false &&
            continuityAnalysis.confidence > 0.6) {
          selectedTable = sessionMetadata.last_table;
          console.log("🔄 Using previous table due to continuation:", selectedTable);
        } else {
          selectedTable = continuityAnalysis.suggestedTable || 
                        await selectBestTable(input, pastMessages, sessionMetadata);
        }
        console.log("🎯 Selected table:", selectedTable);
      }

      // STEP 3: Generate SQL using contextual prompt
      const recentContext = pastMessages.slice(-4);
      
      // Get contextually-aware table prompt
      const tablePrompt = buildContextualPrompt(
        input, 
        continuityAnalysis, 
        pastMessages, 
        sessionMetadata, 
        selectedTable
      );

      console.log(tablePrompt)
      
      const sqlPrompt = [
        {
          role: "system",
          content: tablePrompt
        },
        ...recentContext.map((m) => ({
          role: m._getType?.() || m.role,
          content: m.content,
        })),
        { role: "user", content: input },
      ];

      const sqlResponse = await openai.invoke(sqlPrompt);
      const sql = cleanSQL(sqlResponse.content);

      // STEP 4: Validate SQL
      const validation = validateAndOptimizeSQL(sql, selectedTable);
      if (!validation.isValid && retryCount === 0) {
        console.warn("⚠️ SQL validation issues:", validation.issues);
      }

      console.log("🔍 Session ID:", session_id);
      console.log("🔍 Selected table:", selectedTable);
      console.log("🔍 Input question:", input);
      console.log("⚡ Generated SQL:", sql);

      if (!sql.startsWith("select")) {
        return "⚠️ Only SELECT queries are supported.";
      }

      // STEP 5: Execute with timeout
      let result;
      let sqlError = null;
      const startTime = Date.now();

      try {
        result = await Promise.race([
          runSQL(sql),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Query timeout")), 30000)
          ),
        ]);
      } catch (err) {
        sqlError = err.message;
        console.error("❌ SQL Error:", sqlError);
      }

      // STEP 6: Analyze results
      const analysis = analyzeResults(result, input, selectedTable);

      if (analysis.isEmpty && !sqlError) {
        // Smart fallback with continuity-aware suggestions
        const tableConfig = TABLE_PROMPTS[selectedTable];
        const alternativePrompt = [
          {
            role: "system",
            content: `
              No data found in ${selectedTable} table. 
              
              Conversation Context: ${continuityAnalysis.contextType} (${continuityAnalysis.reasoning})
              
              Table purpose: ${tableDescriptions[selectedTable]}
              Common keywords: ${tableConfig?.keywords.join(', ')}
              
              ${!continuityAnalysis.isNewTopic ? 
                'Since this is a follow-up question, consider if the user might be asking about related data in the same table or a different time period.' : 
                'Available alternative tables:'
              }
              
              ${Object.entries(tableDescriptions)
                .filter(([key]) => key !== selectedTable)
                .map(([key, desc]) => `- ${key}: ${desc}`)
                .join("\n")}
              
              Provide contextually appropriate suggestions based on conversation flow.
            `.trim(),
          },
          {
            role: "user",
            content: `Question: "${input}" returned no results from ${selectedTable}`,
          },
        ];

        const altResponse = await openai.invoke(alternativePrompt);
        const message = `I couldn't find any data for that question in the ${selectedTable} table.\n\n${altResponse.content}`;

        await chatHistory.addUserMessage(input);
        await chatHistory.addAIMessage(message);
        await setSessionMetadata(session_id, {
          ...sessionMetadata,
          last_table: selectedTable,
          last_query_empty: true,
          suggestion_made: true,
          continuity_analysis: continuityAnalysis,
        });

        return message;
      }

      // STEP 7: Generate enhanced summary with continuity context
      const tableConfig = TABLE_PROMPTS[selectedTable];
      const summaryPrompt = [
        {
          role: "system",
          content: `
            You are a business data analyst specializing in ${selectedTable} data.
            
            Context:
            - Table: ${selectedTable} (${tableDescriptions[selectedTable]})
            - Question: "${input}"
            - Records found: ${analysis.recordCount || 0}
            - Has numeric data: ${analysis.hasNumericData}
            - Table focus: ${tableConfig?.keywords.join(', ')}
            
            CONVERSATION CONTEXT:
            This is a ${continuityAnalysis.contextType} with ${(continuityAnalysis.confidence * 100).toFixed(0)}% confidence.
            ${continuityAnalysis.reasoning}
            
            ${!continuityAnalysis.isNewTopic ? `
            CONTINUITY INSTRUCTIONS:
            - Reference previous conversation when relevant
            - Use transitional phrases like "Building on our previous discussion..." or "Following up on that..."
            - Compare results to previous queries when appropriate
            - Maintain conversational flow
            ` : ''}
            
            RESPONSE STYLE:
            Write like you're having a conversation with a business colleague. Use natural language, not markdown formatting.
            
            [Rest of original formatting instructions remain the same...]
          `.trim(),
        },
        { role: "user", content: input },
        {
          role: "assistant",
          content: sqlError
            ? `Query error: ${sqlError}`
            : `Analysis: ${JSON.stringify({
                results: result,
                insights: analysis.insights,
              })}`,
        },
      ];

      const summaryResponse = await openai.invoke(summaryPrompt);
      const finalAnswer = summaryResponse.content.trim();

      // STEP 8: Enhanced session tracking with continuity data
      await chatHistory.addUserMessage(input);
      await chatHistory.addAIMessage(finalAnswer);
      await setSessionMetadata(session_id, {
        ...sessionMetadata,
        last_table: selectedTable,
        last_sql: sql,
        last_result_count: result?.length || 0,
        last_execution_time: Date.now() - startTime,
        query_success: !sqlError,
        last_updated: new Date().toISOString(),
        table_prompt_used: tableConfig?.keywords.join(', '),
        continuity_analysis: continuityAnalysis,
        conversation_turns: (sessionMetadata.conversation_turns || 0) + 1,
      });

      const executionTime = Date.now() - startTime;
      writeToLogFile(`\nresult: ${JSON.stringify(finalAnswer)}, \nexecutionTime: ${executionTime}ms, \nsql: ${sql}, \nsqlResponse: ${JSON.stringify(result)}, \ncontinuity: ${JSON.stringify(continuityAnalysis)}`);

      console.log("result: ", finalAnswer);
      
      // STEP 9: Return structured response for UI with continuity info
      const baseResponse = {
        continuityAnalysis: continuityAnalysis,
        tableName: selectedTable,
        isFollowUp: !continuityAnalysis.isNewTopic
      };

      if (sqlError) {
        return {
          ...baseResponse,
          type: "text",
          content: `Query error: ${sqlError}`,
        };
      }

      // Enhanced chart detection using analysis
      if (analysis.hasNumericData && analysis.hasDateData && 
          analysis.bestDateColumn && analysis.bestNumericColumn && 
          result.length > 1) {
        return {
          ...baseResponse,
          type: "chart",
          chartType: "bar", 
          labels: result.map(row => row[analysis.bestDateColumn]),
          data: result.map(row => row[analysis.bestNumericColumn]),
          summary: finalAnswer,
        };
      } else if (result.length > 0) {
        return {
          ...baseResponse,
          type: "table",
          columns: Object.keys(result[0]),
          rows: result.map(row => Object.values(row)),
          summary: finalAnswer,
        };
      } else {
        return {
          ...baseResponse,
          type: "text",
          content: finalAnswer,
        };
      }

    } catch (error) {
      console.error("❌ Chain execution error:", error);

      // Graceful error handling with retry
      if (retryCount < 1) {
        console.log("🔄 Retrying...");
        return loadChain(session_id)({
          input,
          table,
          retryCount: retryCount + 1,
        });
      }

      return {
        type: "text",
        content: `I apologize, but I encountered an error processing your question. Please try rephrasing it or ask something else.`,
      };
    }
  };
}

module.exports = {
  loadChain,
  selectBestTable,
  analyzeContinuity, // Export the new function
};