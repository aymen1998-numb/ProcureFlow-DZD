import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Archive as ArchiveIcon, Search, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Archive() {
  const { tenantId } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!tenantId) return;

    let unsubDa: any;
    let unsubPo: any;
    let unsubIntl: any;

    const fallback = () => {
      if (unsubDa) unsubDa();
      if (unsubPo) unsubPo();
      if (unsubIntl) unsubIntl();

      const fallbackDa = query(collection(db, 'purchase_requests'), where('tenantId', '==', tenantId));
      unsubDa = onSnapshot(fallbackDa, snap => {
        const list = snap.docs.map(d => ({ id: d.id, type: 'DA', ...d.data() })).filter((d: any) => ['archived', 'cancelled', 'done'].includes(d.status));
        setItems(prev => [...prev.filter(p => p.type !== 'DA'), ...list].sort((a,b) => b.createdAt?.localeCompare(a.createdAt)));
      });

      const fallbackPo = query(collection(db, 'purchase_orders'), where('tenantId', '==', tenantId));
      unsubPo = onSnapshot(fallbackPo, snap => {
        const list = snap.docs.map(d => ({ id: d.id, type: 'PO', ...d.data() })).filter((d: any) => ['archived', 'cancelled', 'done'].includes(d.status));
        setItems(prev => [...prev.filter(p => p.type !== 'PO'), ...list].sort((a,b) => b.createdAt?.localeCompare(a.createdAt)));
      });
      
      const fallbackIntl = query(collection(db, 'intl_purchases'), where('tenantId', '==', tenantId));
      unsubIntl = onSnapshot(fallbackIntl, snap => {
        const list = snap.docs.map(d => ({ id: d.id, type: 'INTL', ...d.data() })).filter((d: any) => ['completed', 'archived'].includes(d.status));
        setItems(prev => [...prev.filter(p => p.type !== 'INTL'), ...list].sort((a,b) => b.createdAt?.localeCompare(a.createdAt)));
        setLoading(false);
      });
    };

    const qDa = query(collection(db, 'purchase_requests'), where('tenantId', '==', tenantId), where('status', 'in', ['archived', 'cancelled', 'done']));
    unsubDa = onSnapshot(qDa, (snap) => {
      const daList = snap.docs.map(d => ({ id: d.id, type: 'DA', ...d.data() }));
      setItems(prev => {
        const removedOthers = prev.filter(p => p.type !== 'DA');
        return [...removedOthers, ...daList].sort((a,b) => b.createdAt?.localeCompare(a.createdAt));
      });
    }, (error) => {
      console.error(error);
      fallback();
    });

    const qPo = query(collection(db, 'purchase_orders'), where('tenantId', '==', tenantId), where('status', 'in', ['archived', 'cancelled', 'done']));
    unsubPo = onSnapshot(qPo, (snap) => {
      const poList = snap.docs.map(d => ({ id: d.id, type: 'PO', ...d.data() }));
      setItems(prev => {
        const removedOthers = prev.filter(p => p.type !== 'PO');
        return [...removedOthers, ...poList].sort((a,b) => b.createdAt?.localeCompare(a.createdAt));
      });
    }, (error) => {
      console.error(error);
      fallback();
    });
    
    // Also query intl_purchases
    const qIntl = query(collection(db, 'intl_purchases'), where('tenantId', '==', tenantId), where('status', 'in', ['completed', 'archived']));
    unsubIntl = onSnapshot(qIntl, (snap) => {
      const intlList = snap.docs.map(d => ({ id: d.id, type: 'INTL', ...d.data() }));
      setItems(prev => {
        const removedOthers = prev.filter(p => p.type !== 'INTL');
        return [...removedOthers, ...intlList].sort((a,b) => b.createdAt?.localeCompare(a.createdAt));
      });
      setLoading(false); // set loading false here too just in case
    }, (error) => {
      console.error(error);
      fallback();
    });

    return () => {
      if (typeof unsubDa === 'function') unsubDa();
      if (typeof unsubPo === 'function') unsubPo();
      if (typeof unsubIntl === 'function') unsubIntl();
    };
  }, [tenantId]);

  const filteredItems = React.useMemo(() => {
    return items.filter(r => 
      r.daNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.poNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  const downloadArchive = (item: any) => {
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(22);
      doc.setTextColor(19, 106, 168);
      doc.text("ARCHIVE CONSOLIDÉE", 105, 25, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      let y = 45;
      
      doc.text(`Type de document : ${item.type === 'PO' ? 'Bon de Commande' : item.type === 'INTL' ? 'Achat International' : 'Demande d\'Achat'}`, 14, y); y += 8;
      doc.text(`Référence : ${item.poNumber || item.daNumber}`, 14, y); y += 8;
      doc.text(`Statut final : ${item.status}`, 14, y); y += 8;
      doc.text(`Créé le : ${new Date(item.createdAt).toLocaleDateString('fr-FR')}`, 14, y); y += 8;
      
      if (item.type === 'PO') {
        doc.text(`Fournisseur : ${item.supplierName}`, 14, y); y += 8;
        doc.text(`Acheteur : ${item.buyerName}`, 14, y); y += 8;
        doc.text(`Montant Total : ${item.totalAmount?.toLocaleString()} DZD`, 14, y); y += 8;
      } else if (item.type === 'INTL') {
        doc.text(`Fournisseur : ${item.supplierName}`, 14, y); y += 8;
        doc.text(`Incoterm : ${item.incoterm || 'N/A'}`, 14, y); y += 8;
        doc.text(`Mode de Transport : ${item.transportMethod || 'N/A'}`, 14, y); y += 8;
        doc.text(`Méthode de Paiement : ${item.paymentMethod || 'N/A'}`, 14, y); y += 8;
        doc.text(`Montant Total : ${item.totalAmount?.toLocaleString() || 0} ${item.currency || 'EUR'}`, 14, y); y += 8;
        doc.text(`Transitaire : ${item.transitaire || 'N/A'}`, 14, y); y += 8;
        doc.text(`N° Déclaration : ${item.numeroDeclaration || 'N/A'}`, 14, y); y += 8;
      } else {
        doc.text(`Créé par : ${item.createdBy}`, 14, y); y += 8;
      }
      
      if (item.items && item.items.length > 0) {
        y += 5;
        if (item.type === 'PO') {
          autoTable(doc, {
            startY: y,
            head: [['SKU', 'Produit', 'Qté']],
            body: item.items.map((i: any) => [i.sku || '-', i.name, `${i.quantity} ${i.unit || 'pcs'}`]),
            theme: 'grid',
            headStyles: { fillColor: [19, 106, 168] }
          });
        } else if (item.type === 'INTL') {
          autoTable(doc, {
            startY: y,
            head: [['Code/SKU', 'Produit', 'Qté']],
            body: item.items.map((i: any) => [i.sku || '-', i.name, `${i.quantity} ${i.unit || 'pcs'}`]),
            theme: 'grid',
            headStyles: { fillColor: [19, 106, 168] }
          });
        } else {
          autoTable(doc, {
            startY: y,
            head: [['Désignation', 'Stock', 'Conso/Mois', 'Qté Dem.']],
            body: item.items.map((i: any) => [i.name, i.qtyInStock || 0, i.monthlyConsumption || 0, `${i.quantity} ${i.unit || 'pcs'}`]),
            theme: 'grid',
            headStyles: { fillColor: [19, 106, 168] }
          });
        }
      }
      
      // Additional notes if it's cancelled
      if (item.status === 'cancelled') {
         const finalY = (doc as any).lastAutoTable?.finalY || y + 20;
         doc.text(`Annulé par : ${item.cancelledBy || 'Inconnu'}`, 14, finalY + 15);
         doc.text(`Date d'annulation : ${item.cancelledAt ? new Date(item.cancelledAt).toLocaleDateString('fr-FR') : 'Inconnue'}`, 14, finalY + 23);
      }
      
      doc.save(`Archive_${item.poNumber || item.daNumber}.pdf`);
    } catch(err) {
      console.error(err);
      alert("Erreur lors de la génération de l'archive.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#136AA8] tracking-tight uppercase flex items-center gap-3">
            <ArchiveIcon className="text-[#009CDA]" />
            Archives
          </h2>
          <p className="text-slate-500 font-medium mt-1">Historique des DA et BC finalisés, annulés ou archivés.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#009CDA] focus:border-transparent outline-none shadow-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-4 text-xs font-black uppercase tracking-widest text-[#136AA8]">Type</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-[#136AA8]">Référence</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-[#136AA8]">Date</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-[#136AA8]">Statut</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-[#136AA8] text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {filteredItems.map((item, idx) => (
                <tr key={`${item.id}-${idx}`} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${item.type === 'PO' ? 'bg-indigo-50 text-indigo-700' : item.type === 'INTL' ? 'bg-cyan-50 text-cyan-700' : 'bg-orange-50 text-orange-700'}`}>
                      {item.type === 'PO' ? 'Bon de Commande' : item.type === 'INTL' ? 'Achat International' : 'Demande d\'Achat'}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-slate-700">{item.poNumber || item.daNumber}</td>
                  <td className="p-4 text-slate-500">{new Date(item.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${item.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => downloadArchive(item)} className="p-2 text-slate-400 hover:text-[#009CDA] bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors inline-block" title="Télécharger l'historique de ce document">
                      <Download size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">Aucune archive trouvée.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
