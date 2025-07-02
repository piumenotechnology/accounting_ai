const { openai } = require("../openaiService");
const { runSQL } = require("../databaseService");
// const fs = require('fs');

const { 
  getChatHistory, 
  getSessionMetadata, 
  setSessionMetadata,
  clearFailedQueries,
  getSuccessfulQueriesOnly 
} = require("./memoryServicePostgres");

// Import the table-specific prompts
const { getTablePrompt, selectBestTable } = require('./tablePrompts');

// function writeToLogFile(logMessage) {
//   const timestamp = new Date().toISOString();
//   const logEntry = `${timestamp} - ${logMessage}\n`;

//   fs.appendFile('app.log', logEntry, (err) => {
//     if (err) {
//       console.error('Error writing to log file:', err);
//     }
//   });
// };

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

// Enhanced conversation continuity detection with error handling
async function analyzeContinuity(input, pastMessages, sessionMetadata) {
  if (!pastMessages || pastMessages.length === 0) {
    return {
      isNewTopic: true,
      contextType: 'fresh_start',
      confidence: 1.0,
      reasoning: 'No previous conversation history'
    };
  }

  // Filter out failed queries for better continuity analysis
  const successfulMessages = pastMessages.filter(msg => 
    !msg.content.includes('Query error:') && 
    !msg.content.includes('SQL Error:') &&
    !msg.content.includes('encountered an error')
  );

  const recentMessages = successfulMessages.slice(-6);
  const lastUserMessage = recentMessages.filter(m => m._getType?.() === 'human' || m.role === 'user').pop();
  const lastAiMessage = recentMessages.filter(m => m._getType?.() === 'ai' || m.role === 'assistant').pop();

  const timeSinceLastQuery = sessionMetadata.last_updated ? 
    (Date.now() - new Date(sessionMetadata.last_updated).getTime()) / (1000 * 60) : null;

  const continuityPrompt = [
    {
      role: "system",
      content: `
        You are a conversation continuity analyzer. Determine if the user's new question is:
        1. A NEW TOPIC - completely unrelated to previous conversation
        2. A CONTINUATION - following up, drilling down, or related to previous discussion
        3. A CLARIFICATION - asking for more details about the last response
        4. A MODIFICATION - similar question with different parameters
        5. A RETRY - repeating a question that may have failed previously

        Context factors to consider:
        - Time gap: ${timeSinceLastQuery ? `${Math.round(timeSinceLastQuery)} minutes ago` : 'unknown'}
        - Last successful table: ${sessionMetadata.last_successful_table || 'none'}
        - Recent failures: ${sessionMetadata.recent_failures || 0}
        - Last successful query: ${sessionMetadata.last_successful_query ? 'yes' : 'no'}

        IMPORTANT: If this looks like a retry of a failed question, classify as "new_topic" to avoid referencing failed context.

        Respond with JSON only:
        {
          "isNewTopic": boolean,
          "contextType": "fresh_start|continuation|clarification|modification|new_topic|retry",
          "confidence": 0.0-1.0,
          "reasoning": "brief explanation",
          "suggestedTable": "table_name or null",
          "contextElements": ["key phrases that influenced decision"],
          "isRetry": boolean
        }
      `.trim()
    },
    {
      role: "user", 
      content: `
        Previous successful conversation context:
        Last user question: "${lastUserMessage?.content || 'None'}"
        Last AI response: "${lastAiMessage?.content?.substring(0, 200) || 'None'}..."
        Recent failures count: ${sessionMetadata.recent_failures || 0}
        
        Current question: "${input}"
        
        Analyze continuity:
      `.trim()
    }
  ];
  try {
    const response = await openai.invoke(continuityPrompt);
    const analysis = JSON.parse(response.content);
    
    // Adjust confidence based on recent failures
    if (sessionMetadata.recent_failures > 0) {
      analysis.confidence *= 0.8;
    }
    
    if (timeSinceLastQuery && timeSinceLastQuery > 30) {
      analysis.confidence *= 0.7;
    }
    
    return analysis;
  } catch (error) {
    console.error("❌ Continuity analysis error:", error);
  return {
    isNewTopic: true, // Default to new topic to avoid referencing potentially failed context
    contextType: 'new_topic',
    confidence: 0.5,
    reasoning: 'Fallback analysis due to error',
    isRetry: false
  };
  }
}

// Enhanced context building with error filtering
function buildContextualPrompt(input, continuityAnalysis, pastMessages, sessionMetadata, selectedTable) {
  const baseTablePrompt = getTablePrompt(selectedTable, input, sessionMetadata);
  
  // For new topics or retries, use clean table prompt
  if (continuityAnalysis.isNewTopic || continuityAnalysis.isRetry) {
    return baseTablePrompt;
  }

  // Filter out failed queries from context
  const cleanMessages = pastMessages.filter(msg => 
    !msg.content.includes('Query error:') && 
    !msg.content.includes('SQL Error:') &&
    !msg.content.includes('encountered an error')
  );

  const recentContext = cleanMessages.slice(-4);
  
  const contextualEnhancement = `
    CONVERSATION CONTEXT:
    This question is a ${continuityAnalysis.contextType} (confidence: ${continuityAnalysis.confidence.toFixed(2)}).
    Reasoning: ${continuityAnalysis.reasoning}
    
    Recent successful conversation:
    ${recentContext.map(m => `${m._getType?.() || m.role}: ${m.content}`).join('\n')}
    
    CONTINUITY INSTRUCTIONS:
    - Reference previous successful results when relevant
    - Use "the previous data showed" or "building on that"
    - Maintain context about filters, date ranges, or specific entities mentioned
    - If user says "show me more" or "what about X", relate back to previous successful query
    - Keep the same table focus unless explicitly asked to change
    
    CRITICAL: You must ALWAYS return valid SQL that starts with SELECT. Never return explanatory text or summaries.
    
    ${baseTablePrompt}
  `.trim();
  
  return contextualEnhancement;
}

function cleanSQL(text) {
  // More robust SQL extraction
  let sql = text
    .toLowerCase()
    .trim()
    .replace(/```sql|```/gi, "")
    .replace(/^[^s]*select/i, 'select') // Remove any text before SELECT
    .trim();

  // If no SELECT found, this might be a text response instead of SQL
  if (!sql.includes('select')) {
    console.warn("⚠️ No SELECT statement found in response:", text);
    return null;
  }

  return sql;
}

// Enhanced SQL validation
function validateAndOptimizeSQL(sql, tableName) {
  const issues = [];
  const suggestions = [];

  if (!sql) {
    issues.push("No valid SQL query generated");
    return { issues, suggestions, isValid: false };
  }

  if (!sql.toLowerCase().startsWith("select")) {
    issues.push("Query must start with SELECT");
  }

  if (!sql.includes(tableName)) {
    issues.push(`Query should reference table: ${tableName}`);
  }

  if (!sql.includes("limit") && !sql.includes("count") && !sql.includes("sum")) {
    suggestions.push("Consider adding LIMIT for large datasets");
  }

  if (sql.includes("select *")) {
    suggestions.push("Consider selecting specific columns for better performance");
  }

  return { issues, suggestions, isValid: issues.length === 0 };
}

// Result analysis remains the same
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

  let bestNumericColumn = null;
  let bestDateColumn = null;
  
  if (numericColumns.length > 0) {
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

// Main chain with enhanced error handling and recovery
async function loadChain(session_id) {
  const chatHistory = getChatHistory(session_id);

  return async ({ input, table = null, retryCount = 0 }) => {
    const startTime = Date.now();
    let sqlError = null;
    let sql = null;
    let selectedTable = null;

    try {
      // Get only successful messages for context (filtered in PostgreSQL service)
      const pastMessages = await getSuccessfulQueriesOnly(session_id);
      const sessionMetadata = (await getSessionMetadata(session_id)) || {};

      // STEP 1: Analyze conversation continuity with error awareness
      const continuityAnalysis = await analyzeContinuity(input, pastMessages, sessionMetadata);
      console.log("🔄 Continuity Analysis:", continuityAnalysis);

      // STEP 2: Enhanced table selection
      selectedTable = table?.toLowerCase();
      if (!selectedTable) {
        if (!continuityAnalysis.isNewTopic && 
            !continuityAnalysis.isRetry &&
            sessionMetadata.last_successful_table && 
            continuityAnalysis.confidence > 0.6) {
          selectedTable = sessionMetadata.last_successful_table;
          console.log("🔄 Using previous successful table:", selectedTable);
        } else {
          selectedTable = continuityAnalysis.suggestedTable || 
                        await selectBestTable(input, pastMessages, sessionMetadata);
        }
        console.log("🎯 Selected table:", selectedTable);
      }

      // STEP 3: Generate SQL with enhanced error recovery
      const tablePrompt = buildContextualPrompt(
        input, 
        continuityAnalysis, 
        pastMessages, 
        sessionMetadata, 
        selectedTable
      );

      // Build SQL prompt with emphasis on returning valid SQL
      const sqlPrompt = [
        {
          role: "system",
          content: `${tablePrompt}

CRITICAL REQUIREMENTS:
1. You MUST return ONLY a valid SQL SELECT statement
2. Do NOT return explanations, summaries, or text
3. The SQL must start with SELECT and reference the ${selectedTable} table
4. If you cannot generate SQL, return: SELECT 'ERROR: Cannot generate query' as error_message;`
        },
        // Only include recent successful context
        ...pastMessages.slice(-2).map((m) => ({
          role: m._getType?.() || m.role,
          content: m.content,
        })),
        { role: "user", content: `Generate SQL for: ${input}` },
      ];

      const sqlResponse = await openai.invoke(sqlPrompt);
      sql = cleanSQL(sqlResponse.content);

      // STEP 4: Enhanced SQL validation with fallback
      if (!sql) {
        console.warn("⚠️ No valid SQL generated, attempting fallback");
        
        // Fallback: Try with simpler prompt
        const fallbackPrompt = [
          {
            role: "system",
            content: `Generate a simple SQL SELECT query for the ${selectedTable} table to answer: "${input}". Return ONLY the SQL query, nothing else.`
          },
          { role: "user", content: input }
        ];
        
        const fallbackResponse = await openai.invoke(fallbackPrompt);
        sql = cleanSQL(fallbackResponse.content);
        
        if (!sql) {
          throw new Error("Failed to generate valid SQL query");
        }
      }

      const validation = validateAndOptimizeSQL(sql, selectedTable);
      if (!validation.isValid) {
        console.warn("⚠️ SQL validation issues:", validation.issues);
        if (retryCount === 0) {
          // Try once more with validation feedback
          return loadChain(session_id)({
            input: `${input} (Previous attempt had issues: ${validation.issues.join(', ')})`,
            table: selectedTable,
            retryCount: retryCount + 1,
          });
        }
      }

      console.log("🔍 Session ID:", session_id);
      console.log("🔍 Selected table:", selectedTable);
      console.log("🔍 Input question:", input);
      console.log("⚡ Generated SQL:", sql);

      if (!sql.toLowerCase().startsWith("select")) {
        throw new Error("Only SELECT queries are supported");
      }

      // STEP 5: Execute with timeout
      let result;
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
        
        // Update failure tracking
        await setSessionMetadata(session_id, {
          ...sessionMetadata,
          recent_failures: (sessionMetadata.recent_failures || 0) + 1,
          last_error: sqlError,
          last_failed_sql: sql,
          last_updated: new Date().toISOString(),
        });

        // For SQL errors, try alternative approach on first retry
        if (retryCount === 0 && !sqlError.includes('timeout')) {
          console.log("🔄 Retrying with different approach...");
          return loadChain(session_id)({
            input: `Create a simpler query for: ${input}`,
            table: selectedTable,
            retryCount: retryCount + 1,
          });
        }

        throw new Error(sqlError);
      }

      // STEP 6: Analyze results
      const analysis = analyzeResults(result, input, selectedTable);

      if (analysis.isEmpty && !sqlError) {
        // Handle empty results
        const alternativePrompt = [
          {
            role: "system",
            content: `
              No data found in ${selectedTable} table for the query: "${input}"
              
              Table purpose: ${tableDescriptions[selectedTable]}
              
              Suggest alternative approaches or tables:
              ${Object.entries(tableDescriptions)
                .filter(([key]) => key !== selectedTable)
                .map(([key, desc]) => `- ${key}: ${desc}`)
                .join("\n")}
            `.trim(),
          },
          {
            role: "user",
            content: `Question: "${input}" returned no results from ${selectedTable}`,
          },
        ];

        const altResponse = await openai.invoke(alternativePrompt);
        const message = `I couldn't find any data for that question in the ${selectedTable} table.\n\n${altResponse.content}`;

        // Save successful interaction (even if empty results)
        await chatHistory.addUserMessage(input);
        await chatHistory.addAIMessage(message);
        await setSessionMetadata(session_id, {
          ...sessionMetadata,
          last_successful_table: selectedTable,
          last_query_empty: true,
          recent_failures: 0, // Reset failures on successful execution
          last_updated: new Date().toISOString(),
        });

        return { type: "text", content: message };
      }

      // STEP 7: Generate summary (only if we have results)
      const summaryPrompt = [
        {
          role: "system",
          content: `
            You are a business data analyst. Summarize the query results naturally.
            
            Context:
            - Table: ${selectedTable}
            - Question: "${input}"
            - Records: ${analysis.recordCount || 0}
            
            Write conversationally, not in markdown. Be concise and insightful.
          `.trim(),
        },
        { role: "user", content: input },
        {
          role: "assistant",
          content: `Results: ${JSON.stringify(result.slice(0, 5))}${result.length > 5 ? ` (showing first 5 of ${result.length} records)` : ''}`,
        },
      ];

      const summaryResponse = await openai.invoke(summaryPrompt);
      const finalAnswer = summaryResponse.content.trim();

      // STEP 8: Save successful interaction
      await chatHistory.addUserMessage(input);
      await chatHistory.addAIMessage(finalAnswer);
      await setSessionMetadata(session_id, {
        ...sessionMetadata,
        last_successful_table: selectedTable,
        last_sql: sql,
        last_result_count: result?.length || 0,
        last_execution_time: Date.now() - startTime,
        recent_failures: 0, // Reset failures on success
        last_updated: new Date().toISOString(),
        continuity_analysis: continuityAnalysis,
        conversation_turns: (sessionMetadata.conversation_turns || 0) + 1,
      });

      // Clear old failed queries periodically
      if ((sessionMetadata.conversation_turns || 0) % 10 === 0) {
        await clearFailedQueries(session_id);
      }

      const executionTime = Date.now() - startTime;
      // writeToLogFile(`SUCCESS - Session: ${session_id}, Time: ${executionTime}ms, SQL: ${sql}, Results: ${result.length} rows`);

      console.log("✅ Success:", finalAnswer);
      
      // STEP 9: Return structured response
      const baseResponse = {
        continuityAnalysis: continuityAnalysis,
        tableName: selectedTable,
        isFollowUp: !continuityAnalysis.isNewTopic,
        executionTime: executionTime
      };

      // Enhanced chart detection
      if (analysis.hasNumericData && analysis.hasDateData && 
          analysis.bestDateColumn && analysis.bestNumericColumn && 
          result.length > 1) {
        return {
          // ...baseResponse,
          type: "chart",
          chartType: "bar", 
          labels: result.map(row => row[analysis.bestDateColumn]),
          data: result.map(row => row[analysis.bestNumericColumn]),
          sql: sql,
          summary: finalAnswer,
        };
      } else if (result.length > 0) {
        return {
          // ...baseResponse,
          type: "table",
          columns: Object.keys(result[0]),
          rows: result.map(row => Object.values(row)),
          sql: sql,
          summary: finalAnswer,
        };
      } else {
        return {
          // ...baseResponse,
          type: "text",
          sql: sql,
          content: finalAnswer,
        };
      }

    } catch (error) {
      console.error("❌ Chain execution error:", error);
      
      // Log the failure
      // writeToLogFile(`ERROR - Session: ${session_id}, Error: ${error.message}, SQL: ${sql || 'none'}, Retry: ${retryCount}`);

      // Don't save failed attempts to chat history to avoid contaminating future queries
      const errorMessage = retryCount > 0 ? 
        `I'm having trouble processing that question. Could you try rephrasing it or asking something different?` :
        `Let me try a different approach to answer your question.`;

      // One retry with different strategy
      if (retryCount < 1) {
        console.log("🔄 Retrying with different strategy...");
        return loadChain(session_id)({
          input: `Please create a simple query to ${input}`,
          table: table,
          retryCount: retryCount + 1,
        });
      }

      return {
        type: "text",
        content: errorMessage,
        error: true
      };
    }
  };
}

module.exports = {
  loadChain,
  selectBestTable,
  analyzeContinuity,
};