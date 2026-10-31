import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Mail, 
  Send, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Truck, 
  FileText, 
  ExternalLink, 
  Search, 
  Filter, 
  Link2, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Check, 
  Eye, 
  Sparkles,
  Inbox,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  FileCheck,
  MessageSquare,
  HardDrive,
  Upload,
  FileUp,
  Bot,
  Trash2,
  Copy,
  Download
} from 'lucide-react';
import { 
  connectGmail, 
  getGmailToken, 
  isGmailConnected, 
  listGmailMessages, 
  sendGmailEmail, 
  ParsedEmail,
  modifyGmailLabels,
  isGmailDemoMode,
  enableGmailDemoMode,
  disconnectGmail,
  setManualGmailToken
} from '../lib/gmail';
import { 
  enrichEmailsWithWorkflow, 
  EnrichedEmailCommunication, 
  WorkflowAlarm,
  ExtractedDHLTracking 
} from '../lib/emailMatcher';
import { generateLocalEmailDraft, getLocalAISettings } from '../lib/localAi';
import { 
  getSavedLocalEmails, 
  addLocalEmails, 
  clearSavedLocalEmails, 
  parseUploadedEmailFile, 
  parseRawEmailText 
} from '../lib/localEmailParser';
import { useTranslation } from 'react-i18next';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';

interface CommunicationsFeedProps {
  onOpenPODetails?: (poId: string) => void;
  onOpenIntlDossier?: (dossierId: string) => void;
}

export default function CommunicationsFeed({
  onOpenPODetails,
  onOpenIntlDossier,
}: CommunicationsFeedProps) {
  const { user, tenantId } = useAuth();

  // Gmail State
  const [isConnected, setIsConnected] = useState<boolean>(isGmailConnected());
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [emails, setEmails] = useState<ParsedEmail[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Firestore DB State
  const [pos, setPos] = useState<any[]>([]);
  const [intlPurchases, setIntlPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  // UI Filter State
  const [activeFilter, setActiveFilter] = useState<'all' | 'stalled' | 'dhl' | 'local_po' | 'intl'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);

  // Reply / Compose Modal State (MANDATORY explicit confirmation)
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [replyTarget, setReplyTarget] = useState<{
    to: string;
    subject: string;
    body: string;
    threadId?: string;
    inReplyTo?: string;
    orderRef?: string;
  } | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState<boolean>(false);
  const [draftEngineNotice, setDraftEngineNotice] = useState<string | null>(null);

  // Link Order Modal State
  const [linkTarget, setLinkTarget] = useState<EnrichedEmailCommunication | null>(null);
  const [selectedOrderToLink, setSelectedOrderToLink] = useState<{ type: 'local_po' | 'intl'; id: string } | null>(null);
  const [isLinking, setIsLinking] = useState<boolean>(false);

  // Local Email Importer & Reader State
  const { t, i18n } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLocalImportOpen, setIsLocalImportOpen] = useState<boolean>(false);
  const [pastedEmailText, setPastedEmailText] = useState<string>('');
  const [testEmailForm, setTestEmailForm] = useState({
    from: 'fournisseur.test@siemens-industrie.de',
    subject: 'Dossier Paiement Banque DHL #4829103847 - INTL-2026-001 Facture & BL',
    body: 'Bonjour,\n\nNous vous confirmons l\'envoi par DHL (Bordereau n° 4829103847) du dossier complet de paiement destiné à votre banque domiciliataire (Facture commerciale originale, Bill of Lading BL et Certificat d\'Origine) concernant la commande INTL-2026-001.\n\nCordialement,\nService Export Siemens'
  });
  const [localImportMessage, setLocalImportMessage] = useState<string | null>(null);
  const [selectedEmailForReader, setSelectedEmailForReader] = useState<ParsedEmail | null>(null);
  const [isAnalyzingEmailLocally, setIsAnalyzingEmailLocally] = useState<boolean>(false);
  const [localAiAnalysisResult, setLocalAiAnalysisResult] = useState<{ summary?: string; engine?: string } | null>(null);

  const handleCreateTestEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailForm.subject.trim() && !testEmailForm.body.trim()) return;
    const rawEmail = `From: ${testEmailForm.from || 'test@fournisseur.com'}\nTo: achats@procuraflow.dz\nSubject: ${testEmailForm.subject || '(Sans objet)'}\nDate: ${new Date().toUTCString()}\n\n${testEmailForm.body}`;
    const parsed = parseRawEmailText(rawEmail, testEmailForm.subject || 'Test-Email');
    addLocalEmails([parsed]);
    setEmails(prev => [parsed, ...prev.filter(x => x.id !== parsed.id)]);
    setLocalImportMessage('E-mail de test ajouté avec succès dans la liste !');
    setIsLocalImportOpen(false);
    setSelectedEmailForReader(parsed);
    setLocalAiAnalysisResult(null);
  };

  // Local Email Handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      let imported: ParsedEmail[] = [];
      for (let i = 0; i < files.length; i++) {
        const parsed = await parseUploadedEmailFile(files[i]);
        imported = [...imported, ...parsed];
      }
      if (imported.length > 0) {
        addLocalEmails(imported);
        setEmails(prev => {
          const ids = new Set(prev.map(p => p.id));
          const newOnes = imported.filter(x => !ids.has(x.id));
          return [...newOnes, ...prev];
        });
        setLocalImportMessage(`${imported.length} e-mail(s) importé(s) et enregistrés localement sur votre PC !`);
      }
    } catch (err: any) {
      console.error(err);
      setLocalImportMessage(`Erreur lors de l'import: ${err.message || 'Fichier non reconnu'}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePasteImport = () => {
    if (!pastedEmailText.trim()) return;
    try {
      const parsed = parseRawEmailText(pastedEmailText, `Message-Local-${Date.now()}`);
      addLocalEmails([parsed]);
      setEmails(prev => [parsed, ...prev.filter(x => x.id !== parsed.id)]);
      setPastedEmailText('');
      setLocalImportMessage("1 e-mail importé et enregistré localement !");
    } catch (err: any) {
      console.error(err);
      setLocalImportMessage(`Erreur : ${err.message}`);
    }
  };

  const handleClearLocalEmails = () => {
    clearSavedLocalEmails();
    setEmails(prev => prev.filter(e => !e.labelIds.includes('LOCAL_IMPORT') && !e.labelIds.includes('LOCAL_IMAP')));
    setLocalImportMessage("E-mails locaux effacés de la mémoire locale.");
  };

  const handleAnalyzeEmailLocally = async (email: ParsedEmail) => {
    setIsAnalyzingEmailLocally(true);
    setLocalAiAnalysisResult(null);
    try {
      const aiSettings = getLocalAISettings();
      const prompt = `Analyze this supplier email for procurement management:
Subject: ${email.subject}
From: ${email.from}
Body:
${(email.body || email.snippet).slice(0, 1500)}

Please summarize:
1. Sender & Intent
2. Order or Proforma reference (if any)
3. Action items & deadlines
4. DHL or Shipping status`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);
      try {
        const response = await fetch(`${aiSettings.ollamaEndpoint}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: aiSettings.selectedModel || 'llama3.2',
            prompt: prompt,
            stream: false
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          const data = await response.json();
          setLocalAiAnalysisResult({
            summary: data.response,
            engine: `Ollama (${aiSettings.selectedModel || 'Local'}) - 100% Local sur votre machine`
          });
          return;
        }
      } catch {
        // Fall through to deterministic extractor
      }

      const tracking = (email.body + email.subject).match(/([0-9]{10,11})/);
      const isUrgent = /(urgent|retard|relance|stalled|important|delai|deadline)/i.test(email.subject + email.body);
      setLocalAiAnalysisResult({
        summary: `Synthèse locale de l'e-mail :\n• Expéditeur : ${email.from}\n• Sujet : ${email.subject}\n• Statut opérationnel : ${isUrgent ? 'Attention requise (délai ou relance)' : 'Communication normale'}\n${tracking ? `• N° Tracking / Dossier détecté : ${tracking[1]}\n` : ''}• Date de réception : ${new Date(email.timestamp).toLocaleString()}`,
        engine: 'Moteur d\'analyse heuristique local (Zero Cloud API)'
      });
    } finally {
      setIsAnalyzingEmailLocally(false);
    }
  };

  const handleGenerateLocalDraft = async () => {
    if (!replyTarget) return;
    setIsGeneratingDraft(true);
    setDraftEngineNotice(null);
    try {
      const result = await generateLocalEmailDraft({
        recipient: replyTarget.to,
        subject: replyTarget.subject,
        daysStalled: 3,
        orderNumber: replyTarget.orderRef,
        lang: i18n.language === 'en' ? 'en' : 'fr',
      });
      setReplyTarget({ ...replyTarget, body: result.text });
      setDraftEngineNotice(result.engineUsed);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  // Fetch POs, Intl Purchases, and Suppliers from Firestore
  useEffect(() => {
    if (!tenantId) return;

    // POs
    const poQuery = query(collection(db, 'purchase_orders'), where('tenantId', '==', tenantId));
    const unsubPOs = onSnapshot(poQuery, (snap) => {
      setPos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'purchase_orders'));

    // Intl Purchases
    const intlQuery = query(collection(db, 'intl_purchases'), where('tenantId', '==', tenantId));
    const unsubIntl = onSnapshot(intlQuery, (snap) => {
      setIntlPurchases(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'intl_purchases'));

    // Suppliers
    const supQuery = query(collection(db, 'suppliers'), where('tenantId', '==', tenantId));
    const unsubSup = onSnapshot(supQuery, (snap) => {
      setSuppliers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'suppliers'));

    return () => {
      unsubPOs();
      unsubIntl();
      unsubSup();
    };
  }, [tenantId]);

  // Demo & Manual Token state
  const isDemo = isGmailDemoMode();
  const [showManualToken, setShowManualToken] = useState<boolean>(false);
  const [manualToken, setManualToken] = useState<string>('');

  // Initial fetch if already connected & load local saved emails
  useEffect(() => {
    const localSaved = getSavedLocalEmails();
    if (localSaved.length > 0) {
      setEmails(localSaved);
    }
    if (isGmailConnected()) {
      fetchGmailMessages();
    }
  }, []);

  // Connect Gmail using Google Identity Services / Firebase Google Auth
  const handleConnectGmail = async () => {
    setIsLoadingAuth(true);
    setSyncError(null);
    try {
      const res = await connectGmail();
      if (res?.cancelled) {
        // User closed or dismissed the popup window
        return;
      }
      setIsConnected(true);
      await fetchGmailMessages();
    } catch (err: any) {
      const msg = err?.message || '';
      if (
        msg.includes('closed') ||
        msg.includes('annulée') ||
        msg.includes('popup-closed-by-user') ||
        msg.includes('cancelled')
      ) {
        return;
      }
      console.error(err);
      setSyncError(msg || "Échec de la connexion à Gmail.");
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleEnableDemo = async () => {
    enableGmailDemoMode();
    setIsConnected(true);
    setSyncError(null);
    await fetchGmailMessages();
  };

  const handleDisconnect = () => {
    disconnectGmail();
    setIsConnected(false);
    // Keep local imported emails visible even after disconnecting Gmail!
    const localSaved = getSavedLocalEmails();
    setEmails(localSaved);
    setSyncError(null);
  };

  const handleApplyManualToken = async () => {
    if (!manualToken.trim()) return;
    setManualGmailToken(manualToken.trim());
    setIsConnected(true);
    setShowManualToken(false);
    setSyncError(null);
    await fetchGmailMessages();
  };

  // Fetch messages from Gmail and merge with local emails
  const fetchGmailMessages = async () => {
    if (!isGmailConnected()) {
      setIsConnected(false);
      return;
    }
    setIsSyncing(true);
    setSyncError(null);
    try {
      // Query recent emails or relevant purchase keywords
      const fetched = await listGmailMessages('subject:(commande OR achat OR invoice OR facture OR dhl OR proforma OR bl OR quotation OR order) OR dhl', 35);
      const localSaved = getSavedLocalEmails();
      const combined = [...localSaved];
      const existingIds = new Set(combined.map(e => e.id));
      fetched.forEach(e => {
        if (!existingIds.has(e.id)) {
          combined.push(e);
          existingIds.add(e.id);
        }
      });
      setEmails(combined);
      setLastSyncTime(new Date());
    } catch (err: any) {
      console.error('Sync error:', err);
      if (err.message === 'TOKEN_EXPIRED' || err.message === 'NON_AUTHENTICATED') {
        setIsConnected(false);
        setSyncError("Session Gmail expirée. Veuillez vous reconnecter.");
      } else {
        setSyncError("Erreur lors de la synchronisation de vos emails Gmail.");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Enriched feed with alarms, DHL extraction, order matching
  const enrichedFeed = useMemo(() => {
    return enrichEmailsWithWorkflow(emails, pos, intlPurchases, suppliers, user?.email);
  }, [emails, pos, intlPurchases, suppliers, user?.email]);

  // Filtered communications
  const filteredItems = useMemo(() => {
    return enrichedFeed.items.filter((item) => {
      // Category filter
      if (activeFilter === 'stalled') {
        if (!item.alarms.some((a) => a.type === 'STALLED_THREAD_3D' || a.type === 'WAITING_OUR_REPLY')) return false;
      } else if (activeFilter === 'dhl') {
        if (!item.dhlTracking && !item.detectedDocuments.some((d) => d.type === 'bl')) return false;
      } else if (activeFilter === 'local_po') {
        if (item.matchedOrder?.orderType !== 'local_po') return false;
      } else if (activeFilter === 'intl') {
        if (item.matchedOrder?.orderType !== 'intl_purchase') return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesSubject = item.email.subject.toLowerCase().includes(term);
        const matchesFrom = item.email.from.toLowerCase().includes(term);
        const matchesSnippet = item.email.snippet.toLowerCase().includes(term);
        const matchesOrder = item.matchedOrder?.orderNumber.toLowerCase().includes(term);
        const matchesSupplier = item.matchedOrder?.supplierName.toLowerCase().includes(term);
        const matchesDHL = item.dhlTracking?.trackingNumber.includes(term);

        if (!matchesSubject && !matchesFrom && !matchesSnippet && !matchesOrder && !matchesSupplier && !matchesDHL) {
          return false;
        }
      }

      return true;
    });
  }, [enrichedFeed.items, activeFilter, searchTerm]);

  // Quick Action: Open Compose/Reply Modal with Pre-filled Template
  const handleOpenReplyModal = (
    item: EnrichedEmailCommunication, 
    templateType: 'relance_inactivite' | 'demande_docs_dhl' | 'normal'
  ) => {
    const to = item.email.fromEmail || item.email.from;
    const subject = item.email.subject.startsWith('Re:') ? item.email.subject : `Re: ${item.email.subject}`;
    const orderRef = item.matchedOrder?.orderNumber || 'votre offre commerciale';

    let body = '';
    if (templateType === 'relance_inactivite') {
      body = `Bonjour,\n\nNous nous permettons de vous relancer concernant notre échange au sujet de la commande / dossier ${orderRef}.\n\nN'ayant pas eu de retour de votre part depuis plusieurs jours, pourriez-vous nous transmettre un état d'avancement ainsi que la confirmation des délais prévus ?\n\nDans l'attente de votre prompt retour,\nCordialement,\nService Approvisionnements / ProcuraFlow`;
    } else if (templateType === 'demande_docs_dhl') {
      body = `Bonjour,\n\nConcernant l'expédition du dossier d'achat international ${orderRef}, pourriez-vous nous communiquer le numéro de bordereau de suivi DHL Express ainsi que les copies du Bill of Lading (BL), de la Facture Commerciale et du Certificat d'Origine dès disponibilité ?\n\nCes éléments sont indispensables pour l'ouverture du dossier de dédouanement.\n\nMerci d'avance pour votre collaboration,\nBien cordialement,\nService Transit & Importations / ProcuraFlow`;
    } else {
      body = `Bonjour,\n\nBien reçu votre message concernant le dossier ${orderRef}.\n\n...\n\nCordialement,`;
    }

    setReplyTarget({
      to,
      subject,
      body,
      threadId: item.email.threadId,
      inReplyTo: item.email.id,
      orderRef: item.matchedOrder?.orderNumber,
    });
    setIsComposeOpen(true);
  };

  // Execute Email Send with user confirmation
  const handleConfirmSendEmail = async () => {
    if (!replyTarget) return;
    setIsSending(true);
    setSendSuccessMessage(null);
    try {
      await sendGmailEmail({
        to: replyTarget.to,
        subject: replyTarget.subject,
        body: replyTarget.body,
        threadId: replyTarget.threadId,
        inReplyTo: replyTarget.inReplyTo,
      });

      setSendSuccessMessage(`Email envoyé avec succès à ${replyTarget.to} !`);
      setTimeout(() => {
        setIsComposeOpen(false);
        setReplyTarget(null);
        setSendSuccessMessage(null);
      }, 1500);

      // Refresh emails to update threads
      fetchGmailMessages();
    } catch (err: any) {
      console.error(err);
      alert(`Erreur d'envoi: ${err.message || 'Impossible d\'envoyer l\'email'}`);
    } finally {
      setIsSending(false);
    }
  };

  // Quick Action: Link DHL tracking number to an International Purchase Dossier in Firestore
  const handleApplyDHLToDossier = async (dossierId: string, dhlTracking: ExtractedDHLTracking) => {
    try {
      await updateDoc(doc(db, 'intl_purchases', dossierId), {
        dhlTrackingNumber: dhlTracking.trackingNumber,
        dhlTrackingUrl: dhlTracking.trackingUrl,
        'documents.bl': true,
        updatedAt: new Date().toISOString(),
      });
      alert(`Numéro de suivi DHL ${dhlTracking.trackingNumber} associé au dossier avec succès !`);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `intl_purchases/${dossierId}`);
    }
  };

  // Handle manual linking of email to order
  const handleLinkOrderSubmit = async () => {
    if (!linkTarget || !selectedOrderToLink) return;
    setIsLinking(true);
    try {
      if (selectedOrderToLink.type === 'intl') {
        const updateData: any = {
          lastEmailSubject: linkTarget.email.subject,
          lastEmailSender: linkTarget.email.from,
          lastEmailDate: new Date(linkTarget.email.timestamp).toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (linkTarget.dhlTracking) {
          updateData.dhlTrackingNumber = linkTarget.dhlTracking.trackingNumber;
          updateData.dhlTrackingUrl = linkTarget.dhlTracking.trackingUrl;
          updateData['documents.bl'] = true;
        }
        await updateDoc(doc(db, 'intl_purchases', selectedOrderToLink.id), updateData);
      } else {
        await updateDoc(doc(db, 'purchase_orders', selectedOrderToLink.id), {
          lastEmailSubject: linkTarget.email.subject,
          lastEmailSender: linkTarget.email.from,
          lastEmailDate: new Date(linkTarget.email.timestamp).toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      setLinkTarget(null);
      setSelectedOrderToLink(null);
      alert("Liaison de l'email à la commande effectuée !");
    } catch (err: any) {
      console.error(err);
      alert("Erreur lors de la liaison");
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* TOP HEADER: GMAIL CONNECTION BAR & DIGEST STATS */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-sm ${
              isConnected ? 'bg-blue-50 text-[#136AA8]' : 'bg-slate-100 text-slate-400'
            }`}>
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-800 tracking-tight">
                  Centre de Communication & Expéditions
                </h2>
                {isConnected ? (
                  isDemo ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 text-[#136AA8] border border-blue-200">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Mode Démo Approvisionnement
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Gmail Connecté
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    Non synchronisé
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Gestion des échanges fournisseurs, suivi des dossiers de paiement envoyés à la banque (DHL) et alertes d'inactivité
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Local Emails Button */}
            <button
              onClick={() => { setIsLocalImportOpen(true); setLocalImportMessage(null); }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 shadow-xs transition-all cursor-pointer active:scale-95"
              title="Importer et lire vos e-mails locaux (.eml, .mbox, .json, texte)"
            >
              <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
              <span>{i18n.language === 'en' ? 'Local Emails (.eml)' : 'E-mails Locaux (.eml)'}</span>
              {emails.filter(e => e.labelIds.includes('LOCAL_IMPORT') || e.labelIds.includes('LOCAL_IMAP')).length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-mono">
                  {emails.filter(e => e.labelIds.includes('LOCAL_IMPORT') || e.labelIds.includes('LOCAL_IMAP')).length}
                </span>
              )}
            </button>

            {isConnected ? (
              <>
                <button
                  onClick={fetchGmailMessages}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black tracking-wide transition-all disabled:opacity-50 cursor-pointer"
                  title="Synchroniser les emails maintenant"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#136AA8]' : ''}`} />
                  {isSyncing ? (i18n.language === 'en' ? 'Syncing...' : 'Synchronisation...') : (i18n.language === 'en' ? 'Refresh' : 'Actualiser')}
                </button>
                {lastSyncTime && (
                  <span className="text-[11px] font-mono text-slate-400 hidden lg:inline">
                    Mis à jour {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                <button
                  onClick={handleDisconnect}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Déconnecter"
                >
                  <X className="w-3.5 h-3.5" />
                  {i18n.language === 'en' ? 'Disconnect' : 'Déconnecter'}
                </button>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleConnectGmail}
                  disabled={isLoadingAuth}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#136AA8] hover:bg-[#105688] text-white rounded-xl text-xs font-black tracking-wide shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  {isLoadingAuth ? (i18n.language === 'en' ? 'Connecting...' : 'Connexion en cours...') : (i18n.language === 'en' ? 'Connect Gmail' : 'Connecter Gmail')}
                </button>
                <button
                  onClick={handleEnableDemo}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 shadow-xs transition-all cursor-pointer"
                  title="Explorer avec des emails d'achats simulés"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  {i18n.language === 'en' ? 'Demo Mode (DHL)' : 'Mode Démo (DHL)'}
                </button>
              </div>
            )}
          </div>
        </div>

        {syncError && (
          <div className="mt-4 p-4 bg-amber-50/90 border border-amber-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold">{syncError}</p>
                <p className="text-[11px] text-amber-700 mt-0.5 font-medium">
                  Astuce : vous pouvez continuer avec le <strong>Mode Démo Approvisionnement</strong> (emails d'achats DHL et fournisseurs simulés) ou autoriser les fenêtres pop-up du navigateur.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-auto">
              <button
                onClick={handleEnableDemo}
                className="px-3.5 py-1.5 bg-[#136AA8] hover:bg-[#105688] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                Activer le Mode Démo
              </button>
              <button
                onClick={handleConnectGmail}
                className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold transition-colors"
              >
                Réessayer
              </button>
              <button
                onClick={() => setShowManualToken(!showManualToken)}
                className="px-2 py-1.5 text-amber-800 hover:underline text-xs"
              >
                Jeton
              </button>
            </div>
          </div>
        )}

        {showManualToken && (
          <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center gap-3">
            <input
              type="password"
              placeholder="Coller un Google OAuth Access Token (ya29...)"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              className="flex-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 outline-none focus:border-[#136AA8]"
            />
            <button
              onClick={handleApplyManualToken}
              className="px-4 py-2 bg-[#136AA8] text-white rounded-xl text-xs font-bold whitespace-nowrap"
            >
              Appliquer le jeton
            </button>
          </div>
        )}
      </div>

      {/* DAILY MORNING ALERTS DIGEST BANNER */}
      {enrichedFeed.dailyDigest.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border border-amber-200/80 rounded-3xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  Digest Matinal des Alarmes & Inactivités
                  <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {enrichedFeed.dailyDigest.length} alertes
                  </span>
                </h3>
                <p className="text-xs text-slate-600 font-medium">
                  Fournisseurs sans réponse depuis 3+ jours et bordereaux d'expédition en attente
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {enrichedFeed.dailyDigest.slice(0, 6).map((alarm) => (
              <div 
                key={alarm.id}
                className="bg-white/90 backdrop-blur border border-amber-200/60 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:shadow transition-shadow"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      alarm.severity === 'urgent' 
                        ? 'bg-red-100 text-red-700' 
                        : alarm.severity === 'warning' 
                        ? 'bg-amber-100 text-amber-800' 
                        : 'bg-blue-100 text-[#136AA8]'
                    }`}>
                      {alarm.daysStalled ? `Inactif ${alarm.daysStalled}j` : 'Action requise'}
                    </span>
                    {alarm.orderNumber && (
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        {alarm.orderNumber}
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-black text-slate-800 line-clamp-1 mb-1">
                    {alarm.title}
                  </h4>
                  <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                    {alarm.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  {alarm.actionType === 'reply' ? (
                    <button
                      onClick={() => {
                        const targetComm = enrichedFeed.items.find((i) => i.email.id === alarm.emailId);
                        if (targetComm) {
                          handleOpenReplyModal(targetComm, 'relance_inactivite');
                        }
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-black text-[#136AA8] hover:text-[#0f4b75] transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Relancer le fournisseur
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-bold">
                      {alarm.suggestedAction}
                    </span>
                  )}
                  {alarm.orderId && alarm.orderType === 'intl_purchase' && onOpenIntlDossier && (
                    <button
                      onClick={() => onOpenIntlDossier(alarm.orderId!)}
                      className="text-xs text-slate-400 hover:text-slate-700 font-bold"
                      title="Ouvrir le dossier"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FILTER TABS & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl overflow-x-auto">
          {[
            { id: 'all', label: 'Tous les échanges', count: enrichedFeed.items.length },
            { id: 'stalled', label: 'Inactivité (3j+)', count: enrichedFeed.stalledCount, badgeColor: 'bg-red-500 text-white' },
            { id: 'dhl', label: 'DHL Banque (Paiements)', count: enrichedFeed.dhlFoundCount, badgeColor: 'bg-amber-500 text-white' },
            { id: 'intl', label: 'Achats Internationaux' },
            { id: 'local_po', label: 'Commandes Locales' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                activeFilter === tab.id
                  ? 'bg-white text-slate-800 shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  tab.badgeColor || 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par n° commande, fournisseur, DHL..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#136AA8]/20 focus:border-[#136AA8]"
          />
        </div>
      </div>

      {/* MASTER ORDERS & COMMUNICATIONS TABLE */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto text-slate-400 mb-4">
              <Inbox className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-700">Aucun message correspondant</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {isConnected 
                ? 'Aucun email trouvé correspondant aux filtres ou mots-clés de commandes actuels.'
                : 'Connectez votre boîte Gmail pour synchroniser automatiquement les échanges avec vos fournisseurs.'}
            </p>
            {!isConnected && (
              <button
                onClick={handleConnectGmail}
                className="mt-4 px-5 py-2.5 bg-[#136AA8] text-white rounded-xl text-xs font-bold hover:bg-[#0f4b75] transition-colors"
              >
                Connecter Gmail maintenant
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/80 text-[10px] uppercase font-black tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Statut & Alarme</th>
                  <th className="py-3.5 px-4">Dossier / Commande</th>
                  <th className="py-3.5 px-4">Fournisseur & Expéditeur</th>
                  <th className="py-3.5 px-4">Objet du message</th>
                  <th className="py-3.5 px-4">Dossier Paiement DHL (Banque)</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredItems.map((item) => {
                  const isExpanded = expandedEmailId === item.email.id;
                  const hasStalledAlarm = item.alarms.some((a) => a.type === 'STALLED_THREAD_3D' || a.type === 'WAITING_OUR_REPLY');

                  return (
                    <React.Fragment key={item.email.id}>
                      <tr className={`hover:bg-slate-50/60 transition-colors ${
                        hasStalledAlarm ? 'bg-amber-50/20' : ''
                      }`}>
                        {/* Status & Alarm Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {hasStalledAlarm ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-red-50 text-red-700 border border-red-200">
                              <AlertTriangle className="w-3 h-3 text-red-500" />
                              Inactif ({item.daysAgo}j)
                            </span>
                          ) : item.dhlTracking ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200" title="Envoi du dossier de paiement et documents originaux à la banque">
                              <Truck className="w-3 h-3 text-amber-600" />
                              Bordereau DHL Banque
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {item.daysAgo === 0 ? "Aujourd'hui" : `Il y a ${item.daysAgo}j`}
                            </span>
                          )}
                        </td>

                        {/* Order / Purchase Link */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {item.matchedOrder ? (
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                item.matchedOrder.orderType === 'intl_purchase'
                                  ? 'bg-blue-50 text-[#136AA8] border border-blue-100'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                              }`}>
                                {item.matchedOrder.orderNumber}
                              </span>
                              {item.matchedOrder.orderType === 'intl_purchase' && onOpenIntlDossier && (
                                <button
                                  onClick={() => onOpenIntlDossier(item.matchedOrder!.orderId)}
                                  className="text-slate-400 hover:text-[#136AA8]"
                                  title="Ouvrir le dossier"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              )}
                              {item.matchedOrder.orderType === 'local_po' && onOpenPODetails && (
                                <button
                                  onClick={() => onOpenPODetails(item.matchedOrder!.orderId)}
                                  className="text-slate-400 hover:text-[#136AA8]"
                                  title="Ouvrir le bon de commande"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setLinkTarget(item);
                                setSelectedOrderToLink(null);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-[#136AA8] transition-colors"
                            >
                              <Link2 className="w-3 h-3" />
                              + Lier dossier
                            </button>
                          )}
                        </td>

                        {/* Supplier & Sender */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800 truncate max-w-[180px]">
                            {item.matchedOrder?.supplierName || item.email.from.split('<')[0].replace(/"/g, '')}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">
                            {item.email.fromEmail}
                          </div>
                        </td>

                        {/* Subject & Preview */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            {item.email.labelIds?.includes('LOCAL_IMPORT') && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider shrink-0">
                                Local
                              </span>
                            )}
                            <button
                              onClick={() => {
                                setSelectedEmailForReader(item.email);
                                setLocalAiAnalysisResult(null);
                              }}
                              className="font-bold text-slate-800 truncate max-w-[240px] text-left hover:text-[#136AA8] transition-colors cursor-pointer"
                              title="Cliquer pour lire le message complet et analyser"
                            >
                              {item.email.subject}
                            </button>
                            <button
                              onClick={() => setExpandedEmailId(isExpanded ? null : item.email.id)}
                              className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                              title={isExpanded ? 'Réduire' : 'Aperçu rapide'}
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <div 
                            onClick={() => {
                              setSelectedEmailForReader(item.email);
                              setLocalAiAnalysisResult(null);
                            }}
                            className="text-[11px] text-slate-500 line-clamp-1 max-w-[280px] cursor-pointer hover:text-slate-800"
                          >
                            {item.email.snippet}
                          </div>
                        </td>

                        {/* DHL Bank Payment Tracking & Documents */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1.5">
                            {item.dhlTracking && (
                              <div className="flex items-center gap-2">
                                <a
                                  href={item.dhlTracking.trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-black hover:bg-amber-200 transition-colors"
                                  title="Suivi de l'envoi du dossier de paiement et documents originaux à la banque domiciliataire"
                                >
                                  <Truck className="w-3 h-3 text-amber-700" />
                                  DHL Banque : {item.dhlTracking.trackingNumber}
                                  <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                </a>

                                {item.matchedOrder && item.matchedOrder.orderType === 'intl_purchase' && (
                                  <button
                                    onClick={() => handleApplyDHLToDossier(item.matchedOrder!.orderId, item.dhlTracking!)}
                                    className="text-[10px] font-bold text-emerald-700 hover:underline"
                                    title="Associer ce bordereau d'envoi bancaire au dossier d'importation"
                                  >
                                    Lier au dossier banque
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Detected Documents Tags */}
                            <div className="flex flex-wrap gap-1">
                              {item.detectedDocuments.map((doc, idx) => (
                                <span 
                                  key={idx}
                                  className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200"
                                >
                                  {doc.type === 'facture' ? 'Facture' : doc.type === 'bl' ? 'BL / AWB' : doc.type === 'certOrigin' ? 'Cert. Origine' : 'Packing List'}
                                </span>
                              ))}
                            </div>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleOpenReplyModal(item, hasStalledAlarm ? 'relance_inactivite' : 'normal')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#136AA8] hover:bg-[#0f4b75] text-white text-[11px] font-black transition-colors"
                            >
                              <Send className="w-3 h-3" />
                              {hasStalledAlarm ? 'Relancer' : 'Répondre'}
                            </button>

                            <button
                              onClick={() => {
                                setSelectedEmailForReader(item.email);
                                setLocalAiAnalysisResult(null);
                              }}
                              className="p-1.5 text-slate-400 hover:text-[#136AA8] rounded-lg hover:bg-blue-50 transition-colors"
                              title="Lire le message et analyser en local"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Message Details Drawer */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-slate-50/70 p-5 border-b border-slate-200">
                            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
                              <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-2">
                                <div>
                                  <span className="font-bold text-slate-700">De:</span> {item.email.from} | <span className="font-bold text-slate-700">À:</span> {item.email.to}
                                </div>
                                <div className="font-mono text-[11px]">
                                  {new Date(item.email.timestamp).toLocaleString('fr-FR')}
                                </div>
                              </div>

                              <div className="text-xs text-slate-800 whitespace-pre-wrap font-sans max-h-60 overflow-y-auto leading-relaxed">
                                {item.email.body || item.email.snippet}
                              </div>

                              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {item.dhlTracking && (
                                    <span className="text-[11px] text-amber-800 font-bold flex items-center gap-1">
                                      <Truck className="w-3.5 h-3.5" />
                                      {item.dhlTracking.detectedContext}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleOpenReplyModal(item, 'demande_docs_dhl')}
                                    className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold border border-amber-200"
                                  >
                                    Demander documents & bordereau DHL
                                  </button>
                                  <button
                                    onClick={() => handleOpenReplyModal(item, 'relance_inactivite')}
                                    className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-[#136AA8] rounded-lg text-xs font-bold border border-blue-200"
                                  >
                                    Relancer le fournisseur
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* COMPOSE / REPLY MODAL (Explicit User Confirmation Dialog per Workspace Skill) */}
      <AnimatePresence>
        {isComposeOpen && replyTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 w-full max-w-xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#136AA8] flex items-center justify-center font-bold">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">
                      Confirmation d'Envoi d'Email
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Envoi d'un message direct via votre compte Gmail connecté
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsComposeOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {sendSuccessMessage ? (
                <div className="p-6 text-center space-y-2">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">{sendSuccessMessage}</h4>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Destinataire
                    </label>
                    <input
                      type="text"
                      value={replyTarget.to}
                      onChange={(e) => setReplyTarget({ ...replyTarget, to: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-[#136AA8]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Objet
                    </label>
                    <input
                      type="text"
                      value={replyTarget.subject}
                      onChange={(e) => setReplyTarget({ ...replyTarget, subject: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-[#136AA8]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Message
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateLocalDraft}
                        disabled={isGeneratingDraft}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                        title="Rédiger avec le moteur IA local ou Ollama (sans frais d'API)"
                      >
                        <Sparkles size={12} className="text-indigo-600" />
                        {isGeneratingDraft ? 'Génération locale...' : 'IA Locale (0€ API)'}
                      </button>
                    </div>

                    {draftEngineNotice && (
                      <div className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 mb-1.5 flex items-center gap-1.5">
                        <Check size={12} className="text-emerald-600" />
                        <span>{draftEngineNotice}</span>
                      </div>
                    )}

                    <textarea
                      rows={7}
                      value={replyTarget.body}
                      onChange={(e) => setReplyTarget({ ...replyTarget, body: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-[#136AA8] leading-relaxed"
                    />
                  </div>

                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 font-medium flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Cet email sera expédié avec votre adresse Gmail. Veuillez vérifier son contenu avant confirmation.</span>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsComposeOpen(false)}
                      disabled={isSending}
                      className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmSendEmail}
                      disabled={isSending || !replyTarget.to.trim()}
                      className="px-5 py-2.5 bg-[#136AA8] hover:bg-[#0f4b75] text-white rounded-xl text-xs font-black tracking-wide shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSending ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Envoi en cours...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Confirmer & Envoyer l'email
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LINK TO ORDER MODAL */}
      <AnimatePresence>
        {linkTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 w-full max-w-lg"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#136AA8] flex items-center justify-center font-bold">
                    <Link2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">
                      Lier cet email à une commande
                    </h3>
                    <p className="text-xs text-slate-500">
                      Sélectionnez le dossier ou bon de commande associé
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setLinkTarget(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <div className="font-bold text-slate-800 truncate">{linkTarget.email.subject}</div>
                  <div className="text-[11px] text-slate-400">Expéditeur: {linkTarget.email.from}</div>
                  {linkTarget.dhlTracking && (
                    <div className="mt-1 text-amber-800 font-mono font-bold text-[11px]">
                      AWB DHL: {linkTarget.dhlTracking.trackingNumber}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                    Dossiers Internationaux Récents
                  </label>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50">
                    {intlPurchases.length === 0 ? (
                      <div className="text-center py-2 text-xs text-slate-400">Aucun dossier international</div>
                    ) : (
                      intlPurchases.map((intl) => (
                        <div
                          key={intl.id}
                          onClick={() => setSelectedOrderToLink({ type: 'intl', id: intl.id })}
                          className={`p-2 rounded-lg cursor-pointer text-xs font-bold transition-all flex items-center justify-between ${
                            selectedOrderToLink?.id === intl.id
                              ? 'bg-[#136AA8] text-white shadow-sm'
                              : 'bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div>
                            <span className="font-mono">{intl.daNumber}</span> - {intl.supplierName || 'Fournisseur International'}
                          </div>
                          <span className="text-[10px] opacity-80 uppercase">{intl.status}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                    Bons de Commande Locaux Récents
                  </label>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50">
                    {pos.length === 0 ? (
                      <div className="text-center py-2 text-xs text-slate-400">Aucun bon de commande</div>
                    ) : (
                      pos.map((po) => (
                        <div
                          key={po.id}
                          onClick={() => setSelectedOrderToLink({ type: 'local_po', id: po.id })}
                          className={`p-2 rounded-lg cursor-pointer text-xs font-bold transition-all flex items-center justify-between ${
                            selectedOrderToLink?.id === po.id
                              ? 'bg-[#136AA8] text-white shadow-sm'
                              : 'bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div>
                            <span className="font-mono">{po.poNumber}</span> - {po.supplierName || 'Fournisseur'}
                          </div>
                          <span className="text-[10px] opacity-80 uppercase">{po.status}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setLinkTarget(null)}
                    disabled={isLinking}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleLinkOrderSubmit}
                    disabled={isLinking || !selectedOrderToLink}
                    className="px-5 py-2.5 bg-[#136AA8] hover:bg-[#0f4b75] text-white rounded-xl text-xs font-black tracking-wide shadow-md transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isLinking ? 'Liaison...' : 'Confirmer la liaison'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* MODAL 3: LOCAL EMAIL IMPORTER & SYNC GUIDE */}
        {isLocalImportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      {i18n.language === 'en' ? 'Local Email Importer & Offline Reader' : 'Importation & Lecture Locale d\'E-mails'}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {i18n.language === 'en' 
                        ? 'Read all procurement emails directly from your laptop without any external cloud AI API.' 
                        : 'Lisez tous vos e-mails fournisseurs directement depuis votre ordinateur sans aucune API cloud.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsLocalImportOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {localImportMessage && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between">
                  <span>{localImportMessage}</span>
                  <button onClick={() => setLocalImportMessage(null)} className="text-emerald-600 hover:text-emerald-900">
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="space-y-5">
                {/* Quick Test Email Form */}
                <form onSubmit={handleCreateTestEmail} className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-[#136AA8] flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      {i18n.language === 'en' ? 'Create a Test Email Instantly' : 'Créer un E-mail de Test Instantané'}
                    </span>
                    <span className="text-[10px] bg-[#136AA8] text-white px-2 py-0.5 rounded font-bold">
                      Test 1-Clic
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        {i18n.language === 'en' ? 'Sender Email' : 'Expéditeur (From)'}
                      </label>
                      <input
                        type="text"
                        value={testEmailForm.from}
                        onChange={(e) => setTestEmailForm({ ...testEmailForm, from: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                        placeholder="fournisseur@exemple.com"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        {i18n.language === 'en' ? 'Subject (include DHL # or Order #)' : 'Objet (avec N° DHL Banque ou N° Dossier)'}
                      </label>
                      <input
                        type="text"
                        value={testEmailForm.subject}
                        onChange={(e) => setTestEmailForm({ ...testEmailForm, subject: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                        placeholder="Ex: Dossier Paiement DHL #4829103847 - INTL-2026-001"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                      {i18n.language === 'en' ? 'Message Body' : 'Corps du message'}
                    </label>
                    <textarea
                      rows={3}
                      value={testEmailForm.body}
                      onChange={(e) => setTestEmailForm({ ...testEmailForm, body: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#136AA8] hover:bg-[#0f4b75] text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer active:scale-95 inline-flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{i18n.language === 'en' ? 'Add & Open Test Email Now' : 'Ajouter et ouvrir cet e-mail de test'}</span>
                    </button>
                  </div>
                </form>

                {/* File Upload Area */}
                <div className="p-5 border-2 border-dashed border-emerald-300 rounded-2xl bg-emerald-50/40 text-center hover:bg-emerald-50/70 transition-colors">
                  <FileUp className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-800">
                    {i18n.language === 'en' ? 'Select Email Files from your Computer' : 'Sélectionnez des fichiers e-mails de votre PC'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 mb-3">
                    Formats supportés : <strong>.eml</strong> (Outlook/Thunderbird), <strong>.mbox</strong>, <strong>.json</strong> ou fichiers texte brut.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".eml,.mbox,.json,.txt,.msg"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="local-email-upload-input"
                  />
                  <label
                    htmlFor="local-email-upload-input"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs transition-all active:scale-95"
                  >
                    <Upload size={14} />
                    <span>{i18n.language === 'en' ? 'Browse Files (.eml, .mbox, .json)' : 'Parcourir mes fichiers (.eml, .mbox)'}</span>
                  </label>
                </div>

                {/* Paste Raw Email Area */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    {i18n.language === 'en' ? 'Or Paste Raw Email Text / Headers' : 'Ou coller le texte brut d\'un e-mail (avec en-têtes ou corps) :'}
                  </label>
                  <textarea
                    rows={4}
                    value={pastedEmailText}
                    onChange={(e) => setPastedEmailText(e.target.value)}
                    placeholder={"From: fournisseur@eurotech.de\nSubject: Expédition DHL #9842103849 - Facture finale\nDate: Mon, 27 Oct 2026\n\nBonjour, veuillez trouver ci-joint les documents d'expédition..."}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-200"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handlePasteImport}
                      disabled={!pastedEmailText.trim()}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
                    >
                      {i18n.language === 'en' ? 'Parse & Import Message' : 'Analyser & Importer ce message'}
                    </button>
                  </div>
                </div>

                {/* Local Python Sync Script Option */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-[#136AA8]" />
                      {i18n.language === 'en' ? 'Automated Local IMAP Sync Script (Python)' : 'Script Local Python de Synchronisation IMAP (Gmail / Outlook)'}
                    </span>
                    <span className="text-[10px] bg-blue-100 text-[#136AA8] px-2 py-0.5 rounded font-bold">
                      Zero-Cloud
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {i18n.language === 'en'
                      ? 'You can run the included Python script on your laptop to download all live supplier emails into local_emails.json with zero cloud API keys:'
                      : 'Un script Python est prêt dans votre projet pour télécharger automatiquement vos e-mails depuis Gmail/IMAP directement sur votre laptop :'}
                  </p>
                  <div className="p-2.5 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl flex items-center justify-between">
                    <code>python scripts/local_email_sync.py</code>
                    <button
                      onClick={() => navigator.clipboard.writeText('python scripts/local_email_sync.py')}
                      className="text-slate-400 hover:text-white p-1 text-[11px] flex items-center gap-1 cursor-pointer"
                      title="Copier la commande"
                    >
                      <Copy size={13} />
                      <span>Copier</span>
                    </button>
                  </div>
                </div>

                {/* Storage Management */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <span>
                    {emails.filter(e => e.labelIds.includes('LOCAL_IMPORT') || e.labelIds.includes('LOCAL_IMAP')).length} e-mail(s) stocké(s) localement.
                  </span>
                  <button
                    onClick={handleClearLocalEmails}
                    className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-bold cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>{i18n.language === 'en' ? 'Clear Local Storage' : 'Vider les e-mails locaux'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* MODAL 4: FULL EMAIL READER & LOCAL AI ANALYSIS */}
        {selectedEmailForReader && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto space-y-5"
            >
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {selectedEmailForReader.labelIds.includes('LOCAL_IMPORT') && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">
                        Import Local (PC)
                      </span>
                    )}
                    {selectedEmailForReader.hasAttachments && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        Pièces jointes incluses
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-black text-slate-900 leading-snug">
                    {selectedEmailForReader.subject}
                  </h3>
                </div>
                <button
                  onClick={() => { setSelectedEmailForReader(null); setLocalAiAnalysisResult(null); }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sender & Metadata Bar */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px]">De : </span>
                    <span className="font-bold text-slate-900">{selectedEmailForReader.from}</span>
                  </div>
                  <span className="font-mono text-slate-500 text-[11px]">
                    {new Date(selectedEmailForReader.timestamp).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[10px]">À : </span>
                  <span className="text-slate-700">{selectedEmailForReader.to}</span>
                </div>
              </div>

              {/* Local AI Analysis Box */}
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-[#136AA8]" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                      {i18n.language === 'en' ? 'Local AI Analysis (Ollama / Laptop)' : 'Analyseur IA Local (Ollama / Laptop)'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleAnalyzeEmailLocally(selectedEmailForReader)}
                    disabled={isAnalyzingEmailLocally}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#136AA8] hover:bg-[#0f4b75] text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    <Sparkles size={13} className={isAnalyzingEmailLocally ? 'animate-spin' : ''} />
                    <span>{isAnalyzingEmailLocally ? 'Analyse en cours...' : 'Analyser le message'}</span>
                  </button>
                </div>

                {localAiAnalysisResult ? (
                  <div className="mt-2 pt-2 border-t border-blue-200/70 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                    <div className="p-3 bg-white rounded-xl border border-blue-100 font-sans shadow-2xs">
                      {localAiAnalysisResult.summary}
                    </div>
                    <p className="text-[10px] text-blue-600 font-mono mt-1">
                      Moteur : {localAiAnalysisResult.engine}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Cliquez sur "Analyser le message" pour extraire instantanément l'intention du fournisseur, les numéros de commande et les délais grâce au modèle local sans quitter votre PC.
                  </p>
                )}
              </div>

              {/* Full Email Body */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Contenu du Message
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(selectedEmailForReader.body || selectedEmailForReader.snippet)}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                  >
                    <Copy size={13} />
                    <span>Copier le texte</span>
                  </button>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-800 font-sans whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed select-text">
                  {selectedEmailForReader.body || selectedEmailForReader.snippet}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setSelectedEmailForReader(null); setLocalAiAnalysisResult(null); }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Fermer
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const enriched = enrichedFeed.items.find(i => i.email.id === selectedEmailForReader.id);
                      if (enriched) {
                        handleOpenReplyModal(enriched, 'normal');
                      } else {
                        setReplyTarget({
                          to: selectedEmailForReader.fromEmail,
                          subject: `Re: ${selectedEmailForReader.subject}`,
                          body: '',
                          threadId: selectedEmailForReader.threadId
                        });
                        setIsComposeOpen(true);
                      }
                      setSelectedEmailForReader(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#136AA8] hover:bg-[#0f4b75] text-white rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Send size={14} />
                    <span>Rédiger une réponse</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
