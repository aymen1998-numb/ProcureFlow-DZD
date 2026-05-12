import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { ArrowLeft, Loader2, ArrowRightLeft, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function TransferDetails() {
  const { id } = useParams();
  const { tenantId } = useAuth();
  const navigate = useNavigate();
  const [transfer, setTransfer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState<any>(null);

  useEffect(() => {
    if (!id || !tenantId) return;
    
    // Fetch settings for PDF
    getDoc(doc(db, 'tenant_settings', tenantId)).then(snap => {
      if (snap.exists()) setCompanySettings(snap.data());
    });

    const unsub = onSnapshot(doc(db, 'transfers', id), (snap) => {
      if (snap.exists()) {
        setTransfer({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    });
    return () => unsub();
  }, [id, tenantId]);

  const exportPDF = () => {
    if (!transfer) return;
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(24);
      doc.setTextColor(19, 106, 168);
      doc.text("BON DE TRANSFERT", 14, 25);
      
      const sourceUnit = companySettings?.units?.find((u: any) => u.name === transfer.sourceLocation);

      if (companySettings) {
        let yPosBase = 25;
        if (companySettings.logoUrl && companySettings.logoUrl.startsWith('data:image')) {
          try {
              let targetWidth = 50;
              let targetHeight = 15;
              let logoX = 140;
              let logoY = 5;
              try {
                const imgProps = doc.getImageProperties(companySettings.logoUrl);
                const maxHeight = 24;
                const maxWidth = 55;
                const ratio = imgProps.width / imgProps.height;
                targetHeight = maxHeight;
                targetWidth = maxHeight * ratio;
                
                if (targetWidth > maxWidth) {
                  targetWidth = maxWidth;
                  targetHeight = maxWidth / ratio;
                }
                logoX = 196 - targetWidth;
                logoY = 8;
                yPosBase = logoY + targetHeight + 6;
              } catch(e) {}
              
            doc.addImage(companySettings.logoUrl, companySettings.logoUrl.includes('image/png') ? 'PNG' : 'JPEG', logoX, logoY, targetWidth, targetHeight);
          } catch(e) {}
        }
        
        doc.setFontSize(12);
        doc.setTextColor(19, 106, 168);
        
        const companyLines = [];
        companyLines.push(sourceUnit?.name || companySettings.companyName || '');
        if (sourceUnit?.name && companySettings.companyName) {
           companyLines.push(`Groupe: ${companySettings.companyName}`);
        }
        
        doc.text(companyLines[0], 196, yPosBase, { align: 'right' });
        
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        
        let currentY = yPosBase + 5;
        if (companyLines[1]) {
           doc.text(companyLines[1], 196, currentY, { align: 'right' });
           currentY += 5;
        }
        
        const address = sourceUnit?.address || companySettings.address;
        if (address) {
           doc.text(address, 196, currentY, { align: 'right' });
           currentY += 5;
        }

        const nif = sourceUnit?.nif || companySettings.nif;
        const rc = sourceUnit?.rc || companySettings.rc;
        const ai = sourceUnit?.ai || companySettings.ai;

        if (nif) { doc.text(`NIF: ${nif}`, 196, currentY, { align: 'right' }); currentY += 5; }
        if (rc) { doc.text(`RC: ${rc}`, 196, currentY, { align: 'right' }); currentY += 5; }
        if (ai) { doc.text(`AI: ${ai}`, 196, currentY, { align: 'right' }); }
      }

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`BT N° : ${transfer.transferNumber}`, 14, 35);
      doc.text(`Date : ${new Date(transfer.createdAt).toLocaleDateString()}`, 14, 40);
      doc.text(`Origine : ${transfer.sourceLocation}`, 14, 45);
      doc.text(`Destination : ${transfer.destLocation}`, 14, 50);
      doc.text(`Créé par : ${transfer.createdBy}`, 14, 55);
      
      const tableData = transfer.items.map((item: any) => [
        item.sku, item.name, item.expectedQty, ''
      ]);

      autoTable(doc, {
        head: [['SKU', 'Produit', 'Qté Prévue', 'Qté Reçue (Pointage)']],
        body: tableData,
        startY: 65,
        theme: 'grid',
        headStyles: { fillColor: [19, 106, 168], fontStyle: 'bold' },
        styles: { fontSize: 9 }
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 150;
      doc.setFontSize(10);
      doc.setTextColor(19, 106, 168);
      doc.text("Visa Origine:", 14, finalY + 15);
      doc.text("___________________", 14, finalY + 25);
      
      doc.text("Visa Destination:", 140, finalY + 15);
      doc.text("___________________", 140, finalY + 25);
      
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("Généré via ProcuraFlow - Gestion d'Entrepôt", 14, 280);
      
      doc.save(`${transfer.transferNumber}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la génération PDF.");
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-[#136AA8]" /></div>;
  if (!transfer) return <div className="p-20 text-center text-slate-500">Transfert introuvable.</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button onClick={() => navigate('/')} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-[#009CDA] transition-colors">
        <ArrowLeft size={16} /> Retour au tableau de bord
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
        <div className="flex flex-col md:flex-row justify-between gap-6 mb-8 border-b border-slate-100 pb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-black text-[#136AA8]">{transfer.transferNumber}</h1>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold uppercase">
                {transfer.status === 'in_transit' ? 'En Transit' : transfer.status === 'completed' ? 'Reçu' : 'Brouillon'}
              </span>
            </div>
            <p className="text-slate-500">Généré le {new Date(transfer.createdAt).toLocaleDateString()} par {transfer.createdBy}</p>
          </div>
          
          <button onClick={exportPDF} className="bg-[#136AA8] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 hover:bg-[#152e4d] transition-all h-fit">
            <FileText size={18} /> Imprimer / PDF
          </button>
        </div>

        <div className="flex items-center gap-4 bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-widest font-bold text-slate-400 mb-1">Origine</p>
            <p className="text-lg font-bold text-[#136AA8]">{transfer.sourceLocation}</p>
          </div>
          <ArrowRightLeft className="text-slate-400" />
          <div className="flex-1 text-right">
            <p className="text-xs uppercase tracking-widest font-bold text-slate-400 mb-1">Destination</p>
            <p className="text-lg font-bold text-[#136AA8]">{transfer.destLocation}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200 text-sm py-4">
                <th className="py-4 font-bold text-slate-700">SKU</th>
                <th className="py-4 font-bold text-slate-700">Produit</th>
                <th className="py-4 font-bold text-slate-700 text-right">Qté Prévue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transfer.items.map((item: any, idx: number) => (
                <tr key={idx}>
                  <td className="py-4 text-sm font-mono text-slate-500">{item.sku}</td>
                  <td className="py-4 font-medium text-slate-800">{item.name}</td>
                  <td className="py-4 text-right font-bold text-[#136AA8]">{item.expectedQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
