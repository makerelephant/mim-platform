# Email Classification Rule: Legal

## Category ID
`legal`

## Inbound From
- Corporate counsel (Foley Hoag)
- Opposing counsel (investor side)
- Regulators
- DocuSign / e-signature platforms

## Outbound To
- Lawyers
- Team members (for review)
- Investors (executed docs)

## Signals

### Strong Triggers
Term sheet, agreement, contract, amendment, notice, breach, liability, indemnification, settlement, dispute, litigation, arbitration, cease and desist, subpoena, compliance, regulatory, IP assignment

### Fundraising Legal
SAFE agreement, convertible note, subscription agreement, investor rights agreement, stock purchase agreement, cap table, board consent, shareholder approval, closing documents

### Corporate Governance
Board resolution, written consent, corporate action, articles of incorporation, bylaws, equity issuance, option grants, 409A valuation

### IP / Confidentiality
NDA, non-disclosure agreement, confidential, proprietary, intellectual property, IP assignment, license agreement

### Compliance / Regulatory
GDPR, data processing agreement, DPA, privacy policy, terms of service, export compliance, securities law, KYC, AML

### Language Patterns
"Please review and advise", "subject to the terms herein", "without prejudice", "pursuant to the agreement", "attached please find", "execution copy", "final redlines", "legal review requested", "draft contract", "notice of"

## Importance

### High
If the email involves **one or more** of: risk, money, ownership, deadline.

- Legal risk or liability: breach, demand letter, cease and desist, subpoena, litigation, regulatory inquiry, compliance violation
- Binding signatures: execution copy, please sign, signature required, final agreement, term sheet attached
- Money or equity: investment agreements, cap table changes, stock purchase, convertible note, acquisition
- Deadlines: by end of day, filing deadline, closing date, response required
- Sender is outside counsel, government regulator, or investor legal team

If **two or more** of these signals appear, almost always urgent.

### Medium
- Contract review requests (early drafts)
- Policy updates
- Data processing agreements
- NDA requests
- Partnership agreement drafts

Typically requires attention within a few days.

### Low
- Policy reminders
- Minor contract updates
- Legal newsletters
- FYI regulatory summaries
- Standard NDA circulation
- Updated terms of service
