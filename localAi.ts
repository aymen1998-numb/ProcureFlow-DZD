/**
 * Local AI & Heuristic Intelligence Engine
 * 
 * Guarantees 100% local, privacy-first processing on the user's laptop.
 * - Zero external paid AI APIs.
 * - Default: Deterministic local heuristic NLP engine (runs directly in browser).
 * - Optional: Local Ollama on laptop (http://localhost:11434) using open-source models (Llama 3.2, Mistral, Qwen).
 */

export interface LocalAISettings {
  engineMode: 'local-heuristics' | 'local-ollama';
  ollamaEndpoint: string;
  selectedModel: string;
}

const STORAGE_KEY = 'procuraflow_local_ai_settings';

export const DEFAULT_LOCAL_SETTINGS: LocalAISettings = {
  engineMode: 'local-heuristics',
  ollamaEndpoint: 'http://localhost:11434',
  selectedModel: 'llama3.2',
};

export function getLocalAISettings(): LocalAISettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_LOCAL_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  return DEFAULT_LOCAL_SETTINGS;
}

export function saveLocalAISettings(settings: LocalAISettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save local AI settings', e);
  }
}

/**
 * Check if local Ollama daemon is running on user's laptop
 */
export async function testOllamaConnection(endpoint: string = 'http://localhost:11434'): Promise<{
  ok: boolean;
  models: string[];
  error?: string;
}> {
  try {
    const cleanEndpoint = endpoint.replace(/\/+$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`${cleanEndpoint}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        ok: false,
        models: [],
        error: `Ollama a répondu avec le statut ${res.status}`,
      };
    }

    const data = await res.json();
    const models = Array.isArray(data.models) ? data.models.map((m: any) => m.name || m.model) : [];
    return {
      ok: true,
      models,
    };
  } catch (err: any) {
    return {
      ok: false,
      models: [],
      error: err.name === 'AbortError' 
        ? 'Délai d\'attente dépassé (vérifiez si Ollama est lancé)' 
        : 'Impossible de joindre http://localhost:11434 (Ollama non démarré ou bloque CORS)',
    };
  }
}

/**
 * Generate email reply or follow-up draft using 100% local computing
 */
export async function generateLocalEmailDraft(params: {
  recipient: string;
  subject: string;
  daysStalled: number;
  orderNumber?: string;
  supplierName?: string;
  alarmType?: string;
  lang?: 'fr' | 'en';
}): Promise<{ text: string; engineUsed: string }> {
  const settings = getLocalAISettings();
  const lang = params.lang || 'fr';

  // If user configured local Ollama and wants to use it
  if (settings.engineMode === 'local-ollama') {
    try {
      const prompt = lang === 'fr'
        ? `Rédige un email professionnel et courtois en français pour relancer le fournisseur "${params.supplierName || 'Fournisseur'}" concernant la commande "${params.orderNumber || 'en cours'}" (Sujet: "${params.subject}"). Cela fait ${params.daysStalled} jours sans nouvelles. Demande poliment l'état d'avancement et les documents d'expédition (BL / AWB DHL). Donne uniquement le corps du message, sans préambule.`
        : `Write a professional and polite follow-up email in English to supplier "${params.supplierName || 'Supplier'}" regarding purchase order "${params.orderNumber || 'in progress'}" (Subject: "${params.subject}"). It has been ${params.daysStalled} days with no update. Inquire about shipment status and original shipping documents (BL / DHL AWB). Provide only the email body without preamble.`;

      const cleanEndpoint = settings.ollamaEndpoint.replace(/\/+$/, '');
      const response = await fetch(`${cleanEndpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.selectedModel || 'llama3.2',
          prompt: prompt,
          stream: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.response && data.response.trim().length > 10) {
          return {
            text: data.response.trim(),
            engineUsed: `Ollama Local (${settings.selectedModel}) - 0€ API`,
          };
        }
      }
    } catch {
      // Graceful fallback to deterministic local heuristic engine below
    }
  }

  // Deterministic Local Heuristic Engine (100% Offline, Zero-Cost, Instantaneous)
  const isUrgent = params.daysStalled >= 5;
  const orderRef = params.orderNumber ? `réf. ${params.orderNumber}` : 'nos derniers échanges';
  
  if (lang === 'fr') {
    const greeting = `Bonjour,\n\n`;
    let body = '';

    if (isUrgent) {
      body = `Nous revenons vers vous avec insistance concernant ${orderRef} (${params.subject}), resté sans réponse de votre part depuis maintenant ${params.daysStalled} jours.\n\n` +
        `Pour respecter le calendrier d'approvisionnement et le traitement en douane, nous avons impérativement besoin d'une confirmation de prise en charge et de la transmission des documents originaux (Facture commerciale, Packing List et bordereau d'expédition DHL / BL).\n\n` +
        `Merci de bien vouloir nous faire un retour d'ici la fin de journée.\n\n`;
    } else {
      body = `Sauf erreur de notre part, nous sommes en attente de votre retour concernant ${orderRef} (${params.subject}) transmis il y a ${params.daysStalled} jours.\n\n` +
        `Pourriez-vous nous confirmer l'état d'avancement de cette commande ainsi que les prévisions d'expédition et le numéro de suivi transporteur (AWB / DHL) ?\n\n` +
        `Restant à votre disposition pour tout renseignement complémentaire.\n\n`;
    }

    const signoff = `Cordialement,\nService Approvisionnements & Logistique Internationale`;
    return {
      text: `${greeting}${body}${signoff}`,
      engineUsed: 'Moteur Heuristique Local (Zero-API / 100% Hors-ligne)',
    };
  } else {
    const greeting = `Dear Partner,\n\n`;
    let body = '';

    if (isUrgent) {
      body = `We are urgently following up on ${orderRef} (${params.subject}), which has been pending without an update for ${params.daysStalled} days.\n\n` +
        `In order to comply with customs clearance and factory schedules, we urgently require your confirmation and shipping documentation (Commercial Invoice, Packing List, and DHL / BL AWB).\n\n` +
        `Please provide an immediate status update by return email today.\n\n`;
    } else {
      body = `We hope this message finds you well. We are following up on ${orderRef} (${params.subject}) sent ${params.daysStalled} days ago.\n\n` +
        `Could you please update us on the production and dispatch status, as well as share the courier tracking number (DHL AWB / BL) once available?\n\n` +
        `Thank you for your prompt cooperation.\n\n`;
    }

    const signoff = `Best regards,\nProcurement & International Logistics Department`;
    return {
      text: `${greeting}${body}${signoff}`,
      engineUsed: 'Local Heuristic Engine (Zero-API / 100% Offline)',
    };
  }
}
