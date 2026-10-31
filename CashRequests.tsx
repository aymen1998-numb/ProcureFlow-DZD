import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Plus, Search, FileText, CheckCircle, XCircle, Printer, Clock, Coins, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import jsPDF from 'jspdf';
import { useTranslation } from 'react-i18next';
import { useToast } from '../contexts/ToastContext';

export default function CashRequests() {
  const { t } = useTranslation();
  const { user, role, tenantId } = useAuth();
  const { success, error } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ amount: '', reason: '', department: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    if (!tenantId) return;

    const q = query(
      collection(db, 'cash_requests'),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      if (!['admin', 'superadmin', 'finance'].includes(role || '')) {
        data = data.filter((req: any) => req.requesterId === user?.uid);
      }

      setRequests(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !user) return;
    setIsSubmitting(true);

    try {
      await addDoc(collection(db, 'cash_requests'), {
        tenantId,
        amount: Number(formData.amount),
        reason: formData.reason,
        department: formData.department || 'Non spécifié',
        status: 'requested',
        requesterId: user.uid,
        requesterName: user.displayName || 'Utilisateur',
        adminApproved: false,
        financeApproved: false,
        createdAt: serverTimestamp(),
      });
      setIsModalOpen(false);
      setFormData({ amount: '', reason: '', department: '' });
      success('Bon de caisse créé avec succès');
    } catch (err) {
      console.error('Error creating cash request:', err);
      error('Erreur lors de la création de la demande');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id: string, request: any, approverRole: 'admin' | 'finance') => {
    try {
      const updateData: any = {};
      if (approverRole === 'admin') {
        updateData.adminApproved = true;
        updateData.adminApprovedAt = serverTimestamp();
      }
      if (approverRole === 'finance') {
        updateData.financeApproved = true;
        updateData.financeApprovedAt = serverTimestamp();
      }
      
      const willBeAdminApproved = approverRole === 'admin' ? true : request.adminApproved;
      const willBeFinanceApproved = approverRole === 'finance' ? true : request.financeApproved;

      if (willBeAdminApproved && willBeFinanceApproved) {
        updateData.status = 'approved';
      }

      await updateDoc(doc(db, 'cash_requests', id), updateData);
      success(`Demande approuvée par ${approverRole === 'admin' ? 'Admin' : 'Finance'}`);
    } catch (err) {
      console.error('Error approving request:', err);
      error("Erreur lors de l'approbation");
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await updateDoc(doc(db, 'cash_requests', id), {
        status: 'completed',
        completedAt: serverTimestamp(),
        completedBy: user?.displayName
      });
      success('Bon de caisse traité et clôturé');
    } catch (err) {
      console.error('Error completing request:', err);
      error('Erreur lors du traitement du bon de caisse');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await updateDoc(doc(db, 'cash_requests', id), {
        status: 'rejected',
        rejectedAt: serverTimestamp(),
        rejectedBy: user?.displayName
      });
      success('La demande a été rejetée');
    } catch (err) {
      console.error('Error rejecting request:', err);
      error('Erreur lors du rejet de la demande');
    }
  };

  const printDocument = (req: any) => {
    const doc = new jsPDF();
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("BON DE CAISSE", 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    
    doc.text(`Ref: BC-${req.id.slice(0, 8).toUpperCase()}`, 20, 40);
    doc.text(`Date: ${req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString('fr-FR') : ''}`, 130, 40);
    doc.text(`Beneficiaire: ${req.requesterName}`, 20, 50);
    doc.text(`Departement / Unite: ${req.department || 'Non specifie'}`, 20, 60);
    doc.text(`Montant (DZD): ${req.amount.toLocaleString()} DA`, 20, 70);
    
    // Auto-wrap reason if it's too long
    const splitReason = doc.splitTextToSize(`Motif: ${req.reason}`, 170);
    doc.text(splitReason, 20, 80);
    const reasonHeight = splitReason.length * 5;
    
    doc.line(20, 85 + reasonHeight, 190, 85 + reasonHeight);
    
    doc.setFont("helvetica", "bold");
    doc.text("Visa Beneficiaire", 45, 95 + reasonHeight, { align: "center" });
    doc.text("Visa Direction (Admin)", 105, 95 + reasonHeight, { align: "center" });
    doc.text("Visa Finance", 165, 95 + reasonHeight, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    if (req.adminApproved) {
      doc.text("APPROUVE", 105, 115 + reasonHeight, { align: "center" });
      if (req.adminApprovedAt?.toDate) {
        doc.text(req.adminApprovedAt.toDate().toLocaleDateString('fr-FR'), 105, 120 + reasonHeight, { align: "center" });
      }
    }
    if (req.financeApproved) {
      doc.text("APPROUVE", 165, 115 + reasonHeight, { align: "center" });
      if (req.financeApprovedAt?.toDate) {
        doc.text(req.financeApprovedAt.toDate().toLocaleDateString('fr-FR'), 165, 120 + reasonHeight, { align: "center" });
      }
    }
    if (req.status === 'completed') {
      doc.text("TRAITE / PAYE", 165, 125 + reasonHeight, { align: "center" });
      if (req.completedAt?.toDate) {
        doc.text(req.completedAt.toDate().toLocaleDateString('fr-FR'), 165, 130 + reasonHeight, { align: "center" });
      }
    }

    doc.save(`bon_de_caisse_${req.id.slice(0, 6)}.pdf`);
  };

  const { filteredRequests, paginatedRequests, totalPages } = React.useMemo(() => {
    const filtered = requests.filter(r => {
      const matchesSearch = r.reason.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            r.requesterName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;

      let matchesDate = true;
      if (dateFrom || dateTo) {
        const reqDate = r.createdAt?.toDate ? r.createdAt.toDate() : new Date();
        const dFrom = dateFrom ? new Date(dateFrom) : new Date(0);
        dFrom.setHours(0, 0, 0, 0);
        const dTo = dateTo ? new Date(dateTo) : new Date(2100, 0, 1);
        dTo.setHours(23, 59, 59, 999);
        matchesDate = reqDate >= dFrom && reqDate <= dTo;
      }

      return matchesSearch && matchesStatus && matchesDate;
    });

    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
    const safePage = Math.min(currentPage, totalPages);
    const paginated = filtered.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

    return { filteredRequests: filtered, paginatedRequests: paginated, totalPages };
  }, [requests, searchTerm, statusFilter, dateFrom, dateTo, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#136AA8] tracking-tight uppercase flex items-center gap-3">
            <Coins className="text-[#009CDA] w-8 h-8" />
            {t('cash_requests')}
          </h2>
          <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest text-[10px]">
            Gestion des demandes de fonds / بيان صرف
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:border-[#009CDA] focus:ring-1 focus:ring-[#009CDA] outline-none transition-all"
            />
          </div>

          <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {['all', 'requested', 'approved', 'completed', 'rejected'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                  statusFilter === status 
                    ? 'bg-[#136AA8] text-white' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {status === 'all' ? 'Tous' : 
                 status === 'requested' ? 'En Attente' : 
                 status === 'approved' ? 'Approuvé' : 
                 status === 'completed' ? 'Traité' : 'Rejeté'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1 bg-transparent border-none text-[10px] font-bold text-slate-600 focus:outline-none uppercase"
            />
            <span className="text-slate-300">-</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1 bg-transparent border-none text-[10px] font-bold text-slate-600 focus:outline-none uppercase"
            />
          </div>

          <button 
            onClick={() => setIsModalOpen(true)} 
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#136AA8] text-white px-5 py-2 rounded-xl font-bold hover:bg-[#152945] transition-all shadow-md active:scale-95 text-sm uppercase tracking-wide whitespace-nowrap"
          >
            <Plus size={18} /> Nouvelle Demande
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedRequests.map(req => (
          <div key={req.id} className="bg-white border text-left border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
               <div>
                  <h3 className="font-bold text-slate-800 line-clamp-1">{req.reason}</h3>
                  <p className="text-xs font-bold text-slate-500 mt-1">{req.requesterName}</p>
               </div>
               <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg ${
                 req.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                 req.status === 'approved' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                 req.status === 'rejected' ? 'bg-red-100 text-red-700 border border-red-200' :
                 'bg-amber-100 text-amber-700 border border-amber-200'
               }`}>
                 {req.status === 'completed' ? 'Traité' : req.status === 'approved' ? 'Approuvé' : req.status === 'rejected' ? 'Rejeté' : 'En Attente'}
               </span>
            </div>

            <div className="text-2xl font-black text-[#136AA8] mb-4">
              {req.amount.toLocaleString()} DZD
            </div>

            <div className="flex items-center justify-between mb-4 text-[10px] font-bold uppercase tracking-wider">
               <div className="flex items-center gap-1.5">
                 <span className={`flex items-center gap-1 ${req.adminApproved ? 'text-emerald-600' : 'text-slate-400'}`}>
                   {req.adminApproved ? <CheckCircle size={12} /> : <Clock size={12} />} Admin
                 </span>
                 <span className="text-slate-300">|</span>
                 <span className={`flex items-center gap-1 ${req.financeApproved ? 'text-emerald-600' : 'text-slate-400'}`}>
                   {req.financeApproved ? <CheckCircle size={12} /> : <Clock size={12} />} Finance
                 </span>
               </div>
               <div className="text-slate-400">
                 {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString('fr-FR') : ''}
               </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
               <button onClick={() => printDocument(req)} className="px-3 py-2 text-slate-500 font-bold uppercase text-[10px] hover:text-[#136AA8] bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors flex-1 flex justify-center items-center gap-1.5">
                 <Printer size={14} /> Imprimer
               </button>
               
               {req.status !== 'completed' && req.status !== 'rejected' && ['admin', 'superadmin'].includes(role || '') && !req.adminApproved && (
                 <button onClick={() => handleApprove(req.id, req, 'admin')} className="px-3 py-2 text-emerald-600 hover:bg-emerald-50 bg-emerald-50/50 border border-emerald-100 rounded-lg transition-colors flex-1 flex justify-center gap-1.5 font-bold text-[10px] items-center uppercase">
                   <CheckCircle size={14} /> Approuver (Admin)
                 </button>
               )}
               {req.status !== 'completed' && req.status !== 'rejected' && role === 'finance' && !req.financeApproved && (
                 <button onClick={() => handleApprove(req.id, req, 'finance')} className="px-3 py-2 text-emerald-600 hover:bg-emerald-50 bg-emerald-50/50 border border-emerald-100 rounded-lg transition-colors flex-1 flex justify-center gap-1.5 font-bold text-[10px] items-center uppercase">
                   <CheckCircle size={14} /> Approuver (Finance)
                 </button>
               )}

               {req.status === 'approved' && role === 'finance' && (
                 <button onClick={() => handleComplete(req.id)} className="w-full mt-2 py-2.5 bg-emerald-500 text-white shadow hover:shadow-md rounded-lg font-bold text-xs hover:bg-emerald-600 uppercase flex items-center justify-center gap-2 transition-all">
                   <Coins size={16} /> Confirmer Remise Cash
                 </button>
               )}

               {req.status === 'requested' && (['admin', 'superadmin', 'finance'].includes(role || '')) && (
                 <button onClick={() => handleReject(req.id)} className="px-3 py-2 text-red-600 hover:bg-red-50 bg-red-50/50 border border-red-100 rounded-lg transition-colors flex-none flex justify-center items-center">
                   <XCircle size={16} />
                 </button>
               )}
            </div>
          </div>
        ))}
        {filteredRequests.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-sm">
            Aucune demande trouvée
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <span className="text-xs font-bold text-slate-500">
            Affichage {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredRequests.length)} sur {filteredRequests.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-black text-slate-700">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-[#136AA8] text-white">
              <h3 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
                <Coins size={20} />
                Nouveau Bon de Caisse
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white hover:text-red-200 transition-colors">
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Département / Unité *</label>
                  <input
                    type="text"
                    required
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white transition-all outline-none focus:ring-2 focus:ring-[#136AA8] focus:border-[#136AA8]"
                    placeholder="Ex: Informatique, Achat, etc."
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Montant Demandé (DZD) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white transition-all outline-none focus:ring-2 focus:ring-[#136AA8] focus:border-[#136AA8]"
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Motif de la demande *</label>
                   <textarea
                     required
                     value={formData.reason}
                     onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                     className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white transition-all outline-none focus:ring-2 focus:ring-[#136AA8] focus:border-[#136AA8] min-h-[100px] resize-none"
                     placeholder="Détails de la demande de fonds..."
                   />
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-slate-200 transition-all">
                  Annuler
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-[#136AA8] text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-[#152945] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  <CheckCircle size={16} /> Demander
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
