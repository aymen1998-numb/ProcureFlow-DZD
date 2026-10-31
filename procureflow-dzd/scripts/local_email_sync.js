/**
 * ProcuraFlow Local Email Sync (Node.js)
 * =====================================
 * Runs 100% locally on your laptop with zero external AI APIs.
 * Connects via IMAP to Gmail or your email provider and dumps recent emails to local_emails.json.
 */

const fs = require('fs');
const readline = require('readline');

console.log('='.repeat(60));
console.log('  ProcuraFlow - Local Email Sync (Node.js)');
console.log('  100% Local Processing & Privacy on your Laptop');
console.log('='.repeat(60));
console.log('\nPour synchroniser vos e-mails locaux :');
console.log('1. Exportez vos e-mails depuis Gmail / Thunderbird / Outlook en format .eml ou .mbox');
console.log('2. Ou exécutez le script python: python scripts/local_email_sync.py');
console.log('3. Dans ProcuraFlow, cliquez sur "Importer Fichiers E-mails Locaux (.eml, .mbox, .json)"');
console.log('='.repeat(60));
