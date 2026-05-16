import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  doc, onSnapshot, updateDoc, collection, addDoc, deleteDoc, query, orderBy, getDoc, increment 
} from 'firebase/firestore';
import { 
  ChevronLeft, FileText, Truck, Receipt, Plus, Trash2, Clock, CheckCircle2,
  ChevronDown, ChevronUp, Calendar, Package, History, FileSpreadsheet, Download, User, Building2, Loader2, X, CheckCircle, XCircle, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '../contexts/ToastContext';

export default function PODetails() {
  const { id } = useParams();
  const { user, role, tenantId } = useAuth();
  const { success, error: toastError } = useToast();
  const [po, setPo] = useState<any>(null);
  const [supplier, setSupplier] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [pdfPreview, setPdfPreview] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [deliveryNumberInput, setDeliveryNumberInput] = useState('');
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [invoiceNumberInput, setInvoiceNumberInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const navigate = useNavigate();

  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editedItems, setEditedItems] = useState<any[]>([]);

  useEffect(() => {
    if (po && isEditingItems) {
      setEditedItems(po.items || []);
    }
  }, [po, isEditingItems]);

  const saveEditedItems = async () => {
    if (!id || !po) return;
    try {
      const totalHT = editedItems.reduce((acc, curr) => acc + (curr.quantity * curr.price), 0);
      const tvaAmount = totalHT * (po.tvaRate / 100);
      const totalAmount = totalHT + tvaAmount;

      await updateDoc(doc(db, 'purchase_orders', id), {
        items: editedItems,
        totalHT,
        tvaAmount,
        totalAmount,
        updatedAt: new Date().toISOString()
      });
      setIsEditingItems(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `purchase_orders/${id}`);
    }
  };

  useEffect(() => {
    if (!id) return;
    const poRef = doc(db, 'purchase_orders', id);
    const poUnsub = onSnapshot(poRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPo({ id: snap.id, ...data });
        
        if (data.tenantId) {
          getDoc(doc(db, 'tenant_settings', data.tenantId)).then(tsSnap => {
            if (tsSnap.exists()) setCompanySettings(tsSnap.data());
          });
        }

        // Fetch supplier details if po has supplierId or we search by name
        if (data.supplierId) {
          getDoc(doc(db, 'suppliers', data.supplierId)).then(sSnap => {
            if (sSnap.exists()) setSupplier({ id: sSnap.id, ...sSnap.data() });
          });
        }
      } else {
        navigate('/');
      }
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.GET, `purchase_orders/${id}`));

    const delUnsub = onSnapshot(
      query(collection(db, 'purchase_orders', id, 'deliveries'), orderBy('createdAt', 'desc')),
      (snap) => setDeliveries(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => handleFirestoreError(err, OperationType.GET, `purchase_orders/${id}/deliveries`)
    );

    const histUnsub = onSnapshot(
      query(collection(db, 'purchase_orders', id, 'status_history'), orderBy('createdAt', 'desc')),
      (snap) => setStatusHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => handleFirestoreError(err, OperationType.GET, `purchase_orders/${id}/status_history`)
    );

    const invUnsub = onSnapshot(
      query(collection(db, 'purchase_orders', id, 'invoices'), orderBy('createdAt', 'desc')),
      (snap) => setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => handleFirestoreError(err, OperationType.GET, `purchase_orders/${id}/invoices`)
    );

    return () => { poUnsub(); delUnsub(); histUnsub(); invUnsub(); };
  }, [id, navigate]);

  const updateStatus = async (s: string) => {
    if (!id || !user) return;
    try {
      await updateDoc(doc(db, 'purchase_orders', id), { 
        status: s, 
        updatedAt: new Date().toISOString() 
      });
      
      await addDoc(collection(db, 'purchase_orders', id, 'status_history'), {
        status: s,
        userName: user.displayName || user.email || 'Système',
        tenantId: tenantId,
        createdAt: new Date().toISOString()
      });
    } catch (err) { handleFirestoreError(err, OperationType.UPDATE, `purchase_orders/${id}`); }
  };

  const handleDeletePO = async () => {
    if (!id) return;
    if (['sent', 'confirmed', 'delivered', 'closed'].includes(po?.status)) {
      toastError("Action impossible : le bon de commande a déjà été engagé avec le fournisseur.");
      setIsDeleteDialogOpen(false);
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'purchase_orders', id));
      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `purchase_orders/${id}`);
    }
  };

  const openDeliveryModal = () => {
    if (!id || !po) return;
    
    // Calculate total delivered per item
    const deliveredMap: Record<string, number> = {};
    deliveries.forEach(del => {
      (del.items || []).forEach((item: any) => {
        deliveredMap[item.sku] = (deliveredMap[item.sku] || 0) + (item.quantity_delivered || 0);
      });
    });

    // Check if everything is already delivered
    const isFullyDelivered = po.items.every((item: any) => (deliveredMap[item.sku] || 0) >= item.quantity);
    if (isFullyDelivered) {
      toastError("Erreur : Tous les articles de ce BC ont déjà été livrés.");
      return;
    }

    const defaultBL = po.poNumber ? po.poNumber.replace(/^BC-/i, 'BL-').replace(/^PO/i, 'BL') : '';
    setDeliveryNumberInput(defaultBL);
    setDeliveryModal(true);
  };

  const submitDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !po || !deliveryNumberInput.trim()) return;

    // Calculate total delivered per item
    const deliveredMap: Record<string, number> = {};
    deliveries.forEach(del => {
      (del.items || []).forEach((item: any) => {
        deliveredMap[item.sku] = (deliveredMap[item.sku] || 0) + (item.quantity_delivered || 0);
      });
    });

    try {
      const newDelivery = {
        dnNumber: deliveryNumberInput.trim(), 
        date: new Date().toISOString().split('T')[0],
        receivedBy: user?.displayName || 'Inconnu',
        createdAt: new Date().toISOString(),
        items: po.items.map((item: any) => {
          const alreadyDelivered = deliveredMap[item.sku] || 0;
          const remaining = Math.max(0, item.quantity - alreadyDelivered);
          return {
            ...item,
            quantity_delivered: remaining // Assume full delivery of remaining for now, but field is present for future validation
          };
        })
      };

      await addDoc(collection(db, 'purchase_orders', id, 'deliveries'), newDelivery);
      setDeliveryModal(false);
      
      exportDeliveryPDF(newDelivery);

      if (po.status === 'sent' || po.status === 'confirmed') {
        updateStatus('delivered');
      }

      // Automatically increment stock quantities for delivered items
      for (const item of po.items) {
        const alreadyDelivered = deliveredMap[item.sku] || 0;
        const remaining = Math.max(0, item.quantity - alreadyDelivered);
        if (remaining > 0 && item.id) {
          try {
            await updateDoc(doc(db, 'products', item.id), {
              stockQuantity: increment(remaining),
              lastStockUpdate: new Date().toISOString()
            });
          } catch (stockErr) {
            console.error("Error updating stock for item:", item.sku, stockErr);
          }
        }
      }

    } catch (err) { console.error(err); }
  };

  const openInvoiceModal = () => {
    if (!id || !po) return;
    const defaultFF = po.poNumber ? po.poNumber.replace(/^BC-/i, 'FF-').replace(/^PO/i, 'FF') : '';
    setInvoiceNumberInput(defaultFF);
    setInvoiceModal(true);
  };

  const submitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !po || !invoiceNumberInput.trim()) return;
    
    try {
      const newInvoice = {
        invNumber: invoiceNumberInput.trim(),
        date: new Date().toISOString().split('T')[0],
        recordedBy: user?.displayName || 'Inconnu',
        createdAt: new Date().toISOString(),
        totalAmount: po.totalAmount,
        status: 'recorded'
      };

      await addDoc(collection(db, 'purchase_orders', id, 'invoices'), newInvoice);
      setInvoiceModal(false);
      
      exportInvoicePDF(newInvoice);
      if (po.status === 'delivered') updateStatus('closed');
    } catch (err) { console.error(err); }
  };

  const printCompanyHeader = (doc: any, title: string, contextObj?: any) => {
      doc.setFontSize(22);
      doc.setTextColor(19, 106, 168);
      doc.text(title, 105, 25, { align: 'center' });
      
      if (companySettings) {
        if (companySettings.logoUrl && companySettings.logoUrl.startsWith('data:image')) {
          try {
            let targetWidth = 40;
            let targetHeight = 15;
            const imgProps = doc.getImageProperties(companySettings.logoUrl);
            const maxHeight = 20;
            const maxWidth = 50;
            const ratio = imgProps.width / imgProps.height;
            targetHeight = maxHeight;
            targetWidth = maxHeight * ratio;
            
            if (targetWidth > maxWidth) {
              targetWidth = maxWidth;
              targetHeight = maxWidth / ratio;
            }
            doc.addImage(companySettings.logoUrl, companySettings.logoUrl.includes('image/png') ? 'PNG' : 'JPEG', 14, 10, targetWidth, targetHeight);
          } catch(e) { console.error("Error adding logo", e); }
        }
      }
  };

  const printAddressesBoxes = (doc: any, yPos: number, contextObj: any) => {
      const unitData = contextObj?.unit;
      
      // Factory (Left)
      doc.setFontSize(11);
      doc.setTextColor(19, 106, 168);
      doc.text("Acheteur / Unité :", 14, yPos);
      
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      let leftY = yPos + 6;
      doc.text(`${unitData?.name || companySettings?.companyName || 'Usine'}`, 14, leftY); leftY += 5;
      if (unitData?.name && companySettings?.companyName) {
         doc.text(`Groupe: ${companySettings.companyName}`, 14, leftY); leftY += 5;
      }
      const fAddr = unitData?.address || companySettings?.address;
      if (fAddr) { doc.text(`Adresse: ${fAddr}`, 14, leftY); leftY += 5; }
      const fNif = unitData?.nif || companySettings?.nif;
      if (fNif) { doc.text(`NIF: ${fNif}`, 14, leftY); leftY += 5; }
      const fRc = unitData?.rc || companySettings?.rc;
      if (fRc) { doc.text(`RC: ${fRc}`, 14, leftY); leftY += 5; }
      const fAi = unitData?.ai || companySettings?.ai;
      if (fAi) { doc.text(`AI: ${fAi}`, 14, leftY); leftY += 5; }
      
      // Supplier (Right)
      doc.setFontSize(11);
      doc.setTextColor(19, 106, 168);
      doc.text("Destinataire (Fournisseur) :", 110, yPos);
      
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      let rightY = yPos + 6;
      doc.text(`${supplier?.name || po.supplierName || ''}`, 110, rightY); rightY += 5;
      if (supplier?.address) { doc.text(`Adresse: ${supplier.address}`, 110, rightY); rightY += 5; }
      if (supplier?.nif) { doc.text(`NIF: ${supplier.nif}`, 110, rightY); rightY += 5; }
      if (supplier?.nis) { doc.text(`NIS: ${supplier.nis}`, 110, rightY); rightY += 5; }
      if (supplier?.rc) { doc.text(`RC: ${supplier.rc}`, 110, rightY); rightY += 5; }
      if (supplier?.ai) { doc.text(`AI: ${supplier.ai}`, 110, rightY); rightY += 5; }

      return Math.max(leftY, rightY) + 10;
  };

  const exportPDF = () => {
    try {
      const doc = new jsPDF();
      printCompanyHeader(doc, "BON DE COMMANDE", po);
      
      let nextY = printAddressesBoxes(doc, 45, po);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      let detailsY = nextY;
      doc.text(`BC N° : ${po.poNumber}`, 14, detailsY); detailsY += 5;
      doc.text(`Date : ${po.date}`, 14, detailsY); detailsY += 5;
      doc.text(`Acheteur : ${po.buyerName}`, 14, detailsY); detailsY += 5;
      doc.text(`Paiement : ${po.paymentModality || 'Non spécifié'}`, 14, detailsY); detailsY += 5;
      
      const tableData = po.items.map((item: any) => [
        item.sku, item.name, `${item.quantity} ${item.unit || 'pcs'}`, item.price?.toLocaleString(), (item.quantity * item.price)?.toLocaleString()
      ]);

      const tableStartY = detailsY + 5;

      autoTable(doc, {
        head: [['SKU', 'Produit', 'Qté', 'Prix Unit. (DZD)', 'Total']],
        body: tableData,
        startY: tableStartY,
        theme: 'grid',
        headStyles: { fillColor: [19, 106, 168], fontStyle: 'bold' },
        styles: { fontSize: 9 }
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 150;
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      if (po.tvaRate !== undefined) {
        doc.text(`Total HT : ${po.totalHT?.toLocaleString()} DZD`, 196, finalY + 10, { align: 'right' });
        doc.text(`TVA (${po.tvaRate}%) : ${po.tvaAmount?.toLocaleString()} DZD`, 196, finalY + 15, { align: 'right' });
      }
      doc.setFontSize(14);
      doc.setTextColor(19, 106, 168);
      doc.text(`Montant Total TTC : ${po.totalAmount?.toLocaleString()} DZD`, 196, finalY + (po.tvaRate !== undefined ? 25 : 15), { align: 'right' });
      
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("Généré via Dashboard - Système de Gestion d'Entrepôt et des Achats", 14, 280);
      doc.setTextColor(59, 130, 246);
      doc.textWithLink("App Developed by Benouasser Aymen Chamssedine (LinkedIn)", 14, 285, { url: 'https://www.linkedin.com/in/benouasser-aymen-chamssedine-93a806197?utm_source=share_via&utm_content=profile&utm_medium=member_android' });
      
      doc.save(`${po.poNumber}.pdf`);
      setPdfPreview(doc.output('datauristring'));
    } catch (error) {
      console.error("Error generating BC PDF:", error);
      alert("Erreur lors de la génération du PDF: " + error);
    }
  };

  const exportDeliveryPDF = (del: any) => {
    try {
      const doc = new jsPDF();
      printCompanyHeader(doc, "BON DE LIVRAISON", po);

      let nextY = printAddressesBoxes(doc, 45, po);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      let detailsY = nextY;
      doc.text(`BL N° : ${del.dnNumber}`, 14, detailsY); detailsY += 5;
      doc.text(`BC Associé : ${po.poNumber}`, 14, detailsY); detailsY += 5;
      doc.text(`Date Réception : ${del.date}`, 14, detailsY); detailsY += 5;
      doc.text(`Réceptionné par : ${del.receivedBy}`, 14, detailsY); detailsY += 5;
      
      const tableData = (del.items || []).map((item: any) => [
        item.sku, item.name, item.quantity_delivered || item.quantity, item.unit || 'pcs'
      ]);

      const tableStartY = detailsY + 5;

      autoTable(doc, {
        head: [['SKU', 'Produit', 'Qté Livrée', 'Unité']],
        body: tableData,
        startY: tableStartY,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
        styles: { fontSize: 9 }
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 150;
      doc.setFontSize(10);
      doc.setTextColor(19, 106, 168);
      doc.text("Visa Réception :", 14, finalY + 15);
      doc.text("___________________", 14, finalY + 25);
      
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("Généré via Dashboard", 14, 280);
      doc.setTextColor(59, 130, 246);
      doc.textWithLink("App Developed by Benouasser Aymen Chamssedine (LinkedIn)", 14, 285, { url: 'https://www.linkedin.com/in/benouasser-aymen-chamssedine-93a806197?utm_source=share_via&utm_content=profile&utm_medium=member_android' });
      
      doc.save(`BL_${del.dnNumber}.pdf`);
      setPdfPreview(doc.output('datauristring'));
    } catch (error) {
      console.error("Error generating Delivery PDF:", error);
      alert("Erreur lors de la génération du PDF: " + error);
    }
  };

  const exportInvoicePDF = (inv: any) => {
    try {
      const doc = new jsPDF();
      printCompanyHeader(doc, "FACTURE", po);

      let nextY = printAddressesBoxes(doc, 45, po);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      let detailsY = nextY;
      doc.text(`Facture N° : ${inv.invNumber}`, 14, detailsY); detailsY += 5;
      doc.text(`BC Associé : ${po.poNumber}`, 14, detailsY); detailsY += 5;
      doc.text(`Date : ${inv.date}`, 14, detailsY); detailsY += 5;
      if (supplier?.bankInfo) { doc.text(`Banque Fournisseur: ${supplier.bankInfo}`, 14, detailsY); detailsY += 5; }
      
      const tableData = po.items.map((item: any) => [
        item.sku, item.name, `${item.quantity} ${item.unit || 'pcs'}`, item.price?.toLocaleString(), (item.quantity * item.price)?.toLocaleString()
      ]);

      const tableStartY = detailsY + 5;

      autoTable(doc, {
        head: [['SKU', 'Produit', 'Qté', 'Prix Unit. (DZD)', 'Total']],
        body: tableData,
        startY: tableStartY,
        theme: 'grid',
        headStyles: { fillColor: [19, 106, 168], fontStyle: 'bold' },
        styles: { fontSize: 9 }
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 150;
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      if (po.tvaRate !== undefined) {
        doc.text(`Total HT : ${po.totalHT?.toLocaleString()} DZD`, 196, finalY + 10, { align: 'right' });
        doc.text(`TVA (${po.tvaRate}%) : ${po.tvaAmount?.toLocaleString()} DZD`, 196, finalY + 15, { align: 'right' });
      }
      doc.setFontSize(14);
      doc.setTextColor(19, 106, 168);
      doc.text(`Montant Total TTC : ${inv.totalAmount?.toLocaleString()} DZD`, 196, finalY + (po.tvaRate !== undefined ? 25 : 15), { align: 'right' });
      
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("Généré via Dashboard", 14, 280);
      doc.setTextColor(59, 130, 246);
      doc.textWithLink("App Developed by Benouasser Aymen Chamssedine (LinkedIn)", 14, 285, { url: 'https://www.linkedin.com/in/benouasser-aymen-chamssedine-93a806197?utm_source=share_via&utm_content=profile&utm_medium=member_android' });
      
      doc.save(`Facture_${inv.invNumber}.pdf`);
      setPdfPreview(doc.output('datauristring'));
    } catch (error) {
      console.error("Error generating Invoice PDF:", error);
      alert("Erreur lors de la génération du PDF: " + error);
    }
  };

  const generateMilestones = () => {
    if (!po) return [];
    
    let milestones: any[] = [];
    
    milestones.push({
      id: 'created',
      type: 'creation',
      label: 'BC Créé',
      userName: po.buyerName || 'Système',
      createdAt: po.createdAt,
      details: `Création du Bon de Commande N° ${po.poNumber}`,
      color: 'blue'
    });
    
    statusHistory.forEach(sh => {
      let label = 'Statut Modifié';
      if (sh.status === 'sent') label = 'BC Envoyé au Fournisseur';
      if (sh.status === 'confirmed') label = 'BC Confirmé';
      if (sh.status === 'partially_delivered') label = 'Livraison Partielle';
      if (sh.status === 'delivered') label = 'Livraison Complète';
      if (sh.status === 'closed') label = 'BC Clôturé / Facturé';
      if (sh.status === 'cancelled') label = 'BC Annulé';
      
      milestones.push({
        id: sh.id,
        type: 'status',
        label: label,
        userName: sh.userName,
        createdAt: sh.createdAt,
        details: `Passage au statut : ${sh.status}`,
        color: sh.status === 'closed' ? 'slate' : sh.status === 'delivered' ? 'emerald' : 'blue'
      });
    });
    
    deliveries.forEach(del => {
      milestones.push({
        id: del.id,
        type: 'delivery',
        label: `Livraison (BL: ${del.dnNumber})`,
        userName: del.receivedBy,
        createdAt: del.createdAt,
        details: `Réception enregistrée le ${del.date || 'Inconnue'}`,
        color: 'indigo'
      });
    });
    
    invoices.forEach(inv => {
      milestones.push({
        id: inv.id,
        type: 'invoice',
        label: `Facture (N°: ${inv.invNumber})`,
        userName: inv.recordedBy,
        createdAt: inv.createdAt,
        details: `Montant: ${inv.totalAmount?.toLocaleString()} DZD`,
        color: 'slate'
      });
    });
    
    return milestones.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const milestones = generateMilestones();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="w-10 h-10 animate-spin text-[#136AA8]" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-10 space-y-10">
      <nav className="flex items-center justify-between">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-400 hover:text-[#136AA8] transition-all font-bold uppercase text-xs tracking-widest">
          <ChevronLeft size={18} /> Retour au Tableau de bord
        </button>
        <div className="flex items-center gap-3">
          {(!['sent', 'confirmed', 'delivered', 'closed'].includes(po.status)) && (
            <button 
              onClick={() => setIsDeleteDialogOpen(true)} 
              className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase rounded-lg border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all shadow-sm"
            >
              <Trash2 size={14} /> Supprimer
            </button>
          )}
          <div className="h-4 w-px bg-gray-200"></div>
          <div className="flex gap-2 flex-wrap justify-end">
            {['draft', 'pending_approval', 'approved', 'sent', 'confirmed', 'delivered', 'closed'].map(s => (
            <button 
              key={s} 
              onClick={() => updateStatus(s)} 
              className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg border transition-all ${po.status === s ? 'bg-[#136AA8] text-white border-[#136AA8] shadow-md' : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'}`}
            >
              {s === 'draft' ? 'Brouillon' : s === 'pending_approval' ? 'En Attente' : s === 'approved' ? 'Approuvé' : s === 'sent' ? 'Envoyé' : s === 'confirmed' ? 'Confirmé' : s === 'delivered' ? 'Livré' : 'Clôturé'}
            </button>
          ))}
          </div>
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <section className="bg-white rounded-[2rem] p-10 border border-gray-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8">
              <span className="text-[10px] font-black bg-blue-50 text-[#009CDA] px-3 py-1 rounded-lg border border-blue-100 uppercase tracking-widest">{po.poNumber}</span>
            </div>
            <div className="flex items-center gap-6 mb-10">
              <div className="w-20 h-20 bg-blue-50 text-[#136AA8] rounded-3xl flex items-center justify-center border border-blue-100"><Building2 size={40} /></div>
              <div>
                <h1 className="text-2xl font-black text-[#136AA8] uppercase leading-none mb-2">{po.supplierName}</h1>
                <div className="flex items-center gap-4 text-[11px] font-bold text-gray-400 uppercase tracking-tighter">
                  <span className="flex items-center gap-1.5"><Calendar size={14} /> {po.date}</span>
                  <span className="flex items-center gap-1.5"><User size={14} /> {po.buyerName}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4 mt-8 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                <Package size={18} className="text-[#136AA8]"/> Articles Commandés
              </h3>
              {!['sent', 'confirmed', 'delivered', 'closed'].includes(po.status) && (
                <button 
                  onClick={() => isEditingItems ? saveEditedItems() : setIsEditingItems(true)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors ${
                    isEditingItems 
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-200' 
                      : 'bg-white text-[#136AA8] border border-blue-200 hover:bg-blue-50'
                  }`}
                >
                  {isEditingItems ? 'Enregistrer les modifications' : 'Modifier les quantités / prix'}
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase font-black text-gray-300 border-b border-gray-50 tracking-widest">
                    <th className="pb-4">Article / Description</th>
                    <th className="pb-4 text-center">Qté</th>
                    <th className="pb-4 text-right">Prix Unitaire</th>
                    <th className="pb-4 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(isEditingItems ? editedItems : po.items).map((item: any, i: number) => (
                    <tr key={i} className="text-sm font-bold text-gray-700">
                      <td className="py-5">
                        <p className="text-[#136AA8] font-bold">{item.name}</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-tighter font-mono">{item.sku}</p>
                      </td>
                      <td className="py-5 text-center font-mono">
                        {isEditingItems ? (
                           <input type="number" value={item.quantity} onChange={e => {
                               const arr = [...editedItems];
                               arr[i].quantity = Number(e.target.value);
                               setEditedItems(arr);
                           }} className="w-16 p-1 bg-slate-50 border border-slate-200 rounded text-center" />
                        ) : (
                           <>{item.quantity} <span className="text-[10px] text-gray-400 font-sans">{item.unit || 'pcs'}</span></>
                        )}
                      </td>
                      <td className="py-5 text-right font-mono">
                         {isEditingItems ? (
                           <input type="number" step="any" value={item.price} onChange={e => {
                               const arr = [...editedItems];
                               arr[i].price = Number(e.target.value);
                               setEditedItems(arr);
                           }} className="w-24 p-1 bg-slate-50 border border-slate-200 rounded text-right" />
                         ) : (
                           <>{item.price?.toLocaleString()}</>
                         )}
                      </td>
                      <td className="py-5 text-right font-mono">{(item.quantity * item.price)?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {po.tvaRate !== undefined && (
                    <>
                      <tr className="text-sm font-bold text-gray-500">
                        <td colSpan={3} className="pt-6 text-right">Total HT</td>
                        <td className="pt-6 text-right font-mono">{po.totalHT?.toLocaleString()}</td>
                      </tr>
                      <tr className="text-sm font-bold text-gray-500 border-b border-gray-100">
                        <td colSpan={3} className="pb-4 text-right">TVA ({po.tvaRate}%)</td>
                        <td className="pb-4 text-right font-mono">{po.tvaAmount?.toLocaleString()}</td>
                      </tr>
                    </>
                  )}
                  <tr className="text-xl font-black text-[#136AA8]">
                    <td colSpan={3} className="pt-4 text-right">Total de la Commande {po.tvaRate !== undefined ? '(TTC)' : ''}</td>
                    <td className="pt-4 text-right font-mono decoration-[#009CDA]/30 decoration-4 underline-offset-8 underline">{po.totalAmount?.toLocaleString()} <span className="text-xs font-sans text-gray-400">DZD</span></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            <div className="mt-12 pt-10 border-t flex flex-wrap gap-4">
              <button onClick={exportPDF} className="py-4 px-6 flex-1 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 hover:bg-black transition-all">
                <FileText size={18} /> Imprimer / PDF
              </button>
              
              {po.status === 'draft' && (
                <button onClick={() => updateStatus('pending_approval')} className="py-4 px-6 flex-1 bg-amber-500 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 hover:bg-amber-600 transition-all shadow-lg shadow-amber-100">
                  <CheckCircle size={18} /> Demander Approbation
                </button>
              )}

              {po.status === 'pending_approval' && ['admin', 'superadmin'].includes(role || '') && (
                <>
                  <button onClick={() => updateStatus('approved')} className="py-4 px-6 flex-1 bg-green-500 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 hover:bg-green-600 transition-all shadow-lg shadow-green-100">
                    <CheckCircle size={18} /> Approuver
                  </button>
                  <button onClick={() => updateStatus('draft')} className="py-4 px-6 flex-1 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 hover:bg-red-600 transition-all shadow-lg shadow-red-100">
                    <XCircle size={18} /> Rejeter
                  </button>
                </>
              )}

              {po.status === 'approved' && (
                <button onClick={() => updateStatus('sent')} className="py-4 px-6 flex-1 bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 hover:bg-[#009CDA] transition-all shadow-lg shadow-blue-100">
                  <Send size={18} /> Envoyer au Fournisseur
                </button>
              )}
              
              {(po.status === 'sent' || po.status === 'approved' || po.status === 'delivered') && (
                <button onClick={openDeliveryModal} className="py-4 px-6 flex-1 bg-[#3B82F6] text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 hover:bg-[#009CDA] transition-all shadow-lg shadow-blue-100">
                  <Truck size={18} /> Enregistrer BL
                </button>
              )}
              
              {(po.status === 'delivered' || po.status === 'sent') && (
                <button onClick={openInvoiceModal} className="py-4 px-6 flex-1 bg-[#136AA8] text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 hover:bg-slate-900 transition-all shadow-lg shadow-slate-100">
                  <Receipt size={18} /> Enregistrer Facture
                </button>
              )}
            </div>
          </section>

          {supplier && (
            <section className="bg-white rounded-[2rem] p-10 border border-gray-100 shadow-sm">
              <h2 className="text-lg font-black uppercase text-[#136AA8] tracking-tight flex items-center gap-3 mb-8">
                <Building2 size={22} className="text-[#009CDA]" /> Détails du Fournisseur
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-1">Désignation</label>
                    <p className="text-sm font-bold text-[#136AA8] uppercase">{supplier.name}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-1">Adresse</label>
                    <p className="text-sm font-bold text-gray-600">{supplier.address || 'Non spécifiée'}</p>
                  </div>
                  <div className="flex gap-10">
                    <div>
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-1">NIF</label>
                      <p className="text-xs font-mono font-bold text-gray-700">{supplier.nif || '—'}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-1">RC</label>
                      <p className="text-xs font-mono font-bold text-gray-700">{supplier.rc || '—'}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-1">Contact Téléphonique</label>
                    <p className="text-sm font-bold text-[#136AA8]">{supplier.phone || 'Non spécifié'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-1">Email</label>
                    <p className="text-sm font-bold text-[#009CDA]">{supplier.email || 'Non spécifié'}</p>
                  </div>
                  <div className="pt-4">
                    <span className="text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 px-2 py-1 rounded border border-emerald-100">Partenaire Approuvé</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="space-y-6">
            <h2 className="text-lg font-black uppercase text-[#136AA8] tracking-tight flex items-center gap-3">
              <History size={22} className="text-[#009CDA]" /> Logistique & Réceptions (BL)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {deliveries.length === 0 ? (
                <div className="col-span-full bg-gray-50/50 p-10 rounded-[2rem] text-center border-2 border-dashed border-gray-100 italic text-gray-300 font-medium">Aucun bon de livraison enregistré</div>
              ) : deliveries.map(d => (
                <div key={d.id} className="bg-white p-6 rounded-[14px] border border-gray-200 shadow-sm hover:shadow-md transition-all group">
                   <div className="flex justify-between items-start mb-5">
                     <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#009CDA] flex items-center justify-center border border-blue-100"><Truck size={24} /></div>
                     <div className="flex gap-2">
                       <button onClick={() => exportDeliveryPDF(d)} className="text-gray-400 hover:text-[#009CDA] transition-all p-1.5 hover:bg-blue-50 rounded-lg" title="Exporter PDF"><Download size={16} /></button>
                       <button onClick={() => deleteDoc(doc(db, 'purchase_orders', id!, 'deliveries', d.id))} className="text-gray-200 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                     </div>
                   </div>
                   <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1.5">Réception BL</p>
                   <h3 className="text-lg font-bold text-[#136AA8] mb-4">{d.dnNumber}</h3>
                   <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-tighter">
                     <span className="flex items-center gap-2"><Calendar size={14} /> {d.date || '—'}</span>
                     <span className="flex items-center gap-2"><User size={14} /> {d.receivedBy || '—'}</span>
                   </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-lg font-black uppercase text-[#136AA8] tracking-tight flex items-center gap-3">
              <Receipt size={22} className="text-[#009CDA]" /> Facturation Finale
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {invoices.length === 0 ? (
                <div className="col-span-full bg-gray-50/50 p-10 rounded-[2rem] text-center border border-dashed border-gray-200 italic text-gray-300 font-medium">Aucune facture enregistrée</div>
              ) : invoices.map(inv => (
                <div key={inv.id} className="bg-white p-6 rounded-[14px] border border-gray-200 shadow-sm hover:shadow-md transition-all group">
                   <div className="flex justify-between items-start mb-5">
                     <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-100"><Receipt size={24} /></div>
                     <div className="flex gap-2">
                       <button onClick={() => exportInvoicePDF(inv)} className="text-gray-400 hover:text-[#009CDA] transition-all p-1.5 hover:bg-blue-50 rounded-lg" title="Exporter PDF"><Download size={16} /></button>
                       <button onClick={() => deleteDoc(doc(db, 'purchase_orders', id!, 'invoices', inv.id))} className="text-gray-200 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                     </div>
                   </div>
                   <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1.5">Facture Finale</p>
                   <h3 className="text-lg font-bold text-[#136AA8] mb-4">{inv.invNumber}</h3>
                   <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-tighter">
                     <span className="flex items-center gap-2"><Calendar size={14} /> {inv.date}</span>
                     <span className="flex items-center gap-2"><FileText size={14} /> {inv.totalAmount?.toLocaleString()} DZD</span>
                   </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm">
             <div className="flex items-center justify-between mb-6">
               <h3 className="text-lg font-black uppercase text-[#136AA8] flex items-center gap-2">
                 <Clock size={20} className="text-[#009CDA]" /> Tracking (Milestones)
               </h3>
             </div>

             <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-gray-100">
               {milestones.map((m, i) => (
                 <div key={`${m.id}-${i}`} className="relative pl-8">
                    <div className={`absolute left-[3px] top-1.5 w-2 h-2 rounded-full border-2 border-white ring-4 ring-white ${m.color === 'emerald' ? 'bg-emerald-500' : m.color === 'blue' ? 'bg-[#009CDA]' : m.color === 'indigo' ? 'bg-indigo-500' : 'bg-slate-800'}`} style={{ transform: 'translateX(-2.5px)' }} />
                    <p className="text-[10px] font-black uppercase text-gray-400 mb-1 leading-none">
                      {new Date(m.createdAt).toLocaleString()}
                    </p>
                    <p className={`text-sm font-bold ${i === 0 ? 'text-[#136AA8]' : 'text-gray-900'}`}>{m.label}</p>
                    <p className="text-xs font-medium text-gray-500 mt-0.5">{m.details}</p>
                    <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest"><span className="opacity-50">Par</span> {m.userName}</p>
                 </div>
               ))}
             </div>
           </section>

           <section className="p-8 bg-[#136AA8] rounded-[2rem] text-white overflow-hidden relative">
             <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full" />
             <div className="relative">
               <h3 className="text-lg font-black uppercase mb-4 tracking-tight flex items-center gap-2 text-emerald-400"><CheckCircle2 size={20} /> Conformité</h3>
               <p className="text-xs font-medium text-white/60 leading-relaxed italic">Cette commande est soumise aux réglementations d'achat standard. Les Bons de Livraison doivent être archivés pour le rapprochement financier.</p>
               <button className="mt-8 w-full py-4 border border-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-[#136AA8] transition-all">Guide d'Archivage</button>
             </div>
           </section>
        </div>
      </div>

      <AnimatePresence>
        {pdfPreview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-4xl h-[90vh] flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-black text-[#136AA8]">Aperçu du Document PDF</h3>
                <div className="flex items-center gap-3">
                  <a href={pdfPreview} download="Document.pdf" className="px-4 py-2 bg-[#009CDA] text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-sm">Télécharger</a>
                  <button onClick={() => setPdfPreview(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                    <X size={24} />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                <iframe src={pdfPreview} className="w-full h-full" title="PDF Preview" />
              </div>
              <div className="mt-4 flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
                 <p className="text-xs font-bold text-blue-700">Le téléchargement automatique a peut-être été bloqué par votre navigateur.</p>
                 <p className="text-xs font-medium text-[#009CDA]">Vous pouvez imprimer ou télécharger le document directement depuis cet aperçu.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isDeleteDialogOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-black text-[#136AA8] mb-2">Supprimer la commande ?</h3>
                <p className="text-sm text-gray-500 font-medium">
                  Êtes-vous sûr de vouloir supprimer le bon de commande <strong className="text-gray-900">{po.poNumber}</strong> ? Cette action est irréversible et supprimera également toutes les livraisons et factures associées.
                </p>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setIsDeleteDialogOpen(false)}
                  className="flex-1 px-4 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all text-center"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleDeletePO}
                  className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 transition-all text-center"
                >
                  Confirmer la suppression
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deliveryModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md">
              <h3 className="text-xl font-black text-[#136AA8] mb-4 flex items-center gap-2"><Truck className="text-[#009CDA]" /> Enregistrer BL</h3>
              <form onSubmit={submitDelivery}>
                <div className="mb-6">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Numéro du Bon de Livraison</label>
                  <input 
                    type="text" 
                    required 
                    autoFocus
                    value={deliveryNumberInput} 
                    onChange={e => setDeliveryNumberInput(e.target.value)} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#009CDA] focus:border-transparent transition-all outline-none" 
                    placeholder="Ex: BL-2023-001" 
                  />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setDeliveryModal(false)} className="flex-1 px-4 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all text-center">Annuler</button>
                  <button type="submit" className="flex-1 px-4 py-3 bg-[#009CDA] text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all text-center flex justify-center items-center gap-2">Confirmer <CheckCircle2 size={18} /></button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {invoiceModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md">
              <h3 className="text-xl font-black text-[#136AA8] mb-4 flex items-center gap-2"><Receipt className="text-[#009CDA]" /> Enregistrer Facture</h3>
              <form onSubmit={submitInvoice}>
                <div className="mb-6">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Numéro de la Facture Finale</label>
                  <input 
                    type="text" 
                    required 
                    autoFocus
                    value={invoiceNumberInput} 
                    onChange={e => setInvoiceNumberInput(e.target.value)} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#009CDA] focus:border-transparent transition-all outline-none" 
                    placeholder="Ex: FAC-2023-089" 
                  />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setInvoiceModal(false)} className="flex-1 px-4 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all text-center">Annuler</button>
                  <button type="submit" className="flex-1 px-4 py-3 bg-[#136AA8] text-white rounded-xl font-bold text-sm hover:bg-slate-900 transition-all text-center flex justify-center items-center gap-2">Confirmer <CheckCircle2 size={18} /></button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
