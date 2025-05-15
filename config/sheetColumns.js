module.exports = {
    invoices: [
      'invoice_number',
      'invoice_date',
      'currency',
      'customer_name',
      'amount_cad'
    ],
    payments: [
      'supplier_invoices',
      'payment_date',
      'currency',
      'detail',
      'amount_cad',
      'vendor_name',
      'amount'
    ],
    ap: [
      'date',
      'transaction_type',
      'temp',
      'supplier',
      'due_date',
      'past_due',
      'amount',
      'open_balance',
      'foreign_amount',
      'foreign_open_balance',
      'currency',
      'exchange_rate'
    ],
    ar: [
      'date',
      'transaction_type',
      'temp',
      'customer',
      'due_date',
      'amount',
      'open_balance',
      'foreign_amount',
      'foreign_open_balance',
      'currency',
      'exchange_rate'
    ],
    closed_deal:[
      'amount',
      'amount_in_home_currency',
      'closedate',
      'hs_closed_amount',
      'dealname',
      'dealtype',
      'hubspot_owner_id',
      'hs_analytics_source',
      'hs_analytics_source_data_1',
      'hs_analytics_source_data_2',
      'company_name',
      'conference_code',
      'conference_internal_name',
      'hs_is_closed_won'
    ],
  
  };