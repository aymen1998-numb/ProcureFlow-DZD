import { ParsedEmail } from './gmail';

export interface MatchedOrder {
  orderType: 'local_po' | 'intl_purchase';
  orderId: string;
  orderNumber: string;
  supplierName: string;
  currency: string;
  totalAmount?: number;
  status: string;
}

export interface ExtractedDHLTracking {
  trackingNumber: string;
  trackingUrl: string;
  courier: 'DHL Express' | 'Autre Transporteur';
  detectedContext: string;
}

export interface DetectedDocument {
  type: 'facture' | 'bl' | 'certOrigin' | 'packingList';
  name: string;
  confidence: 'high' | 'medium';
}

export type AlarmSeverity = 'urgent' | 'warning' | 'info';

export interface WorkflowAlarm {
  id: string;
  type: 'STALLED_THREAD_3D' | 'WAITING_OUR_REPLY' | 'MISSING_DHL_DOCS' | 'CUSTOMS_DEADLINE';
  severity: AlarmSeverity;
  title: string;
  description: string;
  daysStalled: number;
  emailId?: string;
  threadId?: string;
  orderNumber?: string;
  orderId?: string;
  orderType?: 'local_po' | 'intl_purchase';
  supplierName?: string;
  suggestedAction: string;
  actionType: 'reply' | 'link_order' | 'update_dhl' | 'view_order';
}

export interface EnrichedEmailCommunication {
  email: ParsedEmail;
  matchedOrder?: MatchedOrder;
  dhlTracking?: ExtractedDHLTracking;
  detectedDocuments: DetectedDocument[];
  alarms: WorkflowAlarm[];
  daysAgo: number;
}

/**
 * Extract email domain from string
 */
export function extractDomain(email: string): string {
  const parts = email.split('@');
  if (parts.length > 1) {
    return parts[1].toLowerCase().trim();
  }
  return '';
}

/**
 * Extract DHL tracking number from email subject and body
 */
export function extractDHLTracking(subject: string, body: string, snippet: string): ExtractedDHLTracking | null {
  const fullText = `${subject} \n ${snippet} \n ${body}`;

  // 1. Explicit DHL link
  const linkMatch = fullText.match(/dhl\.com\/[^\s"'>]*tracking-id=([0-9]{10,11})/i);
  if (linkMatch && linkMatch[1]) {
    return {
      trackingNumber: linkMatch[1],
      trackingUrl: `https://www.dhl.com/dz-fr/home/tracking/tracking-express.html?submit=1&tracking-id=${linkMatch[1]}`,
      courier: 'DHL Express',
      detectedContext: 'Lien de suivi DHL détecté dans le message',
    };
  }

  // 2. Keyword + 10 digit number (e.g. DHL 1234567890 or AWB: 1234567890)
  const keywordMatch = fullText.match(/(?:dhl|awb|waybill|bordereau|suivi|tracking|courier)[^\w\d]{0,10}([0-9]{10,11})\b/i);
  if (keywordMatch && keywordMatch[1]) {
    return {
      trackingNumber: keywordMatch[1],
      trackingUrl: `https://www.dhl.com/dz-fr/home/tracking/tracking-express.html?submit=1&tracking-id=${keywordMatch[1]}`,
      courier: 'DHL Express',
      detectedContext: `Numéro AWB DHL ${keywordMatch[1]}`,
    };
  }

  // 3. Isolated 10-digit number occurring in shipment-related context
  if (/dhl|expedition|shipment|airwaybill|transit/i.test(fullText)) {
    const rawNumberMatch = fullText.match(/\b([0-9]{10})\b/);
    if (rawNumberMatch && rawNumberMatch[1]) {
      return {
        trackingNumber: rawNumberMatch[1],
        trackingUrl: `https://www.dhl.com/dz-fr/home/tracking/tracking-express.html?submit=1&tracking-id=${rawNumberMatch[1]}`,
        courier: 'DHL Express',
        detectedContext: `AWB ${rawNumberMatch[1]} détecté par mot-clé DHL`,
      };
    }
  }

  return null;
}

/**
 * Detect shipping and trade documents mentioned or attached
 */
export function detectTradeDocuments(subject: string, body: string, snippet: string): DetectedDocument[] {
  const text = `${subject} ${snippet} ${body}`.toLowerCase();
  const docs: DetectedDocument[] = [];

  // Commercial Invoice
  if (/facture\s*(commerciale|proforma|finale|d'acompte)?|invoice|commercial\s*invoice|proforma/i.test(text)) {
    docs.push({
      type: 'facture',
      name: 'Facture Commerciale / Proforma',
      confidence: 'high',
    });
  }

  // Bill of Lading / Airwaybill
  if (/bill\s*of\s*lading|bl\b|airwaybill|air\s*way\s*bill|awb\b|connaissement|titre\s*de\s*transport/i.test(text)) {
    docs.push({
      type: 'bl',
      name: 'Bill of Lading / Airwaybill (BL)',
      confidence: 'high',
    });
  }

  // Certificate of Origin
  if (/certificat\s*d'origine|certificate\s*of\s*origin|certificat\s*origine|coo\b|eur1|cert\s*origin/i.test(text)) {
    docs.push({
      type: 'certOrigin',
      name: "Certificat d'Origine",
      confidence: 'high',
    });
  }

  // Packing list
  if (/packing\s*list|liste\s*de\s*colisage|colisage|packing-list/i.test(text)) {
    docs.push({
      type: 'packingList',
      name: 'Packing List / Colisage',
      confidence: 'high',
    });
  }

  return docs;
}

/**
 * Match email to local POs and International Purchases
 */
export function matchEmailToOrders(
  email: ParsedEmail,
  pos: any[],
  intlPurchases: any[],
  suppliers: any[]
): MatchedOrder | undefined {
  const searchCorpus = `${email.subject} ${email.snippet} ${email.from} ${email.fromEmail}`.toLowerCase();
  const senderDomain = extractDomain(email.fromEmail);

  // 1. Exact or partial match with International Purchases (by DA number or proforma ref or invoice number)
  for (const intl of intlPurchases) {
    if (intl.daNumber && searchCorpus.includes(intl.daNumber.toLowerCase())) {
      return {
        orderType: 'intl_purchase',
        orderId: intl.id,
        orderNumber: intl.daNumber,
        supplierName: intl.supplierName || 'Fournisseur International',
        currency: intl.currency || 'EUR',
        status: intl.status,
      };
    }
    if (intl.proformaRef && intl.proformaRef.length > 2 && searchCorpus.includes(intl.proformaRef.toLowerCase())) {
      return {
        orderType: 'intl_purchase',
        orderId: intl.id,
        orderNumber: intl.daNumber || intl.proformaRef,
        supplierName: intl.supplierName || 'Fournisseur International',
        currency: intl.currency || 'EUR',
        status: intl.status,
      };
    }
    if (intl.invoiceNumber && intl.invoiceNumber.length > 2 && searchCorpus.includes(intl.invoiceNumber.toLowerCase())) {
      return {
        orderType: 'intl_purchase',
        orderId: intl.id,
        orderNumber: intl.daNumber || intl.invoiceNumber,
        supplierName: intl.supplierName || 'Fournisseur International',
        currency: intl.currency || 'EUR',
        status: intl.status,
      };
    }
  }

  // 2. Exact match with Local POs (by poNumber)
  for (const po of pos) {
    if (po.poNumber && searchCorpus.includes(po.poNumber.toLowerCase())) {
      return {
        orderType: 'local_po',
        orderId: po.id,
        orderNumber: po.poNumber,
        supplierName: po.supplierName || 'Fournisseur Local',
        currency: po.currency || 'DZD',
        totalAmount: po.totalAmount,
        status: po.status,
      };
    }
  }

  // 3. Match by Supplier Name or Email Domain
  for (const sup of suppliers) {
    const supName = (sup.name || '').toLowerCase();
    const supEmail = (sup.email || '').toLowerCase();
    const supDomain = extractDomain(supEmail);

    const matchesName = supName.length > 3 && searchCorpus.includes(supName);
    const matchesDomain = senderDomain && supDomain && senderDomain === supDomain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(senderDomain);

    if (matchesName || matchesDomain) {
      // Find latest intl purchase or PO for this supplier
      const matchingIntl = intlPurchases.find((p) => (p.supplierName || '').toLowerCase() === supName);
      if (matchingIntl) {
        return {
          orderType: 'intl_purchase',
          orderId: matchingIntl.id,
          orderNumber: matchingIntl.daNumber,
          supplierName: matchingIntl.supplierName,
          currency: matchingIntl.currency || 'EUR',
          status: matchingIntl.status,
        };
      }

      const matchingPO = pos.find((p) => (p.supplierName || '').toLowerCase() === supName);
      if (matchingPO) {
        return {
          orderType: 'local_po',
          orderId: matchingPO.id,
          orderNumber: matchingPO.poNumber,
          supplierName: matchingPO.supplierName,
          currency: matchingPO.currency || 'DZD',
          totalAmount: matchingPO.totalAmount,
          status: matchingPO.status,
        };
      }
    }
  }

  return undefined;
}

/**
 * Process a collection of emails and generate enriched communication entries with alarms
 */
export function enrichEmailsWithWorkflow(
  emails: ParsedEmail[],
  pos: any[],
  intlPurchases: any[],
  suppliers: any[],
  userEmail?: string | null
): {
  items: EnrichedEmailCommunication[];
  stalledCount: number;
  pendingDocsCount: number;
  dhlFoundCount: number;
  dailyDigest: WorkflowAlarm[];
} {
  const now = Date.now();
  const items: EnrichedEmailCommunication[] = [];
  const dailyDigest: WorkflowAlarm[] = [];

  let stalledCount = 0;
  let pendingDocsCount = 0;
  let dhlFoundCount = 0;

  for (const email of emails) {
    const elapsedMs = now - email.timestamp;
    const daysAgo = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    const matchedOrder = matchEmailToOrders(email, pos, intlPurchases, suppliers);
    const dhlTracking = extractDHLTracking(email.subject, email.body, email.snippet);
    const detectedDocuments = detectTradeDocuments(email.subject, email.body, email.snippet);

    if (dhlTracking) {
      dhlFoundCount++;
    }

    const alarms: WorkflowAlarm[] = [];
    const isOutbound = userEmail && email.fromEmail.includes(userEmail.toLowerCase());

    // 1. Stalled thread alarm: Inactivity > 3 days
    if (daysAgo >= 3) {
      stalledCount++;
      if (isOutbound) {
        const alarm: WorkflowAlarm = {
          id: `stall-out-${email.id}`,
          type: 'STALLED_THREAD_3D',
          severity: daysAgo >= 6 ? 'urgent' : 'warning',
          title: `Fournisseur inactif (${daysAgo}j)`,
          description: `Votre dernier message à ${email.to} pour "${email.subject.slice(0, 35)}..." n'a reçu aucune réponse depuis ${daysAgo} jours.`,
          daysStalled: daysAgo,
          emailId: email.id,
          threadId: email.threadId,
          orderNumber: matchedOrder?.orderNumber,
          orderId: matchedOrder?.orderId,
          orderType: matchedOrder?.orderType,
          supplierName: matchedOrder?.supplierName || email.to,
          suggestedAction: 'Envoyer une relance par email au fournisseur',
          actionType: 'reply',
        };
        alarms.push(alarm);
        dailyDigest.push(alarm);
      } else {
        const alarm: WorkflowAlarm = {
          id: `stall-in-${email.id}`,
          type: 'WAITING_OUR_REPLY',
          severity: daysAgo >= 5 ? 'urgent' : 'warning',
          title: `Réponse en attente (${daysAgo}j)`,
          description: `Email de ${email.from} reçu il y a ${daysAgo} jours sans réponse enregistrée.`,
          daysStalled: daysAgo,
          emailId: email.id,
          threadId: email.threadId,
          orderNumber: matchedOrder?.orderNumber,
          orderId: matchedOrder?.orderId,
          orderType: matchedOrder?.orderType,
          supplierName: matchedOrder?.supplierName || email.from,
          suggestedAction: 'Répondre au fournisseur',
          actionType: 'reply',
        };
        alarms.push(alarm);
        dailyDigest.push(alarm);
      }
    }

    // 2. DHL document detected without linked order
    if (dhlTracking && !matchedOrder) {
      pendingDocsCount++;
      const alarm: WorkflowAlarm = {
        id: `dhl-unlinked-${email.id}`,
        type: 'MISSING_DHL_DOCS',
        severity: 'info',
        title: `Bordereau DHL Banque détecté (${dhlTracking.trackingNumber})`,
        description: `Bordereau d'envoi du dossier de paiement / documents à la banque détecté dans le message de ${email.from}. Lier ce numéro au dossier d'importation.`,
        daysStalled: daysAgo,
        emailId: email.id,
        threadId: email.threadId,
        suggestedAction: "Lier au dossier d'achat international",
        actionType: 'link_order',
      };
      alarms.push(alarm);
    }

    // 3. Matched international purchase awaiting documents
    if (matchedOrder && matchedOrder.orderType === 'intl_purchase') {
      const intlDoc = intlPurchases.find((p) => p.id === matchedOrder.orderId);
      if (intlDoc && (!intlDoc.documents?.bl || !intlDoc.dhlTrackingNumber)) {
        if (daysAgo >= 3) {
          const alarm: WorkflowAlarm = {
            id: `docs-missing-${matchedOrder.orderId}`,
            type: 'MISSING_DHL_DOCS',
            severity: 'warning',
            title: `Envoi dossier de paiement banque en attente (${matchedOrder.orderNumber})`,
            description: `Le dossier ${matchedOrder.orderNumber} est en cours de traitement bancaire mais le bordereau DHL pour l'envoi des documents de paiement à la banque n'est pas encore renseigné.`,
            daysStalled: daysAgo,
            orderNumber: matchedOrder.orderNumber,
            orderId: matchedOrder.orderId,
            orderType: 'intl_purchase',
            supplierName: matchedOrder.supplierName,
            suggestedAction: 'Renseigner le bordereau DHL d\'envoi banque',
            actionType: 'reply',
          };
          // avoid duplicates in daily digest
          if (!dailyDigest.some((d) => d.id === alarm.id)) {
            dailyDigest.push(alarm);
          }
        }
      }
    }

    items.push({
      email,
      matchedOrder,
      dhlTracking: dhlTracking || undefined,
      detectedDocuments,
      alarms,
      daysAgo,
    });
  }

  // Sort daily digest by urgency and days stalled descending
  dailyDigest.sort((a, b) => {
    const weight = { urgent: 3, warning: 2, info: 1 };
    if (weight[b.severity] !== weight[a.severity]) {
      return weight[b.severity] - weight[a.severity];
    }
    return b.daysStalled - a.daysStalled;
  });

  return {
    items,
    stalledCount,
    pendingDocsCount,
    dhlFoundCount,
    dailyDigest,
  };
}
