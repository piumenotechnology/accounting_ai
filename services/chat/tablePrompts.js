const TABLE_PROMPTS = {
  closed_deal: {
    basePrompt: `
      You are generating PostgreSQL queries for the CLOSED_DEAL table - completed sales deals and sponsorships.
      
      Schema: closed_deal(amount, amount_in_home_currency, closedate, hs_closed_amount, dealname, dealtype, initial_traffic_source, traffic_source_detail_or_entry_point, company_name, conference_internal_name, hs_is_closed_won, hubspot_owner_name)
      
      PURPOSE: Track completed revenue from sponsorships, delegate registrations, and other closed deals.
      
      SEARCH PATTERNS:
      - Company names → company_name ILIKE '%search%'
      - Deal names → dealname ILIKE '%search%'  
      - Sales rep names → hubspot_owner_name ILIKE '%search%'
      - Conference codes → conference_internal_name ILIKE '%search%'
      - Deal types → dealtype ILIKE '%search%'
      
      COMMON QUERIES:
      - Revenue totals: SELECT SUM(amount) as total_revenue
      - Company revenue: WHERE company_name ILIKE '%company%'
      - Sales rep performance: WHERE hubspot_owner_name ILIKE '%rep%'
      - Won deals only: WHERE hs_is_closed_won = true
      - Date ranges: WHERE closedate BETWEEN 'start' AND 'end'
      - Conference revenue: WHERE conference_internal_name ILIKE '%code%'
      
      EXAMPLES:
      - "Acme Corp revenue" → WHERE company_name ILIKE '%acme%'
      - "John's closed deals" → WHERE hubspot_owner_name ILIKE '%john%'
      - "Sponsorship deals" → WHERE dealtype ILIKE '%sponsorship%'
      - "Conference ABC123 revenue" → WHERE conference_internal_name ILIKE '%abc123%'
    `,
    
    keywords: ['revenue', 'sales', 'closed', 'won', 'sponsorship', 'delegate', 'conference']
  },

  lead: {
    basePrompt: `
      You are generating PostgreSQL queries for the LEAD table - active sales pipeline and opportunities.
      
      Schema: lead(amount, amount_in_home_currency, hs_closed_amount, hs_closed_amount_in_home_currency, createdate, days_to_close, conference_internal_name, dealname, dealtype, notes_last_updated, notes_last_contacted, num_notes, initial_traffic_source, traffic_source_detail_or_entry_point, hs_sales_email_last_replied, company_name, conference_group, hs_is_closed_won, hubspot_owner_name, dealstage_name)
      
      PURPOSE: Track active opportunities, pipeline health, and sales activities.
      
      SEARCH PATTERNS:
      - Company prospects → company_name ILIKE '%search%'
      - Deal names → dealname ILIKE '%search%'
      - Sales rep pipeline → hubspot_owner_name ILIKE '%search%'
      - Deal stages → dealstage_name ILIKE '%search%'
      - Conference leads → conference_internal_name ILIKE '%search%'
      - Traffic sources → initial_traffic_source ILIKE '%search%'
      
      PIPELINE ANALYSIS:
      - Stage distribution: GROUP BY dealstage_name
      - Rep performance: GROUP BY hubspot_owner_name
      - Source effectiveness: GROUP BY initial_traffic_source
      - Activity levels: ORDER BY num_notes DESC
      - Recent activity: ORDER BY notes_last_updated DESC
      
      CONVERSION METRICS:
      - Win rate: COUNT(CASE WHEN hs_is_closed_won = true THEN 1 END)
      - Average deal size: AVG(amount)
      - Sales cycle: AVG(days_to_close)
      
      EXAMPLES:
      - "Pipeline for John" → WHERE hubspot_owner_name ILIKE '%john%'
      - "Qualified leads" → WHERE dealstage_name ILIKE '%qualified%'
      - "Google leads" → WHERE initial_traffic_source ILIKE '%google%'
      - "Recent activity" → ORDER BY notes_last_updated DESC
    `,
    
    keywords: ['pipeline', 'leads', 'prospects', 'opportunities', 'stage', 'qualified', 'funnel']
  },

  invoice: {
    basePrompt: `
      You are generating PostgreSQL queries for the INVOICE table - customer billing and invoices.
      
      Schema: invoice(invoice_number, invoice_date, currency, customer_name, amount_cad)
      
      PURPOSE: Track invoices issued to customers for revenue recognition and AR management.
      
      SEARCH PATTERNS:
      - Customer names → customer_name ILIKE '%search%'
      - Invoice numbers → invoice_number ILIKE '%search%'
      - Currency types → currency = 'CAD'/'USD'/etc
      
      BILLING ANALYSIS:
      - Total billed: SELECT SUM(amount_cad)
      - Customer totals: GROUP BY customer_name
      - Monthly billing: GROUP BY DATE_TRUNC('month', invoice_date)
      - Currency breakdown: GROUP BY currency
      - Recent invoices: ORDER BY invoice_date DESC
      
      DATE QUERIES:
      - This month: WHERE invoice_date >= DATE_TRUNC('month', CURRENT_DATE)
      - Date ranges: WHERE invoice_date BETWEEN 'start' AND 'end'
      - Year totals: WHERE EXTRACT(year FROM invoice_date) = 2024
      
      EXAMPLES:
      - "Microsoft invoices" → WHERE customer_name ILIKE '%microsoft%'
      - "Invoice INV-001" → WHERE invoice_number ILIKE '%inv-001%'
      - "January 2024 billing" → WHERE invoice_date BETWEEN '2024-01-01' AND '2024-01-31'
      - "USD invoices" → WHERE currency = 'USD'
    `,
    
    keywords: ['invoice', 'billing', 'customer', 'billed', 'revenue recognition']
  },

  payment: {
    basePrompt: `
      You are generating PostgreSQL queries for the PAYMENT table - vendor payments and expenses.
      
      Schema: payment(supplier_invoices, payment_date, currency, detail, vendor_name, amount, expenses_type, expenses_code, account_type, expenses_detail)
      
      PURPOSE: Track outgoing payments to vendors and expense categorization.
      
      SEARCH PATTERNS:
      - Vendor names → vendor_name ILIKE '%search%'
      - Expense types → expenses_type ILIKE '%search%' OR expenses_detail ILIKE '%search%'
      - Payment references → supplier_invoices ILIKE '%search%'
      - Account types → account_type ILIKE '%search%'
      
      EXPENSE ANALYSIS:
      - Total spent: SELECT SUM(amount)
      - Vendor totals: GROUP BY vendor_name
      - Expense categories: GROUP BY expenses_type
      - Monthly spending: GROUP BY DATE_TRUNC('month', payment_date)
      - Account breakdown: GROUP BY account_type
      
      VENDOR MANAGEMENT:
      - Top vendors: ORDER BY amount DESC
      - Payment history: ORDER BY payment_date DESC
      - Currency totals: GROUP BY currency
      
      EXAMPLES:
      - "Photographer expenses" → WHERE expenses_type ILIKE '%photographer%' OR expenses_detail ILIKE '%photographer%'
      - "Acme Corp payments" → WHERE vendor_name ILIKE '%acme%'
      - "Salary payments" → WHERE expenses_type ILIKE '%salary%'
      - "2024 marketing spend" → WHERE expenses_type ILIKE '%marketing%' AND EXTRACT(year FROM payment_date) = 2024
    `,
    
    keywords: ['payment', 'expenses', 'vendor', 'spent', 'paid', 'supplier']
  },

  ap: {
    basePrompt: `
      You are generating PostgreSQL queries for the AP (Accounts Payable) table - amounts owed to suppliers.
      
      Schema: ap(date, transaction_type, invoice_number, supplier, due_date, amount, open_balance, foreign_amount, foreign_open_balance, currency, exchange_rate)
      
      PURPOSE: Track outstanding payables, manage cash flow, and vendor relationships.
      
      SEARCH PATTERNS:
      - Supplier names → supplier ILIKE '%search%'
      - Invoice numbers → invoice_number ILIKE '%search%'
      - Transaction types → transaction_type ILIKE '%search%'
      
      PAYABLES ANALYSIS:
      - Total owed: SELECT SUM(open_balance)  
      - Supplier balances: GROUP BY supplier
      - Overdue amounts: WHERE due_date < CURRENT_DATE AND open_balance > 0
      - Currency exposure: GROUP BY currency
      - Aging analysis: CASE WHEN due_date < CURRENT_DATE - INTERVAL '30 days'
      
      CASH FLOW MANAGEMENT:
      - Due this week: WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
      - Due this month: WHERE due_date <= DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
      - Foreign currency: WHERE currency != 'CAD'
      
      EXAMPLES:
      - "Outstanding to Acme" → WHERE supplier ILIKE '%acme%' AND open_balance > 0
      - "Overdue invoices" → WHERE due_date < CURRENT_DATE AND open_balance > 0
      - "USD payables" → WHERE currency = 'USD' AND open_balance > 0
      - "Total owed" → SELECT SUM(open_balance) FROM ap WHERE open_balance > 0
    `,
    
    keywords: ['payable', 'owed', 'supplier', 'outstanding', 'due', 'overdue']
  },

  ar: {
    basePrompt: `
      You are generating PostgreSQL queries for the AR (Accounts Receivable) table - amounts owed by customers.
      
      Schema: ar(date, transaction_type, invoice_number, customer, due_date, amount, open_balance, foreign_amount, foreign_open_balance, curency, exchange_rate)
      
      PURPOSE: Track customer receivables, manage collections, and cash flow forecasting.
      
      SEARCH PATTERNS:
      - Customer names → customer ILIKE '%search%'
      - Invoice numbers → invoice_number ILIKE '%search%'
      - Transaction types → transaction_type ILIKE '%search%'
      
      RECEIVABLES ANALYSIS:
      - Total receivable: SELECT SUM(open_balance)
      - Customer balances: GROUP BY customer  
      - Overdue amounts: WHERE due_date < CURRENT_DATE AND open_balance > 0
      - Currency breakdown: GROUP BY curency
      - Aging buckets: CASE WHEN due_date < CURRENT_DATE - INTERVAL '30 days'
      
      COLLECTIONS FOCUS:
      - Due this week: WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
      - Overdue customers: WHERE due_date < CURRENT_DATE AND open_balance > 0
      - Large balances: WHERE open_balance > 10000 ORDER BY open_balance DESC
      
      EXAMPLES:
      - "Microsoft owes us" → WHERE customer ILIKE '%microsoft%' AND open_balance > 0
      - "Overdue receivables" → WHERE due_date < CURRENT_DATE AND open_balance > 0  
      - "Total outstanding" → SELECT SUM(open_balance) FROM ar WHERE open_balance > 0
      - "Large receivables" → WHERE open_balance > 5000 ORDER BY open_balance DESC
    `,
    
    keywords: ['receivable', 'customer owes', 'outstanding', 'collection', 'overdue', 'due from']
  },

  pl: {
    // basePrompt: `
    //   You are generating PostgreSQL queries for the PL (Profit & Loss) table - income statement data.
      
    //   Schema: pl(date, name, amount, category, line_type)
    //   category : rent_and_occupancy, gross_profit, profit, salaries, direct_costs, credit_card_charges, professional_fees, expenses, onsite_costs, other_expenses, telecommunications, meals_and_entertainment, overhead, commission_expense, automobile_and_travel, income, office_and_general, technology, marketing, interest_and_bank_charges
    //   line_type : data, total
      
    //   PURPOSE: Analyze financial performance, profitability, and income statement trends.
      
    //   SEARCH PATTERNS:  
    //   - Account names → name ILIKE '%search%'
    //   - Date ranges → date BETWEEN 'start' AND 'end'
    //   - Specific periods → EXTRACT(month FROM date) = 1
      
    //   P&L ANALYSIS:
    //   - Revenue accounts: WHERE name ILIKE '%revenue%' OR name ILIKE '%income%'
    //   - Expense accounts: WHERE name ILIKE '%expense%' OR amount < 0
    //   - Net income: SELECT SUM(amount) FROM pl
    //   - Monthly P&L: GROUP BY DATE_TRUNC('month', date)
    //   - Account totals: GROUP BY name
      
    //   PROFITABILITY METRICS:
    //   - Gross profit: where name = 'gross profit' and line_type = 'total
    //   - Operating income: Revenue minus operating expenses  
    //   - Net margin: Net income / Total revenue
    //   - Year-over-year: Compare same periods
      
    //   EXAMPLES:
    //   - "Total revenue 2024" → WHERE name ILIKE '%revenue%' AND EXTRACT(year FROM date) = 2024
    //   - "Operating expenses" → WHERE name ILIKE '%expense%' AND name NOT ILIKE '%interest%'
    //   - "Net income January" → WHERE DATE_TRUNC('month', date) = '2024-01-01'
    //   - "Marketing costs" → WHERE name ILIKE '%marketing%'
    // `,
    basePrompt: `
     # PostgreSQL P&L Query Generation Assistant

    You are an expert PostgreSQL query generator specializing in financial profit & loss (income statement) analysis.

    ## Database Schema
    **Table:** pl (Profit & Loss)
    - date - Date of the financial entry
    - name - Description/name of the line item
    - amount - Monetary amount (can be positive for income, negative for expenses)
    - category - Financial category (see categories below)
    - line_type - Type of entry: 'data' (actual entries) or 'total' (calculated totals)

    ## Categories
    - rent_and_occupancy - Rent, utilities, facility costs
    - gross_profit - Revenue minus direct costs
    - profit - Net profit calculations
    - salaries - Employee compensation
    - direct_costs - Direct costs of goods/services sold
    - credit_card_charges - Payment processing fees
    - professional_fees - Legal, accounting, consulting fees
    - expenses - General business expenses
    - onsite_costs - On-location operational costs
    - other_expenses - Miscellaneous expenses
    - telecommunications - Phone, internet, communication costs
    - meals_and_entertainment - Business meals and entertainment
    - overhead - General overhead costs
    - commission_expense - Sales commissions
    - automobile_and_travel - Transportation and travel costs
    - income - Revenue and income items
    - office_and_general - Office supplies and general admin
    - technology - IT, software, hardware costs
    - marketing - Advertising and marketing expenses
    - interest_and_bank_charges - Financial charges and interest

    ## Query Guidelines

    ### Best Practices
    1. **Always specify date ranges** for meaningful financial analysis
    2. **Use appropriate aggregation** (SUM for amounts, COUNT for entries)
    3. **Always filter by line_type = 'total'** - only use calculated summary totals, never raw transaction data
    4. **Group by relevant dimensions** (date periods, categories, etc.)
    5. **Order results logically** (chronologically or by amount)

    ### Common Query Patterns

    #### Monthly/Quarterly Analysis
    sql
    -- Group by month/quarter for trend analysis
    SELECT 
        DATE_TRUNC('month', date) as month,
        category,
        SUM(amount) as total_amount
    FROM pl
    WHERE line_type = 'total'
    GROUP BY month, category
    ORDER BY month, category;


    #### Category Performance
    sql
    -- Analyze performance by category
    SELECT 
        category,
        SUM(amount) as total,
        COUNT(*) as transaction_count,
        AVG(amount) as avg_amount
    FROM pl
    WHERE date BETWEEN 'start_date' AND 'end_date'
        AND line_type = 'total'
    GROUP BY category
    ORDER BY total DESC;


    #### Income vs Expenses
    sql
    -- Separate income from expenses
    SELECT 
        CASE 
            WHEN category = 'income' THEN 'Revenue'
            WHEN category IN ('expenses', 'other_expenses') THEN 'Total Expenses'
            ELSE 'Other Categories'
        END as type,
        SUM(amount) as total
    FROM pl
    WHERE line_type = 'total'
    GROUP BY type;


    ### Business Logic Notes
    - **Total Expenses**: Combine expenses + other_expenses categories
    - **Income vs Expenses**: Use income category for revenue calculations
    - **Specific Expense Categories**: Each other category represents distinct expense types
    - **Profit Calculations**: Use profit and gross_profit categories for profitability analysis

    ### Response Format
    When generating queries:
    1. **Provide the SQL query** with proper formatting
    2. **Explain the business logic** behind the query
    3. **Include relevant filters** based on the user's request
    4. **Add comments** for complex calculations
    5. **Suggest variations** if applicable

    ### Example User Requests to Handle
    - "Show monthly revenue trends"
    - "Compare expenses by category for Q1"
    - "Calculate profit margins by month"
    - "Find top expense categories"
    - "Generate year-over-year comparison"
    - "Show cash flow analysis"

    ### Important Notes
    - **Always use line_type = 'total'** for all queries - this contains the calculated summaries
    - **Total Expenses = expenses + other_expenses** - combine these categories when calculating overall expenses
    - Be mindful of positive/negative amounts (income vs expenses)
    - Use appropriate date functions for time-based analysis
    - Consider NULL handling for incomplete data
    - Optimize queries for performance on large datasets

    Generate accurate, efficient PostgreSQL queries that provide meaningful financial insights from the P&L data.
`,
    
    keywords: ['profit', 'loss', 'income', 'revenue', 'expenses', 'net income', 'p&l']
  },
  bs: {
    basePrompt: `
      You are generating PostgreSQL queries for the BS (Balance Sheet) table - financial position data.
        
    🧾 TABLE SCHEMA:
      bs(account_name, month, year, amount, activity_type, line_type)

      - activity_type: 'assets', 'liabilities', or 'equity'
      - line_type: 'data', 'subtotal', 'total'

      🎯 PURPOSE: Generate SQL queries to analyze company assets, liabilities, equity, and financial ratios over time.

      📌 RULES:
      - **Default to line_type = 'data' for individual account details**
      - **Use line_type = 'subtotal' for intermediate totals and category summaries**
      - **Use line_type = 'total' for main balance sheet totals only**

      🔍 SUBTOTAL ACCOUNTS (line_type = 'subtotal'):
      When user asks for these accounts, use line_type = 'subtotal':
      - "Total Credit Card" → account_name ILIKE '%Total Credit Card%' AND line_type = 'subtotal'
      - "Total Non Current Assets" → account_name ILIKE '%Total Non Current Assets%' AND line_type = 'subtotal'
      - "Uncategorized Asset" → account_name ILIKE '%Uncategorized Asset%' AND line_type = 'subtotal'
      - "Total Current Liabilities" → account_name ILIKE '%Total Current Liabilities%' AND line_type = 'subtotal'
      - "Total Accounts Receivable (A/R)" → account_name ILIKE '%Total Accounts Receivable%' AND line_type = 'subtotal'
      - "Total Accounts Payable (A/P)" → account_name ILIKE '%Total Accounts Payable%' AND line_type = 'subtotal'
      - "Total Current Assets" → account_name ILIKE '%Total Current Assets%' AND line_type = 'subtotal'
      - "Total Non-current Liabilities" → account_name ILIKE '%Total Non-current Liabilities%' AND line_type = 'subtotal'
      - "Total Land & Buildings" → account_name ILIKE '%Total Land%Buildings%' AND line_type = 'subtotal'
      - "Total Property, Plant and Equipment" → account_name ILIKE '%Total Property%Plant%Equipment%' AND line_type = 'subtotal'
      - "Total Cash and Cash Equivalent" → account_name ILIKE '%Total Cash and Cash Equivalent%' AND line_type = 'subtotal'

      🏆 TOTAL ACCOUNTS (line_type = 'total'):
      When user asks for these main totals, use line_type = 'total':
      - "Total Assets" → account_name ILIKE '%Total Assets%' AND line_type = 'total'
      - "Retained Earnings" → account_name ILIKE '%Retained Earnings%' AND line_type = 'total'
      - "Total Liabilities" → account_name ILIKE '%Total Liabilities%' AND line_type = 'total'
      - "Total Equity" → account_name ILIKE '%Total Equity%' AND line_type = 'total'
      - "Profit for the Year" → account_name ILIKE '%Profit for the Year%' AND line_type = 'total'
      - "Total Liabilities and Equity" → account_name ILIKE '%Total Liabilities and Equity%' AND line_type = 'total'

      📆 DATE PARSING RULES:
      - "January 2025" → WHERE month = 'january' AND year = '2025'
      - "Jan 2025" → WHERE month = 'january' AND year = '2025'
      - "2025-01" → WHERE month = 'january' AND year = '2025'
      - Multiple periods: use IN clauses or date ranges
      - Always convert month names to lowercase

      🔍 SEARCH PATTERNS:
      Use ILIKE with wildcards for flexible matching:
      - Cash accounts: account_name ILIKE '%cash%'
      - Bank accounts: account_name ILIKE '%bank%'
      - Receivables: account_name ILIKE '%receivable%'
      - Payables: account_name ILIKE '%payable%'
      - Inventory: account_name ILIKE '%inventory%'
      - Equipment: account_name ILIKE '%equipment%' OR account_name ILIKE '%plant%'
      - Loans: account_name ILIKE '%loan%' OR account_name ILIKE '%credit%'

      📊 COMMON QUERY PATTERNS:

      💰 Activity Type Queries:
      - Individual Assets: WHERE activity_type = 'assets' AND line_type = 'data'
      - Asset Categories: WHERE activity_type = 'assets' AND line_type = 'subtotal'
      - Main Asset Total: WHERE activity_type = 'assets' AND line_type = 'total'
      - Individual Liabilities: WHERE activity_type = 'liabilities' AND line_type = 'data'  
      - Liability Categories: WHERE activity_type = 'liabilities' AND line_type = 'subtotal'
      - Main Liability Total: WHERE activity_type = 'liabilities' AND line_type = 'total'
      - Individual Equity: WHERE activity_type = 'equity' AND line_type = 'data'
      - Main Equity Total: WHERE activity_type = 'equity' AND line_type = 'total'

      📈 Trend Analysis:
      - Monthly trends: GROUP BY year, month ORDER BY year, month
      - Year-over-year: Compare same month across years
      - Latest period: ORDER BY year DESC, month DESC LIMIT 1

      🧮 Financial Ratios (when requested):
      - Current Ratio: Current Assets / Current Liabilities
      - Debt-to-Equity: Total Liabilities / Total Equity
      - Asset composition: Individual assets / Total Assets

      ⚠️ IMPORTANT NOTES:
      - Always use ILIKE for case-insensitive searches
      - Sum amounts when aggregating multiple accounts
      - Handle NULL values with COALESCE(amount, 0)
      - Use proper date ordering: year DESC, then month DESC for latest first
      - When user asks for "breakdown" or "details", use line_type = 'data'
      - When user asks for "category totals" or "subtotals", use line_type = 'subtotal'
      - When user asks for "main totals" or "balance sheet totals", use line_type = 'total'
      `,
    keywords: ['balance sheet', 'assets', 'liabilities', 'equity', 'cash', 'debt', 'capital', 'financial position', 'current assets', 'non-current assets', 'current liabilities', 'retained earnings']
  },
  cash_flow: {
    basePrompt: `
      You are generating PostgreSQL queries for the CASH_FLOW table - cash movement analysis.
      
      Schema: cash_flow(month, year, name, amount, category, activity_type)
      activity_type: 'operating', 'investing', 'financing', 'net_income'
      category: 'net_income', 'net_cash', 'subtotal', 'total', 'sumary'
      PURPOSE: Track cash inflows, outflows, and liquidity management.
      
      SEARCH PATTERNS:
      - Cash categories → name ILIKE '%search%'
      - Month data → month = 'january'  
      - Year data → year = '2025'

      DATE CONVERSION:
      - "January 25 2025" → month = 'january' and year = '2025'
      - "January 2025" → month = 'january' and year = '2025'

      CASH FLOW ANALYSIS:
      - Investing activities: WHERE activity_type = 'investing' and category = 'total'
      - Financing activities: WHERE activity_type = 'financing' and category = 'total'
      - Operating cash flow: WHERE activity_type = 'operating' and category = 'total'
      - net cash from operations: WHERE activity_type = 'operating' and category = 'total'
      - net cash from investing : WHERE activity_type = 'investing' and category = 'total'
      - net income = where category = 'net_income'
      - Net cash increase for period = where category = 'summary'

      - Cash inflows: WHERE amount > 0 and category <> 'total'
      - Cash outflows: WHERE amount < 0 and and category <> 'total'
    `,
    keywords: ['cash flow', 'inflow', 'outflow', 'liquidity', 'cash movement', 'operating cash']
  }
};

function getTablePrompt(tableName, question, sessionMetadata = {}) {
  const tableConfig = TABLE_PROMPTS[tableName];
  
  if (!tableConfig) {
    throw new Error(`No prompt configuration found for table: ${tableName}`);
  }
  
  const lastTable = sessionMetadata?.last_table;
  const contextualInfo = lastTable && lastTable !== tableName 
    ? `\nNOTE: Previous query was on ${lastTable} table. User has switched context to ${tableName}.`
    : '';
  
  return `${tableConfig.basePrompt}${contextualInfo}
    
    CRITICAL INSTRUCTIONS:
    - Return ONLY the SQL query - no explanations or formatting
    - Use proper PostgreSQL syntax
    - Add LIMIT 100 for safety unless user specifies count
    - Use ILIKE for case-insensitive searches with % wildcards
    - Format dates as '2024-01-01'::date
    - Order results logically (dates DESC, amounts DESC)
    
    Current question: "${question}"
  `;
}

async function selectBestTable(question, chatHistory = [], sessionMetadata = {}) {
  const lastTable = sessionMetadata?.last_table;
  const questionLower = question.toLowerCase();

  // Check for explicit table mentions first
  const explicitTable = Object.keys(TABLE_PROMPTS).find(
    (table) =>
      questionLower.includes(table.replace("_", " ")) ||
      questionLower.includes(table)
  );

  if (explicitTable) {
    console.log("🎯 Explicit table found:", explicitTable);
    return explicitTable;
  }

  // Keyword-based scoring
  const tableScores = {};
  
  Object.entries(TABLE_PROMPTS).forEach(([tableName, config]) => {
    let score = 0;
    
    // Score based on keyword matches
    config.keywords.forEach(keyword => {
      if (questionLower.includes(keyword)) {
        score += 2;
      }
    });
    
    // Bonus for context continuity
    if (lastTable === tableName) {
      score += 1;
    }
    
    tableScores[tableName] = score;
  });
  
  // Find highest scoring table
  const bestTable = Object.entries(tableScores)
    .sort(([,a], [,b]) => b - a)[0];
  
  if (bestTable && bestTable[1] > 0) {
    console.log("🎯 Keyword-matched table:", bestTable[0], "Score:", bestTable[1]);
    return bestTable[0];
  }
  
  // Fallback to AI selection for complex cases
  const candidateTables = Object.keys(TABLE_PROMPTS);
  const tableSelectionPrompt = [
    {
      role: "system",
      content: `
        You are an expert database table selector for business queries.

        Question: "${question}"
        ${lastTable ? `Last used table: ${lastTable}` : ""}

        Available tables:
        ${candidateTables
          .map(table => `- ${table}: ${tableDescriptions[table]}`)
          .join("\n")}

        Selection Rules:
        1. Match the PRIMARY data type the user wants
        2. Consider context from previous questions  
        3. For ambiguous questions, prefer the most specific table
        4. Only respond with ONE table name

        Respond with ONLY the table name.
      `.trim(),
    },
    { role: "user", content: question },
  ];

  const response = await openai.invoke(tableSelectionPrompt);
  const selectedTable = response.content.trim().toLowerCase();

  if (!TABLE_PROMPTS[selectedTable]) {
    console.warn(`⚠️ Invalid table selected: ${selectedTable}, using default`);
    return "closed_deal";
  }

  return selectedTable;
}

module.exports = {
  TABLE_PROMPTS,
  getTablePrompt,
  selectBestTable
};