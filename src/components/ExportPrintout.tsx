import React, { useEffect, useState } from 'react';
import { ArrowLeft, Printer, Download, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PrintoutProps {
  data: any;
  type: 'proforma' | 'final' | 'packing';
  onClose: () => void;
}

export default function ExportPrintout({ data, type, onClose }: PrintoutProps) {
  const { tenantId } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const fetchLogo = async () => {
      if (!tenantId) return;
      try {
        const docRef = doc(db, 'tenant_settings', tenantId);
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().logoUrl) {
          setLogoUrl(snap.data().logoUrl);
        }
      } catch (err) {
        console.error('Error fetching logo:', err);
      }
    };
    fetchLogo();
  }, [tenantId]);

  const generatePDF = async () => {
    const element = document.getElementById('pdf-content');
    if (!element) return;
    
    setIsGenerating(true);
    try {
      // Temporarily adapt element for PDF rendering
      const originalClasses = element.className;
      element.classList.remove('shadow-lg', 'border', 'my-[2cm]', 'mx-auto');
      element.classList.add('m-0');
      
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true,
        logging: false
      });
      
      // Restore classes
      element.className = originalClasses;

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgRatio = canvas.height / canvas.width;
      
      const margin = 5; // 5mm minimal margin
      const maxPdfWidth = pdfWidth - 2 * margin;
      const maxPdfHeight = pdfHeight - 2 * margin;

      let targetWidth = maxPdfWidth;
      let targetHeight = targetWidth * imgRatio;

      if (targetHeight > maxPdfHeight) {
          targetHeight = maxPdfHeight;
          targetWidth = targetHeight / imgRatio;
      }

      const marginX = (pdfWidth - targetWidth) / 2;
      const marginY = (pdfHeight - targetHeight) / 2;
      
      pdf.addImage(imgData, 'JPEG', marginX, marginY, targetWidth, targetHeight);
      pdf.save(`SPA_${data.invoiceNumber || 'Facture'}_${type}.pdf`);
    } catch (error) {
      console.error('Error generating PDF', error);
      alert('Erreur lors de la génération du PDF. Assurez-vous que l\'image du logo soit accessible (CORS).');
    } finally {
      setIsGenerating(false);
    }
  };

  const numberToWordsFr = (n: number) => {
    if (n === 0) return 'zero';
    if (n < 0) return 'moins ' + numberToWordsFr(Math.abs(n));
    const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
    const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const tens = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];
    
    function convert(num: number): string {
        if (num < 10) return units[num];
        if (num < 20) return teens[num - 10];
        if (num < 70) {
            const ten = Math.floor(num / 10);
            const unit = num % 10;
            if (unit === 1 && ten < 8) return tens[ten] + ' et ' + units[unit];
            return tens[ten] + (unit ? '-' + units[unit] : '');
        }
        if (num < 80) return tens[6] + '-' + teens[num - 70];
        if (num < 100) {
             const unit = num % 10;
             if (num === 80) return tens[8] + 's';
             return tens[8] + (unit ? '-' + units[unit] : '');
        }
        if (num < 200) return 'cent' + (num % 100 ? ' ' + convert(num % 100) : '');
        if (num < 1000) {
             let hundreds = Math.floor(num / 100);
             return (hundreds > 1 ? units[hundreds] + ' ' : '') + 'cent' + (num % 100 ? ' ' + convert(num % 100) : 's');
        }
        if (num < 2000) return 'mille' + (num % 1000 ? ' ' + convert(num % 1000) : '');
        if (num < 1000000) {
            let thousands = Math.floor(num / 1000);
            return (thousands === 1 ? 'mille' : convert(thousands) + ' mille') + (num % 1000 ? ' ' + convert(num % 1000) : '');
        }
        if (num < 1000000000) {
             let millions = Math.floor(num / 1000000);
             return (millions === 1 ? 'un million' : convert(millions) + ' millions') + (num % 1000000 ? ' ' + convert(num % 1000000) : '');
        }
        return num.toString();
    }
    return convert(Math.floor(n));
  };
  
  const getCurrencyName = () => {
    if(data.currency === '$') return 'dollar';
    if(data.currency === '£') return 'pound';
    return 'euro';
  };

  const numberWords = `${numberToWordsFr(data.totalCfr || 0)} ${getCurrencyName()}${Math.floor(data.totalCfr || 0) > 1 ? 's' : ''} et ${numberToWordsFr(Math.round(((data.totalCfr || 0) % 1) * 100))} cents`;

  let title = "Facture Proforma";
  if (type === 'final') title = "Facture Finale";
  if (type === 'packing') title = "Packing List (Liste de Colisage)";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-[#e0e0e0] z-50 overflow-y-auto">
      {/* Controls */}
      <div className="sticky top-0 bg-[#2c3e50] p-4 flex justify-between items-center z-10 shadow-md print:hidden">
        <button onClick={onClose} className="flex items-center gap-2 text-white bg-slate-700 px-4 py-2 rounded shadow hover:bg-slate-600 transition">
          <ArrowLeft size={16} /> Retour
        </button>
        <div className="flex items-center gap-3">
          <button 
            onClick={generatePDF} 
            disabled={isGenerating}
            className="flex items-center gap-2 text-white bg-[#3498db] px-5 py-2 rounded shadow font-bold hover:bg-[#2980b9] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {isGenerating ? 'Génération...' : 'Enregistrer en PDF'}
          </button>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white !important; }
          .print-hidden { display: none !important; }
        }
      `}</style>

      {/* A4 Page Container */}
      <div id="pdf-content" className="w-[21cm] min-h-[29.7cm] p-[1cm] mx-auto my-[1cm] border border-[#d3d3d3] bg-white shadow-lg box-border text-[#2c3e50] font-['Lato',sans-serif] print:m-0 print:border-none print:shadow-none">
        
        <header className="text-center border-b-2 border-[#cbd5e1] pb-4 mb-6">
          <div className="flex justify-between items-center px-4">
             {logoUrl ? (
               <img src={logoUrl} alt="Logo" className="max-w-[200px] max-h-[80px] object-contain" />
             ) : (
               <div className="w-[180px] h-[80px] bg-[#f1f5f9] flex items-center justify-center font-bold text-xs text-[#94a3b8]">LOGO</div>
             )}
             <h2 className="text-3xl font-bold m-0 tracking-widest text-[#2c3e50]">SPA EL FATH</h2>
             {logoUrl ? (
               <img src={logoUrl} alt="Logo" className="max-w-[200px] max-h-[80px] object-contain" />
             ) : (
               <div className="w-[180px] h-[80px] bg-[#f1f5f9] flex items-center justify-center font-bold text-xs text-[#94a3b8]">LOGO</div>
             )}
          </div>
          <div className="text-[11px] leading-relaxed text-[#555] mt-4">
             Z.I Commune de Barika 05400 W Batna<br />
             <strong>R. C:</strong> 05/10-0222357 B99 | <strong>N° TAX:</strong> 0999 0502 22357 41 | <strong>ARTICL CODE:</strong> TIN 00051586 | <strong>N.I.S:</strong> 0984 0542 00701 39<br />
             <strong>N° PHONE / FAX:</strong> 00 213 33 38 21 18 | <strong>MOBILE:</strong> 00 213 550 951 113<br />
             <strong>EMAIL:</strong> aymen.benouasser@spaelfath.com / import.export@spaelfath.com
          </div>
        </header>

        <div className="text-center my-6">
          <h1 className="text-2xl uppercase tracking-[1.5px] font-black text-[#2c3e50]">{title}</h1>
        </div>

        <div className="flex justify-between mb-6 leading-relaxed">
          <div className="w-[48%]">
            <strong>FACTURE N°:</strong> {data.invoiceNumber || 'SPA0000'}<br/>
            <strong>Date:</strong> {data.date}
          </div>
          <div className="w-[48%]">
            <strong>CLIENT:</strong> {data.clientName}<br/>
            <strong>ADRESSE:</strong> {data.clientAddress}<br/>
            <strong>MOBILE:</strong> {data.clientMobile}<br/>
            <strong>EMAIL:</strong> {data.clientEmail}
          </div>
        </div>

        <div className="flex justify-between mb-5 p-3 border border-[#cbd5e1] bg-[#f8f9fa] rounded">
          <span><strong>PORT DE CHARGEMENT:</strong> {data.portOfLoading}</span>
          <span><strong>PORT DE DECHARGEMENT:</strong> {data.portOfDischarge}</span>
        </div>

        <table className="w-full border-collapse mb-4 border border-[#cbd5e1]">
          <thead>
            <tr className="bg-[#f8f9fa] text-[12px] uppercase">
               <th className="border border-[#cbd5e1] p-2.5">#</th>
               <th className="border border-[#cbd5e1] p-2.5 text-left">Référence / Description</th>
               <th className="border border-[#cbd5e1] p-2.5">Unité</th>
               <th className="border border-[#cbd5e1] p-2.5">Qte</th>
               {type !== 'packing' && (
                 <>
                  <th className="border border-[#cbd5e1] p-2.5">Prix U ({data.currency})</th>
                  <th className="border border-[#cbd5e1] p-2.5">Montant ({data.currency})</th>
                 </>
               )}
            </tr>
          </thead>
          <tbody>
            {(data.items || []).map((item: any, idx: number) => {
              const qte = parseFloat(item.quantity) || 0;
              const unitP = parseFloat(item.unitPrice) || 0;
              return (
                <tr key={idx}>
                  <td className="border border-[#cbd5e1] p-2.5 text-center">{idx + 1}</td>
                  <td className="border border-[#cbd5e1] p-2.5 font-bold uppercase">{item.description}</td>
                  <td className="border border-[#cbd5e1] p-2.5 text-center">{item.unit}</td>
                  <td className="border border-[#cbd5e1] p-2.5 text-center">{qte}</td>
                  {type !== 'packing' && (
                    <>
                      <td className="border border-[#cbd5e1] p-2.5 text-center">{unitP.toFixed(2)}</td>
                      <td className="border border-[#cbd5e1] p-2.5 text-center font-bold">{(qte * unitP).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="flex justify-between items-start mt-6">
           <div className="border border-[#cbd5e1] px-4 py-2 rounded">
              <strong>Nombre de colis :</strong> {data.numberOfPackages || 0}
           </div>
           
           {type !== 'packing' && (
             <table className="w-[45%] border-collapse border border-[#cbd5e1]">
               <tbody>
                  <tr>
                    <td className="border border-[#cbd5e1] p-2.5">TOTAL FOB ({data.currency})</td>
                    <td className="border border-[#cbd5e1] p-2.5 text-right font-bold text-lg">{(data.totalFob || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td className="border border-[#cbd5e1] p-2.5">FRET MARITIME 40HC ({data.currency})</td>
                    <td className="border border-[#cbd5e1] p-2.5 text-right font-bold">{(data.freightAmount || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="bg-[#2c3e50] text-white">
                    <td className="border border-[#cbd5e1] p-2.5 font-bold">TOTAL CFR ({data.currency})</td>
                    <td className="border border-[#cbd5e1] p-2.5 text-right font-bold text-xl">{(data.totalCfr || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                  </tr>
               </tbody>
             </table>
           )}
        </div>

        <div className="mt-8 space-y-1.5 text-sm">
           {type !== 'packing' && <p>Total en toutes lettres : <strong>{numberWords}</strong></p>}
           <p><strong>Remarque:</strong> {data.remark}</p>
           <p><strong>PAYS D'ORIGINE:</strong> ALGERIE</p>
           {type !== 'packing' && <p><strong>MODE DE PAIEMENT:</strong> {data.paymentMode}</p>}
        </div>

        <div className="flex justify-between mt-8 bg-[#f8f9fa] p-4 border border-[#cbd5e1] rounded text-[11px] leading-relaxed">
           <div className="w-[48%]">
              <h4 className="m-0 text-[#3498db] border-b border-[#cbd5e1] pb-1 mb-2">COORDONNEES BANCAIRES DE L'EXPORTATEUR</h4>
              <p className="m-0 mb-1"><strong>Nom de Bénéficiaire:</strong> SPA EL FATH</p>
              <p className="m-0 mb-1"><strong>BANK:</strong> Société Générale Algérie</p>
              <p className="m-0 mb-1"><strong>ADDRESS:</strong> Agence de centre d'affaire sidi yahia 01 rue hamdani lahcen</p>
              <p className="m-0 mb-1"><strong>SWIFT:</strong> SOGEDZAL</p>
              <p className="m-0 mb-1"><strong>COMPTE N°:</strong> 021 00001 1130064927 80</p>
           </div>
           <div className="w-[48%]">
              <h4 className="m-0 text-[#3498db] border-b border-[#cbd5e1] pb-1 mb-2">COORDONNEES BANCAIRES DE L'IMPORTATEUR</h4>
              <p className="m-0 mb-1"><strong>BANK:</strong> {data.clientBankName || 'Société Générale'}</p>
              <p className="m-0 mb-1"><strong>ADD:</strong> {data.clientBankAddress || 'PARIS MIRABEAU 1A7 rue de Remusat 75016 Paris'}</p>
              <p className="m-0 mb-1"><strong>COMPTE N°:</strong> {data.clientBankAccount || '00027000581'}</p>
              <p className="m-0 mb-1"><strong>SWIFT:</strong> {data.clientBankSwift || 'SOGEFRPP'}</p>
              <p className="m-0 mb-1"><strong>IBAN:</strong> {data.clientBankIban || 'FR76 3000 3030 4100 0270 0058 168'}</p>
           </div>
        </div>

        <div className="flex justify-between mt-12 mb-8 break-inside-avoid text-sm">
           <div className="w-[45%] text-center border-t border-[#2c3e50] pt-2 font-bold">Vendeur</div>
           <div className="w-[45%] text-center border-t border-[#2c3e50] pt-2 font-bold">Achteur</div>
        </div>

      </div>
    </motion.div>
  );
}
