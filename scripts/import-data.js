const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://smychxtekmfzezirpubp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNteWNoeHRla21memV6aXJwdWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MzMzNjUsImV4cCI6MjA4NzMwOTM2NX0.Jwyba3AlYZBTtCnmNFrLZOAxJSs-e5HKCGBYUbmMtyk';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const record = {};
    headers.forEach((h, idx) => {
      record[h.trim()] = values[idx] !== undefined ? values[idx].trim() : '';
    });
    records.push(record);
  }
  return records;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function cleanNum(val) {
  if (!val || val === '') return null;
  const cleaned = val.replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function cleanInt(val) {
  if (!val || val === '') return null;
  const num = parseInt(val.replace(/,/g, '').trim());
  return isNaN(num) ? null : num;
}

function parseDate(val) {
  if (!val || val === '') return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

async function batchInsert(table, records, batchSize = 50) {
  let inserted = 0;
  let failed = 0;
  const ids = [];

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { data, error } = await supabase.from(table).insert(batch).select('id');
    if (error) {
      console.error(`  Error inserting batch into ${table}:`, error.message);
      // Try one by one
      for (const record of batch) {
        const { data: d, error: e } = await supabase.from(table).insert(record).select('id');
        if (e) {
          console.error(`  Failed record:`, e.message, JSON.stringify(record).slice(0, 100));
          failed++;
        } else {
          inserted++;
          if (d && d[0]) ids.push(d[0].id);
        }
      }
    } else {
      inserted += batch.length;
      if (data) data.forEach(d => ids.push(d.id));
    }
  }

  console.log(`  ${table}: ${inserted} inserted, ${failed} failed`);
  return ids;
}

async function importContacts() {
  console.log('\n=== Importing Contacts ===');
  const dataDir = path.join(__dirname, '..', '..', 'data');
  const raw = parseCSV(path.join(dataDir, 'master_contacts_final.csv'));

  const records = raw.map(r => ({
    name: r['Name'] || 'Unknown',
    email: r['Email'] || null,
    phone: r['Phone'] || null,
    title: r['Title'] || null,
    address: r['Address'] || null,
    segment: r['Segment'] || null,
    primary_category: r['Primary Category'] || null,
    subcategory: r['Subcategory'] || null,
    region: r['Region'] || null,
    business_type: r['Business Type'] || null,
    notes: r['Notes'] || null,
    source: r['Source'] || 'CSV Import',
  }));

  return await batchInsert('contacts', records);
}

async function importInvestors() {
  console.log('\n=== Importing Investors ===');
  const dataDir = path.join(__dirname, '..', '..', 'data');
  const raw = parseCSV(path.join(dataDir, 'investors_clean.csv'));

  const records = raw.map(r => ({
    firm_name: r['Firm'] || 'Unknown',
    description: r['Description'] || null,
    fund_type: r['Fund Type'] || null,
    investor_type: r['Type'] || null,
    geography: r['Geography'] || null,
    location: r['Location'] || null,
    sector_focus: r['Sector Focus'] || null,
    portfolio_url: r['Portfolio'] || null,
    website: r['Website'] || r['Relevant Link'] || null,
    notable_investments: r['Notable Investments'] || null,
    connection_status: r['connection Status'] || null,
    pipeline_status: mapPipelineStatus(r['connection Status']),
    likelihood_score: cleanInt(r['LIkelyhood score']),
    source: r['Source'] || 'CSV Import',
    notes: r['Marks Comments'] || null,
  }));

  // Also collect contact names to link later
  const contactLinks = raw.map(r => r['Contact']).filter(Boolean);

  return { ids: await batchInsert('investors', records), contactNames: contactLinks, raw };
}

function mapPipelineStatus(connectionStatus) {
  if (!connectionStatus) return 'Prospect';
  const s = connectionStatus.toLowerCase();
  if (s.includes('active')) return 'Engaged';
  if (s.includes('stale')) return 'Prospect';
  if (s.includes('need introduction')) return 'Prospect';
  if (s.includes('close') || s.includes('closing')) return 'In Closing';
  if (s.includes('pass')) return 'Passed';
  return 'Prospect';
}

async function importMarketMap() {
  console.log('\n=== Importing Market Map ===');
  const dataDir = path.join(__dirname, '..', '..', 'data');
  const raw = parseCSV(path.join(dataDir, 'market_map_clean.csv'));

  const records = raw.map(r => ({
    league: r['League'] || 'Unknown',
    program_name: r['Program Name'] || 'Unknown',
    players: cleanInt(r['Players']),
    travel_teams: cleanInt(r['Travel Teams']),
    dues_per_season: cleanNum(r['Dues Per Season']),
    dues_revenue: cleanNum(r['Dues Revenue']),
    uniform_cost: cleanNum(r['Uniform Cost']),
    total_revenue: cleanNum(r['Total Revenue']),
    gross_revenue: cleanNum(r['Gross Revenue']),
    total_costs: cleanNum(r['Total Costs']),
    yearly_cost_player: cleanNum(r['Yearly Cost Per Player']),
    primary_contact: r['Primary Contact'] || null,
    website: r['Website'] || null,
    merch_link: r['Merch Link'] || null,
    outreach_status: 'Not Contacted',
  }));

  return { ids: await batchInsert('market_map', records), raw };
}

async function importSoccerOrgs() {
  console.log('\n=== Importing Soccer Orgs ===');
  const dataDir = path.join(__dirname, '..', '..', 'data');
  const raw = parseCSV(path.join(dataDir, 'soccer_orgs_clean.csv'));

  const records = raw.map(r => ({
    org_name: r['Company / Org Name'] || 'Unknown',
    org_type: r['Type'] || null,
    corporate_structure: r['Corporate Structure'] || null,
    address: r['Address'] || null,
    website: r['Website'] || null,
    merch_link: r['Merch Link'] || null,
    store_status: r['Store Status'] || null,
    store_provider: r['store Provider'] || null,
    in_bays: false, // BAYS not in CSV columns
    in_cmysl: !!(r['CMYSL Towns and Teams Database'] || '').trim(),
    in_cysl: !!(r['CYSL Towns and Teams Database'] || '').trim(),
    in_ecnl: !!(r['ECNL Database'] || '').trim(),
    in_ecysa: !!(r['ECYSA Towns and Teams'] || '').trim(),
    in_mysl: !!(r['MYSL Towns and Teams Database'] || '').trim(),
    in_nashoba: !!(r['Nashoba Valley Soccer League'] || '').trim(),
    in_necsl: !!(r['New England Club Soccer League (NECSL)'] || '').trim(),
    in_roots: !!(r['Roots Soccer League Database'] || '').trim(),
    in_south_coast: !!(r['South Coast Soccer League Database'] || '').trim(),
    in_south_shore: !!(r['South Shore Youth Soccer League Database'] || '').trim(),
    notes: r['other Contacts'] || null,
  }));

  return { ids: await batchInsert('soccer_orgs', records), raw };
}

async function importTransactions() {
  console.log('\n=== Importing Transactions ===');
  const dataDir = path.join(__dirname, '..', '..', 'data');
  const raw = parseCSV(path.join(dataDir, 'transactions_clean.csv'));

  const records = raw.map(r => ({
    company: r['Company'] || 'Unknown',
    amount: cleanNum(r['Amount']),
    company_link: r['Company Link'] || null,
    geography: r['Geography'] || null,
    investment_date: parseDate(r['Investment Date']),
    investment_stage: r['Investment Stage'] || null,
    investors_buyers: r['Investor(s) / Buyers'] || null,
    sector: r['Sector'] || null,
    sport: r['Sport'] || null,
    transaction_type: r['Transaction type'] || null,
    annual_revenue: cleanNum(r['Published Annual Revenue']),
    press_link: r['Press Link'] || null,
    press_notes: r['Press / Announcement / Notes'] || null,
  }));

  return await batchInsert('transactions', records);
}

async function linkContacts() {
  console.log('\n=== Linking Contacts to Entities ===');

  // Fetch all contacts
  const { data: contacts } = await supabase.from('contacts').select('id, name, email');
  if (!contacts) { console.log('  No contacts found'); return; }

  const contactByName = {};
  contacts.forEach(c => {
    contactByName[c.name.toLowerCase()] = c.id;
  });

  // Link contacts to market_map via primary_contact
  const { data: programs } = await supabase.from('market_map').select('id, primary_contact');
  if (programs) {
    const links = [];
    for (const prog of programs) {
      if (!prog.primary_contact) continue;
      const names = prog.primary_contact.split(',').map(n => n.trim());
      for (const name of names) {
        const contactId = contactByName[name.toLowerCase()];
        if (contactId) {
          links.push({ market_map_id: prog.id, contact_id: contactId, role: 'Primary Contact' });
        }
      }
    }
    if (links.length > 0) {
      await batchInsert('market_map_contacts', links);
      console.log(`  Linked ${links.length} contacts to market map programs`);
    }
  }

  // Link contacts to soccer_orgs via Contacts column
  const { data: orgs } = await supabase.from('soccer_orgs').select('id, org_name, notes');
  if (orgs) {
    // Re-read csv to get the Contacts column
    const dataDir = path.join(__dirname, '..', '..', 'data');
    const rawOrgs = parseCSV(path.join(dataDir, 'soccer_orgs_clean.csv'));

    // Fetch org IDs in order
    const { data: allOrgs } = await supabase.from('soccer_orgs').select('id, org_name').order('created_at');
    if (allOrgs) {
      const orgByName = {};
      allOrgs.forEach(o => { orgByName[o.org_name.toLowerCase()] = o.id; });

      const links = [];
      for (const rawOrg of rawOrgs) {
        const contactField = rawOrg['Contacts'] || '';
        if (!contactField || contactField === 'Me') continue;
        const orgId = orgByName[(rawOrg['Company / Org Name'] || '').toLowerCase()];
        if (!orgId) continue;

        const names = contactField.split(',').map(n => n.trim());
        for (const name of names) {
          const contactId = contactByName[name.toLowerCase()];
          if (contactId) {
            links.push({ soccer_org_id: orgId, contact_id: contactId, role: 'Contact' });
          }
        }
      }
      if (links.length > 0) {
        await batchInsert('soccer_org_contacts', links);
        console.log(`  Linked ${links.length} contacts to soccer orgs`);
      }
    }
  }

  // Link contacts to investors via Contact column
  const dataDir = path.join(__dirname, '..', '..', 'data');
  const rawInvestors = parseCSV(path.join(dataDir, 'investors_clean.csv'));
  const { data: allInvestors } = await supabase.from('investors').select('id, firm_name').order('created_at');

  if (allInvestors) {
    const investorByName = {};
    allInvestors.forEach(inv => { investorByName[inv.firm_name.toLowerCase()] = inv.id; });

    const links = [];
    for (const rawInv of rawInvestors) {
      const contactName = rawInv['Contact'] || '';
      if (!contactName) continue;
      const investorId = investorByName[(rawInv['Firm'] || '').toLowerCase()];
      if (!investorId) continue;

      const contactId = contactByName[contactName.toLowerCase()];
      if (contactId) {
        links.push({ investor_id: investorId, contact_id: contactId, role: 'Contact' });
      }
    }
    if (links.length > 0) {
      await batchInsert('investor_contacts', links);
      console.log(`  Linked ${links.length} contacts to investors`);
    }
  }
}

async function main() {
  console.log('MiM Platform Data Import');
  console.log('========================');

  await importContacts();
  await importInvestors();
  await importMarketMap();
  await importSoccerOrgs();
  await importTransactions();
  await linkContacts();

  console.log('\n========================');
  console.log('Import complete!');
}

main().catch(console.error);
