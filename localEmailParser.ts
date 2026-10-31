import { ParsedEmail } from './gmail';

const LOCAL_EMAILS_STORAGE_KEY = 'procuraflow_local_imported_emails';

/**
 * Load locally saved emails from browser storage
 */
export function getSavedLocalEmails(): ParsedEmail[] {
  try {
    const raw = localStorage.getItem(LOCAL_EMAILS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Error reading saved local emails:', err);
    return [];
  }
}

/**
 * Save locally imported emails to browser storage
 */
export function saveLocalEmails(emails: ParsedEmail[]): void {
  try {
    localStorage.setItem(LOCAL_EMAILS_STORAGE_KEY, JSON.stringify(emails));
  } catch (err) {
    console.warn('Error saving local emails to storage:', err);
  }
}

/**
 * Add a list of new parsed emails to the local storage, deduplicating by ID/Subject+Date
 */
export function addLocalEmails(newEmails: ParsedEmail[]): ParsedEmail[] {
  const current = getSavedLocalEmails();
  const existingIds = new Set(current.map(e => e.id));
  const merged = [...current];

  newEmails.forEach(email => {
    if (!existingIds.has(email.id)) {
      merged.unshift(email);
      existingIds.add(email.id);
    }
  });

  saveLocalEmails(merged);
  return merged;
}

/**
 * Clear saved local emails
 */
export function clearSavedLocalEmails(): void {
  localStorage.removeItem(LOCAL_EMAILS_STORAGE_KEY);
}

/**
 * Parse an .eml or raw email text into a ParsedEmail object
 */
export function parseRawEmailText(rawContent: string, fileName?: string): ParsedEmail {
  // Normalize line breaks
  const normalized = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split headers and body at the first double newline
  const headerBodySplit = normalized.indexOf('\n\n');
  let headerText = '';
  let bodyText = '';

  if (headerBodySplit !== -1) {
    headerText = normalized.slice(0, headerBodySplit);
    bodyText = normalized.slice(headerBodySplit + 2);
  } else {
    headerText = normalized;
    bodyText = normalized;
  }

  // Parse headers (handling multiline folding)
  const headers: Record<string, string> = {};
  const headerLines = headerText.split('\n');
  let currentHeaderKey = '';

  for (const line of headerLines) {
    if (/^\s+/.test(line) && currentHeaderKey) {
      // Continuation of previous header
      headers[currentHeaderKey] += ' ' + line.trim();
    } else {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        currentHeaderKey = match[1].toLowerCase().trim();
        headers[currentHeaderKey] = match[2].trim();
      }
    }
  }

  // Extract fields
  const subject = headers['subject'] || (fileName ? fileName.replace(/\.[^/.]+$/, '') : 'Message Importé');
  const from = headers['from'] || 'Expéditeur Inconnu <contact@fournisseur.com>';
  const to = headers['to'] || 'achats@procuraflow.dz';
  const dateStr = headers['date'] || new Date().toUTCString();
  const dateObj = new Date(dateStr);
  const timestamp = !isNaN(dateObj.getTime()) ? dateObj.getTime() : Date.now();

  // Extract email from "From" header
  const emailMatch = from.match(/<([^>]+)>/) || from.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
  const fromEmail = emailMatch ? emailMatch[1].trim() : from.trim();

  // Clean body: strip HTML tags if body looks like HTML
  let cleanBody = bodyText;
  if (/<[a-z][\s\S]*>/i.test(bodyText)) {
    const doc = new DOMParser().parseFromString(bodyText, 'text/html');
    cleanBody = doc.body.textContent || doc.body.innerText || bodyText;
  }

  // Generate a snippet
  const snippet = cleanBody.replace(/\s+/g, ' ').trim().slice(0, 160) + (cleanBody.length > 160 ? '...' : '');

  // Detect attachments
  const hasAttachments = /content-disposition:\s*attachment/i.test(headerText) || 
                         /filename=/i.test(normalized) || 
                         /\.pdf|\.xlsx|\.docx|\.jpg/i.test(bodyText);

  // Generate stable or random ID
  const messageId = headers['message-id'] ? headers['message-id'].replace(/[<>]/g, '') : `local-eml-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  return {
    id: messageId,
    threadId: `thread-${messageId}`,
    subject,
    from,
    fromEmail,
    to,
    date: dateStr,
    timestamp,
    snippet: snippet || '(Sans contenu textuel)',
    body: cleanBody || '(Corps du message vide)',
    labelIds: ['INBOX', 'LOCAL_IMPORT'],
    unread: false,
    hasAttachments
  };
}

/**
 * Parse an uploaded file (.eml, .txt, .json, .mbox)
 */
export async function parseUploadedEmailFile(file: File): Promise<ParsedEmail[]> {
  const text = await file.text();

  // Check if it's JSON (exported emails array)
  if (file.name.endsWith('.json') || text.trim().startsWith('[') || text.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((item, index) => {
          if (item.subject && item.from) {
            return {
              id: item.id || `local-json-${Date.now()}-${index}`,
              threadId: item.threadId || `thread-${item.id || index}`,
              subject: item.subject,
              from: item.from,
              fromEmail: item.fromEmail || item.from.replace(/.*<([^>]+)>.*/, '$1'),
              to: item.to || 'achats@procuraflow.dz',
              date: item.date || new Date().toUTCString(),
              timestamp: item.timestamp || Date.now(),
              snippet: item.snippet || (item.body ? item.body.slice(0, 120) : ''),
              body: item.body || '',
              labelIds: item.labelIds || ['INBOX', 'LOCAL_IMPORT'],
              unread: Boolean(item.unread),
              hasAttachments: Boolean(item.hasAttachments)
            };
          }
          return parseRawEmailText(JSON.stringify(item), `${file.name}-${index}`);
        });
      } else if (parsed.subject && parsed.from) {
        return [{
          id: parsed.id || `local-json-${Date.now()}`,
          threadId: parsed.threadId || `thread-json-${Date.now()}`,
          subject: parsed.subject,
          from: parsed.from,
          fromEmail: parsed.fromEmail || parsed.from.replace(/.*<([^>]+)>.*/, '$1'),
          to: parsed.to || 'achats@procuraflow.dz',
          date: parsed.date || new Date().toUTCString(),
          timestamp: parsed.timestamp || Date.now(),
          snippet: parsed.snippet || (parsed.body ? parsed.body.slice(0, 120) : ''),
          body: parsed.body || '',
          labelIds: parsed.labelIds || ['INBOX', 'LOCAL_IMPORT'],
          unread: Boolean(parsed.unread),
          hasAttachments: Boolean(parsed.hasAttachments)
        }];
      }
    } catch {
      // Fall through to plain text parsing
    }
  }

  // Check if it's mbox format (contains "From " lines separating messages)
  if (text.includes('\nFrom ') || text.startsWith('From ')) {
    const rawChunks = text.split(/\n(?=From \S+ )/);
    return rawChunks
      .filter(chunk => chunk.trim().length > 20)
      .map((chunk, idx) => parseRawEmailText(chunk, `${file.name} #${idx + 1}`));
  }

  // Standard single .eml or raw text message
  return [parseRawEmailText(text, file.name)];
}
