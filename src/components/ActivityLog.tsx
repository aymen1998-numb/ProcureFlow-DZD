import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Clock, Package, Building2, Users as UsersIcon, FileText } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function ActivityLog() {
  const { user, role, tenantId } = useAuth();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    // Fetch from all collections and merge
    const unsubProducts = onSnapshot(query(collection(db, 'products'), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'), limit(20)), (snap) => {
      const prods = snap.docs.map(d => ({ ...d.data(), id: d.id, type: 'product' }));
      updateActivities(prods, 'product');
    });

    const unsubSuppliers = onSnapshot(query(collection(db, 'suppliers'), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'), limit(20)), (snap) => {
      const sups = snap.docs.map(d => ({ ...d.data(), id: d.id, type: 'supplier' }));
      updateActivities(sups, 'supplier');
    });

    const unsubOrders = onSnapshot(query(collection(db, 'purchase_orders'), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'), limit(20)), (snap) => {
      const pos = snap.docs.map(d => ({ ...d.data(), id: d.id, type: 'order' }));
      updateActivities(pos, 'order');
    });

    const unsubUsers = onSnapshot(query(collection(db, 'users'), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'), limit(20)), (snap) => {
      const usrs = snap.docs.map(d => ({ ...d.data(), id: d.id, type: 'user' }));
      updateActivities(usrs, 'user');
    });

    return () => {
      unsubProducts();
      unsubSuppliers();
      unsubOrders();
      unsubUsers();
    };
  }, [tenantId]);

  const [cache, setCache] = useState<Record<string, any[]>>({ product: [], supplier: [], order: [], user: [] });

  const updateActivities = (newItems: any[], type: string) => {
    setCache(prev => {
      const next = { ...prev, [type]: newItems };
      const all = Object.values(next).flat().filter(i => i.createdAt);
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setActivities(all.slice(0, 50));
      setLoading(false);
      return next;
    });
  };

  if (loading) return <div className="p-10 text-center"><span className="animate-pulse">Chargement de l'historique...</span></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-[#1E3A5F] tracking-tight uppercase flex items-center gap-3">
          <Clock className="text-blue-600" />
          Historique des Activités
        </h2>
        <p className="text-slate-500 font-medium mt-1">Traçabilité des ajouts récents (Produits, Fournisseurs, Commandes, Utilisateurs).</p>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
          {activities.map((item, index) => (
             <motion.div key={item.id + index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
               <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-100 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                 {item.type === 'product' && <Package size={16} className="text-blue-500" />}
                 {item.type === 'supplier' && <Building2 size={16} className="text-emerald-500" />}
                 {item.type === 'order' && <FileText size={16} className="text-indigo-500" />}
                 {item.type === 'user' && <UsersIcon size={16} className="text-orange-500" />}
               </div>

               <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      item.type === 'product' ? 'text-blue-500' : 
                      item.type === 'supplier' ? 'text-emerald-500' : 
                      item.type === 'order' ? 'text-indigo-500' : 'text-orange-500'
                    }`}>
                      {item.type === 'product' ? 'Nouveau Produit' : 
                       item.type === 'supplier' ? 'Nouveau Fournisseur' : 
                       item.type === 'order' ? 'Nouvelle Commande' : 'Nouvel Utilisateur'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {new Date(item.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <h4 className="font-bold text-[#1E3A5F] text-sm">
                     {item.type === 'product' ? item.name : 
                      item.type === 'supplier' ? item.name : 
                      item.type === 'order' ? `BC: ${item.poNumber || 'N/A'}` : item.displayName}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                     Ajouté par : <span className="font-bold text-slate-700">{item.createdBy || item.buyerName || 'Administrateur'}</span>
                  </p>
               </div>
             </motion.div>
          ))}
          {activities.length === 0 && (
             <div className="text-center text-slate-400 text-sm py-10">Aucune activité récente.</div>
          )}
        </div>
      </div>
    </div>
  );
}
