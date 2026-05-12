import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Plus, ArrowRightLeft, Search, Loader2 } from 'lucide-react';
import CreateTransferModal from './CreateTransferModal';
import { useNavigate } from 'react-router-dom';

export default function Transfers() {
  const { tenantId } = useAuth();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, 'transfers'), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setTransfers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tenantId]);

  const filteredTransfers = transfers.filter(t => 
    t.transferNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.sourceLocation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.destLocation?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#136AA8] flex items-center gap-2">
            <ArrowRightLeft className="text-[#009CDA]" /> Bons de Transfert
          </h1>
          <p className="text-slate-500 mt-1">Gérez les transferts de stock entre vos usines et dépôts</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#009CDA] hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-sm"
        >
          <Plus size={20} /> Nouveau Transfert
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher un transfert (N°, Usine)..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            Aucun transfert trouvé.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-bold">
                  <th className="p-4">N° Transfert</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Origine</th>
                  <th className="p-4">Destination</th>
                  <th className="p-4">Statut</th>
                  <th className="p-4 hidden sm:table-cell">Créé par</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransfers.map((t) => (
                  <tr 
                    key={t.id} 
                    onClick={() => navigate(`/transfers/${t.id}`)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <td className="p-4">
                      <span className="font-mono font-bold text-[#136AA8]">{t.transferNumber}</span>
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <span className="font-medium text-slate-700">{t.sourceLocation}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-medium text-slate-700">{t.destLocation}</span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                        ${t.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                          t.status === 'in_transit' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}
                      `}>
                        {t.status === 'completed' ? 'Terminé' : t.status === 'in_transit' ? 'En transit' : 'Brouillon'}
                      </span>
                    </td>
                    <td className="p-4 hidden sm:table-cell text-sm text-slate-500">
                      {t.createdBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateTransferModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
