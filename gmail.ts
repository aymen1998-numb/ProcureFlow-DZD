import { GoogleAuthProvider, signInWithPopup, User, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import firebaseConfig from '../../firebase-applet-config.json';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

const provider = new GoogleAuthProvider();
GMAIL_SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account',
});

// Cache the access token in memory only
let cachedAccessToken: string | null = null;
let currentGoogleUser: User | null = null;
let isSigningIn = false;
let isDemoModeActive = false;

// Listen to auth state to clear token on sign-out
onAuthStateChanged(auth, (user) => {
  if (!user && !isDemoModeActive) {
    cachedAccessToken = null;
    currentGoogleUser = null;
  }
});

// Realistic procurement sample emails for demonstration & fallback
export const SAMPLE_PROCUREMENT_EMAILS: ParsedEmail[] = [
  {
    id: 'demo-msg-001',
    threadId: 'demo-thread-001',
    subject: 'Expédition Express DHL #9842103849 - Documents originaux BL & Facture INTL-2024-001',
    from: 'DHL Express Notifications <tracking@dhl.com>',
    fromEmail: 'tracking@dhl.com',
    to: 'achats@procuraflow.dz',
    date: new Date(Date.now() - 1000 * 60 * 60 * 4).toUTCString(),
    timestamp: Date.now() - 1000 * 60 * 60 * 4,
    snippet: "Votre envoi DHL Express référence 9842103849 est en cours d'acheminement vers Alger. Bill of Lading (BL) et certificat d'origine attachés.",
    body: `Madame, Monsieur,\n\nVotre expédition DHL Express avec le numéro de bordereau 9842103849 pour le dossier INTL-2024-001 a été prise en charge au hub de Francfort.\n\nDocuments joints:\n- Bill of Lading original (BL)\n- Facture Commerciale définitive n° FC-9921\n- Certificat d'Origine EUR1\n\nStatut: En transit aérien vers Alger Houari Boumediene.\nSuivi en direct: https://www.dhl.com/dz-fr/home/tracking/tracking-express.html?submit=1&tracking-id=9842103849\n\nCordialement,\nService Suivi DHL Express International`,
    labelIds: ['INBOX', 'UNREAD'],
    unread: true,
    hasAttachments: true,
  },
  {
    id: 'demo-msg-002',
    threadId: 'demo-thread-002',
    subject: 'Relance: Proforma & Financement Bancaire Dossier INTL-2024-002',
    from: 'EuroTech Supplies Germany <klaus.schmidt@eurotech-supplies.de>',
    fromEmail: 'klaus.schmidt@eurotech-supplies.de',
    to: 'achats@procuraflow.dz',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toUTCString(),
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 4, // 4 days ago -> triggers STALLED alarm
    snippet: "Bonjour, nous attendons toujours votre confirmation sur la facture proforma révisée et la domiciliation bancaire pour le dossier INTL-2024-002...",
    body: `Bonjour l'équipe ProcuraFlow,\n\nNous nous permettons de vous relancer concernant le dossier d'achat international INTL-2024-002.\nNous vous avons transmis la facture proforma finale il y a 4 jours pour votre montage financier (20% fonds propres / 80% ligne bancaire BEA).\n\nPourriez-vous nous confirmer l'ouverture du crédit documentaire ou la domiciliation pour que nous puissions lancer la fabrication des équipements ?\n\nBien cordialement,\nKlaus Schmidt\nEuroTech Supplies GmbH`,
    labelIds: ['INBOX'],
    unread: false,
    hasAttachments: true,
  },
  {
    id: 'demo-msg-003',
    threadId: 'demo-thread-003',
    subject: 'Confirmation Bon de Commande BC-2024-001 - Disjoncteurs Compact NSX',
    from: 'Schneider Electric Algérie <service.commandes@se-algerie.dz>',
    fromEmail: 'service.commandes@se-algerie.dz',
    to: 'approvisionnements@procuraflow.dz',
    date: new Date(Date.now() - 1000 * 60 * 60 * 18).toUTCString(),
    timestamp: Date.now() - 1000 * 60 * 60 * 18,
    snippet: 'Accusé de réception de votre bon de commande BC-2024-001. Disponibilité en stock à Rouiba confirmée pour enlèvement sous 48h.',
    body: `Bonjour,\n\nNous accusons bonne réception de votre bon de commande BC-2024-001 portant sur les matériels électriques moyenne et basse tension.\nLes articles sont préparés dans notre entrepôt logistique de Rouiba. Le bon de livraison (BL) et la facture proforma sont prêts pour enlèvement par votre transporteur.\n\nSalutations distinguées,\nSupport Ventes - Schneider Electric Algérie`,
    labelIds: ['INBOX', 'UNREAD'],
    unread: true,
    hasAttachments: true,
  },
  {
    id: 'demo-msg-004',
    threadId: 'demo-thread-004',
    subject: "Avis d'ouverture Crédit Documentaire Irrévocable - INTL-2024-001",
    from: 'Banque Extérieure d Algérie <commerce.exterieur@bea.dz>',
    fromEmail: 'commerce.exterieur@bea.dz',
    to: 'finances@procuraflow.dz',
    date: new Date(Date.now() - 1000 * 60 * 60 * 36).toUTCString(),
    timestamp: Date.now() - 1000 * 60 * 60 * 36,
    snippet: "Notification d'ouverture du crédit documentaire n° CREDOC-2024-8842 en faveur du fournisseur étranger.",
    body: `Madame, Monsieur,\n\nNous vous confirmons l'ouverture du crédit documentaire n° CREDOC-2024-8842 au titre de votre dossier d'achat international INTL-2024-001.\nStructure financière enregistrée: 20% autofinancement / 80% concours bancaire.\n\nLes instructions ont été télétransmises par Swift MT700 à la banque notificatrice.\n\nDirection du Commerce Extérieur\nBanque Extérieure d'Algérie`,
    labelIds: ['INBOX'],
    unread: false,
    hasAttachments: false,
  },
  {
    id: 'demo-msg-005',
    threadId: 'demo-thread-005',
    subject: 'Devis comparatif & Délais de livraison outillage industriel',
    from: 'Maghreb Outillage Pro <devis@maghreb-outillage.com>',
    fromEmail: 'devis@maghreb-outillage.com',
    to: 'achats@procuraflow.dz',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toUTCString(),
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 5, // 5 days ago -> triggers STALLED alarm
    snippet: 'Suite à votre consultation, veuillez trouver ci-joint notre cotation détaillée en DZD TTC pour la fourniture des consommables.',
    body: `Bonjour,\n\nFaisant suite à votre demande de prix, vous trouverez en pièce jointe notre meilleure offre commerciale en dinars algériens (DZD) toutes taxes comprises.\nValidité de l'offre: 30 jours.\n\nDans l'attente de votre bon de commande,\nService Commercial Maghreb Outillage`,
    labelIds: ['INBOX'],
    unread: false,
    hasAttachments: true,
  },
];

let demoMessagesStore = [...SAMPLE_PROCUREMENT_EMAILS];

/**
 * Acquire Google OAuth Access Token via Google Identity Services (GIS)
 */
const requestGisToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Environnement navigateur non disponible.'));
    }

    const clientId = firebaseConfig.oAuthClientId;
    if (!clientId) {
      return reject(new Error("L'identifiant client OAuth (oAuthClientId) n'est pas configuré."));
    }

    const googleObj = (window as any).google;
    if (!googleObj?.accounts?.oauth2?.initTokenClient) {
      return reject(new Error('GIS_NOT_LOADED'));
    }

    try {
      const tokenClient = googleObj.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GMAIL_SCOPES.join(' '),
        callback: (resp: any) => {
          if (resp.error) {
            reject(new Error(resp.error_description || resp.error));
          } else if (resp.access_token) {
            resolve(resp.access_token);
          } else {
            reject(new Error("Aucun jeton d'accès reçu de Google Identity Services."));
          }
        },
        error_callback: (err: any) => {
          reject(new Error(err?.message || 'Erreur du client Google Identity.'));
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      reject(err);
    }
  });
};

export interface ConnectGmailResult {
  user: User | null;
  accessToken: string;
  cancelled?: boolean;
}

let activeSignInPromise: Promise<ConnectGmailResult> | null = null;

/**
 * Connect to Gmail:
 * 1. Tries Google Identity Services (GIS token client) first.
 * 2. Falls back to Firebase Auth signInWithPopup if GIS is not ready.
 * 3. Gracefully reports actionable instructions if blocked by browser sandbox.
 * 4. Mutex-protected to prevent overlapping popups and Firebase internal assertion crashes.
 */
export const connectGmail = async (): Promise<ConnectGmailResult> => {
  if (activeSignInPromise) {
    return activeSignInPromise;
  }

  activeSignInPromise = (async () => {
    try {
      isSigningIn = true;

      // 1. Attempt Google Identity Services Token Client (best for Workspace API in iframes)
      try {
        const token = await requestGisToken();
        if (token) {
          cachedAccessToken = token;
          isDemoModeActive = false;
          return { user: auth.currentUser, accessToken: token, cancelled: false };
        }
      } catch (gisError: any) {
        const gisMsg = gisError?.message || String(gisError);
        console.warn('Google Identity Services attempt:', gisMsg);
        // If error is user closed popup, don't fall back to second popup
        if (
          gisMsg.includes('popup_closed_by_user') ||
          gisMsg.includes('access_denied') ||
          gisMsg.includes('cancelled')
        ) {
          return { user: auth.currentUser, accessToken: '', cancelled: true };
        }
      }

      // 2. Fallback to Firebase Auth signInWithPopup
      try {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (!credential?.accessToken) {
          throw new Error("Impossible d'extraire le jeton d'accès de la réponse Google.");
        }

        cachedAccessToken = credential.accessToken;
        currentGoogleUser = result.user;
        isDemoModeActive = false;
        return { user: result.user, accessToken: cachedAccessToken, cancelled: false };
      } catch (fbError: any) {
        const errorCode = fbError?.code || '';
        const errorMessage = fbError?.message || '';

        if (
          errorCode === 'auth/popup-closed-by-user' ||
          errorCode === 'auth/cancelled-popup-request' ||
          errorMessage.includes('popup-closed-by-user') ||
          errorMessage.includes('cancelled')
        ) {
          console.warn('Connexion Google annulée par l\'utilisateur.');
          return { user: auth.currentUser, accessToken: '', cancelled: true };
        }

        if (errorCode === 'auth/popup-blocked') {
          throw new Error("La fenêtre popup a été bloquée par votre navigateur. Veuillez autoriser les fenêtres pop-up.");
        } else if (errorCode === 'auth/internal-error' || errorCode.includes('internal-error')) {
          throw new Error(
            "La connexion Google Popup est restreinte dans cet environnement (cookies tiers ou iframe). Vous pouvez utiliser le Mode Démo ou saisir un jeton d'accès."
          );
        }
        throw fbError;
      }
    } finally {
      isSigningIn = false;
      activeSignInPromise = null;
    }
  })();

  return activeSignInPromise;
};

export const enableGmailDemoMode = (): void => {
  isDemoModeActive = true;
  cachedAccessToken = 'demo-procuraflow-token';
};

export const disableGmailDemoMode = (): void => {
  isDemoModeActive = false;
  cachedAccessToken = null;
};

export const isGmailDemoMode = (): boolean => {
  return isDemoModeActive;
};

export const setManualGmailToken = (token: string): void => {
  cachedAccessToken = token.trim();
  isDemoModeActive = false;
};

export const getGmailToken = (): string | null => {
  return cachedAccessToken;
};

export const isGmailConnected = (): boolean => {
  return Boolean(cachedAccessToken);
};

export const disconnectGmail = () => {
  cachedAccessToken = null;
  currentGoogleUser = null;
  isDemoModeActive = false;
};

export interface GmailMessageHeader {
  name: string;
  value: string;
}

export interface ParsedEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  fromEmail: string;
  to: string;
  date: string;
  timestamp: number;
  snippet: string;
  body: string;
  labelIds: string[];
  unread: boolean;
  hasAttachments: boolean;
}

// Decode base64url encoded string
function decodeBase64Url(input: string): string {
  try {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (m) => m.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch (e) {
    console.warn('Failed to decode base64 body:', e);
    return '';
  }
}

// Extract plain text or html body recursively from payload
function extractBody(payload: any): string {
  if (!payload) return '';
  if (payload.body && payload.body.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts && Array.isArray(payload.parts)) {
    const plainPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
    if (plainPart && plainPart.body && plainPart.body.data) {
      return decodeBase64Url(plainPart.body.data);
    }
    const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
    if (htmlPart && htmlPart.body && htmlPart.body.data) {
      return decodeBase64Url(htmlPart.body.data);
    }
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }
  return '';
}

// Extract email address from string "Name <email@domain.com>"
export function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  if (match && match[1]) return match[1].toLowerCase().trim();
  return raw.replace(/["']/g, '').trim().toLowerCase();
}

/**
 * List messages with optional Gmail query filter
 */
export async function listGmailMessages(
  query: string = '',
  maxResults: number = 30
): Promise<ParsedEmail[]> {
  if (isDemoModeActive) {
    // Return sample demo messages
    return [...demoMessagesStore].slice(0, maxResults);
  }

  const token = getGmailToken();
  if (!token) {
    throw new Error('NON_AUTHENTICATED');
  }

  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  if (query) url.searchParams.set('q', query);
  url.searchParams.set('maxResults', String(maxResults));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('TOKEN_EXPIRED');
    }
    throw new Error(`Gmail API error: ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.messages || !Array.isArray(data.messages)) {
    return [];
  }

  // Fetch detail for each message concurrently (in batches of 10 to avoid rate limits)
  const results: ParsedEmail[] = [];
  const batchSize = 10;
  for (let i = 0; i < data.messages.length; i += batchSize) {
    const chunk = data.messages.slice(i, i + batchSize);
    const chunkPromises = chunk.map(async (msg: { id: string }) => {
      try {
        const detailRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!detailRes.ok) return null;
        const detail = await detailRes.json();
        const headers: GmailMessageHeader[] = detail.payload?.headers || [];

        const getHeader = (name: string) =>
          headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        const from = getHeader('From');
        const to = getHeader('To');
        const subject = getHeader('Subject') || '(Sans objet)';
        const date = getHeader('Date');
        const timestamp = detail.internalDate ? parseInt(detail.internalDate, 10) : Date.now();
        const body = extractBody(detail.payload);
        const labelIds = detail.labelIds || [];
        const unread = labelIds.includes('UNREAD');

        const hasAttachments = Boolean(
          detail.payload?.parts?.some((p: any) => p.filename && p.filename.length > 0)
        );

        const parsed: ParsedEmail = {
          id: detail.id,
          threadId: detail.threadId,
          subject,
          from,
          fromEmail: extractEmailAddress(from),
          to,
          date,
          timestamp,
          snippet: detail.snippet || '',
          body,
          labelIds,
          unread,
          hasAttachments,
        };
        return parsed;
      } catch (err) {
        console.warn('Failed to fetch message detail:', msg.id, err);
        return null;
      }
    });

    const resolved = await Promise.all(chunkPromises);
    results.push(...resolved.filter((m): m is ParsedEmail => m !== null));
  }

  return results;
}

/**
 * Send an email via Gmail API
 * Note: MANDATORY user confirmation must precede calling this function!
 */
export async function sendGmailEmail({
  to,
  subject,
  body,
  inReplyTo,
  threadId,
}: {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  threadId?: string;
}): Promise<any> {
  if (isDemoModeActive) {
    // Add sent message into demo store
    const newDemoMsg: ParsedEmail = {
      id: `sent-demo-${Date.now()}`,
      threadId: threadId || `thread-sent-${Date.now()}`,
      subject,
      from: 'Moi <achats@procuraflow.dz>',
      fromEmail: 'achats@procuraflow.dz',
      to,
      date: new Date().toUTCString(),
      timestamp: Date.now(),
      snippet: body.slice(0, 80),
      body,
      labelIds: ['SENT'],
      unread: false,
      hasAttachments: false,
    };
    demoMessagesStore = [newDemoMsg, ...demoMessagesStore];
    return { id: newDemoMsg.id, threadId: newDemoMsg.threadId, labelIds: ['SENT'] };
  }

  const token = getGmailToken();
  if (!token) {
    throw new Error('NON_AUTHENTICATED');
  }

  const emailLines = [
    `To: ${to}`,
    `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
  ];

  if (inReplyTo) {
    emailLines.push(`In-Reply-To: ${inReplyTo}`);
    emailLines.push(`References: ${inReplyTo}`);
  }

  emailLines.push('');
  emailLines.push(body);

  const rawEmail = emailLines.join('\r\n');
  const base64UrlEmail = btoa(unescape(encodeURIComponent(rawEmail)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const payload: any = { raw: base64UrlEmail };
  if (threadId) {
    payload.threadId = threadId;
  }

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Erreur lors de l'envoi du mail: ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Add or remove Gmail labels
 */
export async function modifyGmailLabels(
  messageId: string,
  addLabelIds: string[] = [],
  removeLabelIds: string[] = []
): Promise<any> {
  if (isDemoModeActive) {
    demoMessagesStore = demoMessagesStore.map((m) => {
      if (m.id === messageId) {
        const nextLabels = [
          ...m.labelIds.filter((l) => !removeLabelIds.includes(l)),
          ...addLabelIds,
        ];
        return {
          ...m,
          labelIds: nextLabels,
          unread: nextLabels.includes('UNREAD'),
        };
      }
      return m;
    });
    return { id: messageId, labelIds: addLabelIds };
  }

  const token = getGmailToken();
  if (!token) throw new Error('NON_AUTHENTICATED');

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addLabelIds,
        removeLabelIds,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Erreur lors de la modification des labels: ${res.statusText}`);
  }

  return await res.json();
}
