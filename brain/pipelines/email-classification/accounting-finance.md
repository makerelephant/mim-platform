# Email Classification Rule: Accounting & Finance

## Category ID
`accounting_finance`

## Inbound From
- Investors (financial questions, runway, cap table)
- Accounting firms / bookkeepers
- Payroll providers (Gusto, Rippling, Deel)
- Banks / payment providers (Mercury, Stripe, Brex)
- Vendors (invoices, billing)
- Internal team (expense approvals, budget planning)

## Outbound To
- CFO / finance lead
- Operations / COO
- Bookkeeper / accounting firm
- People Ops / HR (payroll)
- External accountant (taxes)

## Signals

### Payment & Billing
Invoice, payment, billing, charge, receipt, remittance, refund, credit, debit, transaction, "invoice attached", "payment due", "outstanding balance", "billing statement", "payment confirmation", "remittance advice"

### Accounting & Bookkeeping
P&L, balance sheet, cash flow, journal entry, general ledger, reconciliation, month-end close, financial statements, "monthly financials", "books closed", "accounting reconciliation", "review the P&L"

### Budgeting & Planning
Budget, forecast, burn rate, runway, expenses, cost, revenue, financial model, "budget update", "expense approval", "forecast revision", "runway estimate"

### Payroll
Payroll, compensation, salary, wages, benefits, tax withholding, "payroll approval", "payroll run", "payroll summary", "employee compensation"

### Banking & Transactions
Wire, transfer, deposit, withdrawal, bank account, treasury, chargeback, "wire transfer request", "payment processed", "account verification", "bank transaction alert"

### Taxes & Compliance
Tax, filing, IRS, VAT, sales tax, 1099, W-9, audit, "tax filing deadline", "1099 request", "tax documentation", "audit preparation"

## Importance

### High
- Payments due or overdue: invoice overdue, wire request, vendor payment approval, outstanding balance
- Payroll processing: payroll approval, payroll run, payroll error
- Banking or fraud alerts: unusual activity, transaction alert, chargeback, account verification
- Tax deadlines or compliance: tax filing deadline, IRS notice, sales tax filing, 1099/W-9 request, audit request

### Medium
- Regular accounting updates: monthly financials, P&L report, balance sheet, reconciliation
- Expense approvals or reimbursements
- Vendor billing questions: billing clarification, invoice discrepancy

### Low
- Receipts and payment confirmations
- Finance system notifications and automated reports
- Vendor marketing and finance tool updates
