import { useState, useEffect, lazy, Suspense } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { 
  BarChart3, 
  Plus, 
  Search, 
  LogOut, 
  User, 
  LayoutDashboard,
  Package,
  Globe,
  MapPin,
  Clock,
  Loader2,
  Users,
  Box,
  ChevronRight,
  TrendingUp,
  Truck,
  FileSpreadsheet,
  AlertTriangle,
  Menu,
  X,
  Settings,
  ArrowRightLeft,
  FileText,
  Archive as ArchiveIcon,
  Coins,
  ClipboardList,
  Factory,
  BookOpen,
  Ship
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import * as XLSX from 'xlsx';
import CreatePOModal from './CreatePOModal';
import AddSupplierModal from './AddSupplierModal';
import { ErrorBoundary } from './ErrorBoundary';

const Suppliers = lazy(() => import('./Suppliers'));
const Products = lazy(() => import('./Products'));
const UsersComponent = lazy(() => import('./Users'));
const ActivityLog = lazy(() => import('./ActivityLog'));
const Analytics = lazy(() => import('./Analytics'));

interface PO {
  id: string;
  poNumber: string;
  supplierName: string;
  totalAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  buyerName: string;
  buyerId?: string;
  unit?: any;
}

const SettingsComponent = lazy(() => import('./Settings'));
const Transfers = lazy(() => import('./Transfers'));
const CashRequests = lazy(() => import('./CashRequests'));

const InternalRequests = lazy(() => import('./InternalRequests'));
const Exports = lazy(() => import('./Exports'));
const IntlPurchases = lazy(() => import('./IntlPurchases'));
const Archive = lazy(() => import('./Archive'));
const RawMaterials = lazy(() => import('./RawMaterials'));
const BOMs = lazy(() => import('./BOMs'));
const ProductionOrders = lazy(() => import('./ProductionOrders'));
const UserGuide = lazy(() => import('./UserGuide'));

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user, role, tenantId, unitId } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'da' | 'intl_purchases' | 'transfers' | 'suppliers' | 'products' | 'raw_materials' | 'boms' | 'production_orders' | 'user_guide' | 'analytics' | 'history' | 'archive' | 'cash' | 'users' | 'settings' | 'exports'>('dashboard');
  
  useEffect(() => {
    if (role === 'magasinier') {
      setActiveTab('products');
    } else if (role === 'export') {
      setActiveTab('exports');
    }
  }, [role]);
  const [pos, setPos] = useState<PO[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [tenantUnits, setTenantUnits] = useState<any[]>([]);
  const [dashboardUnitId, setDashboardUnitId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialPOData, setInitialPOData] = useState<any>(null);

  const handleConvertDAToPO = (daObj: any) => {
    setInitialPOData({
      items: daObj.items.map((i: any) => ({ ...i, price: 0 })),
      linkedDA: daObj.id,
      daNumber: daObj.daNumber,
      unitId: daObj.unitId
    });
    setIsModalOpen(true);
  };

  const handleConvertDAToIntlPO = async (daObj: any) => {
    if (!tenantId) return;
    try {
      const { addDoc, collection } = await import('firebase/firestore');
      await addDoc(collection(db, 'intl_purchases'), {
        tenantId,
        daId: daObj.id,
        daNumber: daObj.daNumber,
        unitId: daObj.unitId,
        items: daObj.items,
        status: 'proforma',
        paymentMethod: '',
        documents: {
          facture: false,
          bl: false,
          certOrigin: false,
          packingList: false
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      // Try to update DA to keep track that it's processing?
      // For now just switch tab
      setActiveTab('intl_purchases');
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la création de l'achat international");
    }
  };
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !tenantId) return;

    let q = query(collection(db, 'purchase_orders'), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'));
    
    // Buyers only see their own POs
    if (role === 'buyer') {
      q = query(collection(db, 'purchase_orders'), where('tenantId', '==', tenantId), where('buyerId', '==', user.uid), orderBy('createdAt', 'desc'));
    } else if (role === 'magasinier' && unitId) {
      q = query(collection(db, 'purchase_orders'), where('tenantId', '==', tenantId), where('unit.id', '==', unitId), orderBy('createdAt', 'desc'));
    } else if (role === 'buyer_intl') {
      // Intl buyer doesn't see local POs
      setPos([]);
      setLoading(false);
      // Wait for unsub check below...
    } else if (['admin', 'superadmin'].includes(role || '')) {
      getDoc(doc(db, 'tenant_settings', tenantId)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.units) {
            setTenantUnits(data.units);
          } else if (data.locations) {
            const locs = (data.locations || 'Siège Principal').split(',').map((l: string) => l.trim()).filter(Boolean);
            setTenantUnits(locs.map((name: string, i: number) => ({ id: `legacy-${i}`, name })));
          }
        }
      });
    }

    let unsubscribe = () => {};
    if (role === 'buyer_intl') {
      setPos([]);
      setLoading(false);
    } else {
      unsubscribe = onSnapshot(q, (snap) => {
        setPos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PO[]);
        setLoading(false);
      }, (error) => {
        if (error.message.includes('index')) {
          const qFallback = query(collection(db, 'purchase_orders'), where('tenantId', '==', tenantId));
          unsubscribe = onSnapshot(qFallback, (snap2) => {
            let docs = snap2.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PO[];
            if (role === 'buyer') {
              docs = docs.filter(d => d.buyerId === user.uid);
            } else if (role === 'magasinier' && unitId) {
              docs = docs.filter((d: any) => d.unit && d.unit.id === unitId);
            }
            docs.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
            setPos(docs);
            setLoading(false);
          });
        } else {
          console.error(error);
        }
      });
    }

    const productsUnsub = onSnapshot(query(collection(db, 'products'), where('tenantId', '==', tenantId)), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribe();
      productsUnsub();
    };
  }, [user, role, tenantId]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Brouillon';
      case 'pending_approval': return 'En Attente';
      case 'approved': return 'Approuvé';
      case 'sent': return 'Envoyé';
      case 'confirmed': return 'Confirmé';
      case 'delivered': return 'Livré';
      case 'closed': return 'Clôturé';
      default: return status;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending_approval': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'approved': return 'bg-green-100 text-green-700 border-green-200';
      case 'delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'sent': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'confirmed': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'closed': return 'bg-gray-50 text-gray-700 border-gray-100';
      default: return 'bg-orange-50 text-orange-700 border-orange-100';
    }
  };

  const filteredPos = pos.filter(p => {
    if (['admin', 'superadmin'].includes(role || '') && dashboardUnitId !== 'all') {
      return p.unit?.id === dashboardUnitId;
    }
    return true;
  });

  const stats = [
    { label: 'Commandes Totales', value: filteredPos.length, icon: Package, color: 'blue' },
    { label: 'En attente Livraison', value: filteredPos.filter(p => !['delivered', 'closed'].includes(p.status)).length, icon: Truck, color: 'orange' },
    { label: 'Alertes Stock', value: products.filter(p => {
      if (['admin', 'superadmin'].includes(role || '') && dashboardUnitId === 'all') {
        let hasAlert = false;
        // Check HQ
        const hqStock = p.stockQuantity || 0;
        const hqMin = p.minStock || 0;
        if (hqStock <= hqMin && hqStock > 0) hasAlert = true;
        
        // Check other units
        if (p.unitStocks) {
          Object.keys(p.unitStocks).forEach(uid => {
            const uStock = p.unitStocks[uid].qty || 0;
            const uMin = p.unitStocks[uid].min || 0;
            if (uStock <= uMin && uStock > 0) hasAlert = true;
          });
        }
        return hasAlert;
      } else {
        const uId = (['admin', 'superadmin'].includes(role || '') && dashboardUnitId !== 'all') ? dashboardUnitId : (unitId || 'HQ');
        const stock = (p.unitStocks && p.unitStocks[uId] !== undefined) ? p.unitStocks[uId].qty : (uId === 'HQ' ? (p.stockQuantity || 0) : 0);
        const min = (p.unitStocks && p.unitStocks[uId] !== undefined && p.unitStocks[uId].min !== undefined) ? p.unitStocks[uId].min : (p.minStock || 0);
        return stock <= min && stock > 0;
      }
    }).length, icon: AlertTriangle, color: 'red' },
    { label: 'Dépenses Totales', value: `${filteredPos.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0).toLocaleString()} DZD`, icon: TrendingUp, color: 'emerald' }
  ];

  return (
    <div className="min-h-screen flex bg-[#F7F9FC]">
      {/* Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Matching HTML template style */}
      <aside className={`w-64 bg-white border-r border-gray-200 flex-col flex-shrink-0 h-screen shadow-sm z-50 transition-transform duration-300 fixed lg:sticky top-0 left-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex`}>
        <div className="h-[58px] bg-[#136AA8] flex items-center justify-between px-5 gap-3 shadow-md">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-teal-400 rounded-lg flex items-center justify-center text-white shadow-inner border border-white/20">
               <Box size={18} strokeWidth={2.5} />
             </div>
             <span className="font-bold text-lg tracking-tight text-white uppercase italic">Dashboard</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-white/70 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Menu Principal</div>
          {role !== 'magasinier' && (
            <button 
              onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
              className={`flex items-center gap-3 w-full p-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-[#EFF6FF] text-[#136AA8] border-l-4 border-[#136AA8]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}
            >
              <LayoutDashboard size={16} /> {t('dashboard')}
            </button>
          )}
          <button 
            onClick={() => { setActiveTab('da'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 w-full p-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'da' ? 'bg-[#EFF6FF] text-[#136AA8] border-l-4 border-[#136AA8]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}
          >
            <FileText size={16} /> {t('da')}
          </button>
          {['admin', 'superadmin', 'buyer_intl'].includes(role || '') && (
            <button 
              onClick={() => { setActiveTab('intl_purchases'); setIsMobileMenuOpen(false); }}
              className={`flex items-center gap-3 w-full p-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'intl_purchases' ? 'bg-[#EFF6FF] text-[#136AA8] border-l-4 border-[#136AA8]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}
            >
              <Globe size={16} /> {t('intl_purchases')}
            </button>
          )}
          {role !== 'magasinier' && (
            <button 
              onClick={() => { setActiveTab('suppliers'); setIsMobileMenuOpen(false); }}
              className={`flex items-center gap-3 w-full p-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'suppliers' ? 'bg-[#EFF6FF] text-[#136AA8] border-l-4 border-[#136AA8]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}
            >
              <Users size={16} /> {t('suppliers')}
            </button>
          )}
          <button 
            onClick={() => { setActiveTab('transfers'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 w-full p-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'transfers' ? 'bg-[#EFF6FF] text-[#136AA8] border-l-4 border-[#136AA8]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}
          >
            <ArrowRightLeft size={16} /> {t('transfers')}
          </button>
          <button 
            onClick={() => { setActiveTab('products'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 w-full p-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'products' ? 'bg-[#EFF6FF] text-[#136AA8] border-l-4 border-[#136AA8]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}
          >
            <Box size={16} /> {t('products')}
          </button>
          <button 
            onClick={() => { setActiveTab('raw_materials'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 w-full p-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'raw_materials' ? 'bg-amber-50 text-amber-700 border-l-4 border-amber-600' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}
          >
            <Box size={16} /> Mat. Première
          </button>
          {['admin', 'superadmin', 'production', 'magasinier'].includes(role || '') && (
            <>
              <button 
                onClick={() => { setActiveTab('boms'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 w-full p-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'boms' ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}
              >
                <ClipboardList size={16} /> Nomenclatures (BOM)
              </button>
              <button 
                onClick={() => { setActiveTab('production_orders'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 w-full p-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'production_orders' ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}
              >
                <Factory size={16} /> Production
              </button>
            </>
          )}
          <button 
            onClick={() => { setActiveTab('cash'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 w-full p-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'cash' ? 'bg-[#EFF6FF] text-[#136AA8] border-l-4 border-[#136AA8]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}
          >
            <Coins size={16} /> {t('cash_requests')}
          </button>
          {role !== 'magasinier' && (
            <>
              <button 
                onClick={() => { setActiveTab('analytics'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 w-full p-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'analytics' ? 'bg-[#EFF6FF] text-[#136AA8] border-l-4 border-[#136AA8]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}
              >
                <BarChart3 size={16} /> {t('analytics')}
              </button>
              <button 
                onClick={() => { setActiveTab('history'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 w-full p-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-[#EFF6FF] text-[#136AA8] border-l-4 border-[#136AA8]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}
              >
                <Clock size={16} /> {t('history')}
              </button>
              <button 
                onClick={() => { setActiveTab('archive'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 w-full p-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'archive' ? 'bg-[#EFF6FF] text-[#136AA8] border-l-4 border-[#136AA8]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}
              >
                <ArchiveIcon size={16} /> {t('archive')}
              </button>
            </>
          )}

          <div className="pt-4 pb-2 px-4">
             <p className="text-[10px] font-black font-mono text-gray-400 uppercase tracking-[0.2em]">Aide & Support</p>
          </div>
          <button 
            onClick={() => { setActiveTab('user_guide'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 w-full p-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'user_guide' ? 'bg-[#EFF6FF] text-[#136AA8] border-l-4 border-[#136AA8]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}
          >
            <BookOpen size={16} /> Guide Utilisateur
          </button>
          
          {['admin', 'superadmin', 'export'].includes(role || '') && (
            <>
              <div className="pt-4 pb-2 px-4">
                <p className="text-[10px] font-black font-mono text-gray-400 uppercase tracking-[0.2em]">Ventes / Exports</p>
              </div>
              <button 
                onClick={() => { setActiveTab('exports'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 w-full p-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'exports' ? 'bg-[#EFF6FF] text-[#136AA8] border-l-4 border-[#136AA8]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}
              >
                <Ship size={16} /> Exports (Proforma)
              </button>
            </>
          )}

          {['admin', 'superadmin'].includes(role || '') && (
            <>
              <div className="pt-4 pb-2 px-4">
                <p className="text-[10px] font-black font-mono text-gray-400 uppercase tracking-[0.2em]">Administration</p>
              </div>
              <button 
                onClick={() => { setActiveTab('users'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 w-full p-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'users' ? 'bg-[#EFF6FF] text-[#136AA8] border-l-4 border-[#136AA8]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}
              >
                <Users size={16} /> {t('users')}
              </button>
              <button 
                onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 w-full p-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'settings' ? 'bg-[#EFF6FF] text-[#136AA8] border-l-4 border-[#136AA8]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}
              >
                <Settings size={16} /> {t('settings')}
              </button>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100 bg-[#F7F9FC]/50 space-y-2">
          <div className="flex items-center gap-2 justify-between px-2 mb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Langue / اللغة</span>
            <button 
              onClick={() => {
                const newLang = i18n.language === 'fr' ? 'ar' : 'fr';
                i18n.changeLanguage(newLang);
                document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
              }}
              className="text-xs font-bold text-[#136AA8] bg-blue-50 px-2 py-1 rounded-md"
            >
              {i18n.language === 'fr' ? 'AR' : 'FR'}
            </button>
          </div>
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-[#009CDA] font-bold border border-blue-200">
              {user?.displayName?.[0] || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-900 truncate">{user?.displayName}</p>
              <p className="text-[9px] text-[#009CDA] uppercase font-black tracking-tighter">{role}</p>
            </div>
          </div>
          <button onClick={() => auth.signOut()} className="flex items-center gap-3 w-full p-2.5 text-red-500 hover:bg-red-50 rounded-lg transition-all font-bold text-[11px] uppercase tracking-wide">
            <LogOut size={14} /> {t('logout')}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-[58px] bg-[#136AA8] px-4 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-lg">
          <div className="flex items-center gap-4 flex-1 max-w-lg">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden text-white/70 hover:text-white p-1"
            >
              <Menu size={24} />
            </button>
            <div className="relative w-full hidden sm:block">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input 
                type="text" 
                placeholder="Rechercher BC, Fournisseurs..." 
                className="bg-white/10 border-white/20 focus:bg-white/20 text-white placeholder-white/30 text-xs w-full py-2 pl-9 pr-4 rounded-lg outline-none border transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 lg:gap-3 ml-2 lg:ml-0">
            {['admin', 'superadmin', 'buyer', 'buyer_intl'].includes(role || '') && (
              <button 
                onClick={() => setIsSupplierModalOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md font-bold text-[11px] transition-all border border-white/10 uppercase tracking-wide"
              >
                <Users size={14} />
                Nouveau Fournisseur
              </button>
            )}
            {role !== 'magasinier' && (
              <button onClick={() => {
                const worksheet = XLSX.utils.json_to_sheet(pos);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "PurchaseOrders");
                XLSX.writeFile(workbook, "Rapport_Commandes.xlsx");
              }} className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md font-bold text-[11px] transition-all border border-white/10 uppercase tracking-wide">
                <FileSpreadsheet size={14} />
                Exporter
              </button>
            )}
            {['admin', 'superadmin', 'buyer', 'buyer_intl'].includes(role || '') && (
              <button onClick={() => setIsModalOpen(true)} className="bg-[#3B82F6] hover:bg-[#009CDA] text-white px-3 lg:px-4 py-1.5 rounded-md font-bold flex items-center justify-center text-[10px] lg:text-[11px] transition-all shadow-md uppercase tracking-wide whitespace-nowrap">
                <Plus size={14} className="sm:hidden" />
                <span className="hidden sm:inline">Nouveau Bon de Commande</span>
              </button>
            )}
          </div>
        </header>

        <div className="p-4 sm:p-8 flex-1 overflow-y-auto w-full">
          <ErrorBoundary>
            <Suspense fallback={
              <div className="flex flex-col items-center justify-center p-24 h-full">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Chargement...</p>
              </div>
            }>
              <AnimatePresence mode="wait">
                {activeTab === 'dashboard' && (
              <motion.div key="dash" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-[#136AA8] tracking-tight">Tableau de Bord</h2>
                    <p className="text-sm text-gray-500 font-medium">Surveillance des opérations d'achat locale</p>
                  </div>
                  {['admin', 'superadmin'].includes(role || '') && (
                    <div className="flex items-center gap-2">
                       <span className="text-sm font-bold text-gray-500">Unité:</span>
                       <select 
                         value={dashboardUnitId}
                         onChange={(e) => setDashboardUnitId(e.target.value)}
                         className="bg-white border outline-none border-gray-200 text-[#136AA8] text-sm rounded-lg block w-48 p-2 font-bold"
                       >
                         <option value="all">Toutes les unités</option>
                         <option value="HQ">Siège Principal (HQ)</option>
                         {tenantUnits.map(u => (
                           <option key={u.id} value={u.id}>{u.name}</option>
                         ))}
                       </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {stats.map((s, i) => (
                    <div key={i} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-5 translate-y-0 hover:-translate-y-1 transition-all duration-300">
                      <div className={`w-14 h-14 rounded-2xl bg-${s.color}-50 text-${s.color}-600 flex items-center justify-center border border-${s.color}-100`}>
                        <s.icon size={26} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">{s.label}</p>
                        <p className="text-xl font-bold text-[#136AA8] font-mono tracking-tighter">{s.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="text-xs font-black text-gray-400 tracking-[0.2em] uppercase">Commandes Récentes</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 bg-white rounded-full px-1 py-1 border border-gray-200">
                        <input
                          type="date"
                          value={dateStart}
                          onChange={(e) => setDateStart(e.target.value)}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold text-gray-500 bg-transparent outline-none focus:text-[#136AA8]"
                        />
                        <span className="text-gray-300 font-bold block">-</span>
                        <input
                          type="date"
                          value={dateEnd}
                          onChange={(e) => setDateEnd(e.target.value)}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold text-gray-500 bg-transparent outline-none focus:text-[#136AA8]"
                        />
                      </div>
                      <div className="w-px h-6 bg-gray-200 mx-1 hidden md:block"></div>
                      <div className="flex flex-wrap gap-2">
                        {['all', 'draft', 'pending_approval', 'approved', 'sent', 'confirmed', 'delivered', 'closed'].map((status) => (
                        <button
                          key={status}
                          onClick={() => setFilterStatus(status)}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${
                            filterStatus === status 
                              ? 'bg-[#136AA8] text-white border-[#136AA8] shadow-md shadow-blue-100' 
                              : 'bg-white text-gray-400 border-gray-100 hover:border-blue-200 hover:text-[#009CDA]'
                          }`}
                        >
                          {status === 'all' ? 'Tous' : getStatusLabel(status)}
                        </button>
                      ))}
                      </div>
                    </div>
                  </div>
                  
                  {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#009CDA]" /></div>
                  ) : filteredPos.length === 0 ? (
                    <div className="bg-white rounded-2xl p-20 text-center border border-gray-200 shadow-sm">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                        <Package size={28} className="text-gray-300" />
                      </div>
                      <h3 className="text-lg font-bold text-[#136AA8] mb-1">Aucune commande active</h3>
                      <p className="text-gray-400 text-sm max-w-xs mx-auto">Lancez votre flux d'approvisionnement en créant un nouveau bon de commande.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {filteredPos
                        .filter(p => {
                          const matchesSearch = (p.poNumber||'').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                              (p.supplierName||'').toLowerCase().includes(searchTerm.toLowerCase());
                          const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
                          const pDate = new Date(p.createdAt);
                          const matchesDateStart = !dateStart || pDate >= new Date(dateStart);
                          const matchesDateEnd = !dateEnd || pDate <= new Date(dateEnd + 'T23:59:59');
                          return matchesSearch && matchesStatus && matchesDateStart && matchesDateEnd;
                        })
                        .map(p => (
                        <div 
                          key={p.id} 
                          onClick={() => navigate(`/purchase/${p.id}`)}
                          className="bg-white rounded-[14px] border border-gray-200 shadow-sm hover:shadow-lg transition-all cursor-pointer group flex flex-col h-full"
                        >
                          <div className="p-6 flex-1">
                            <div className="flex justify-between items-start mb-4">
                              <span className="text-[10px] font-mono font-bold bg-gray-50 px-2 py-1 rounded text-gray-500 border border-gray-100 tracking-tighter">{p.poNumber}</span>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${getStatusStyle(p.status)}`}>{getStatusLabel(p.status)}</span>
                            </div>
                            <h3 className="text-[15px] font-bold text-[#136AA8] mb-2 truncate group-hover:text-[#009CDA] transition-colors uppercase">{p.supplierName}</h3>
                            <div className="flex items-center gap-2 mb-4">
                              <div className="w-5 h-5 rounded-md bg-blue-50 flex items-center justify-center text-[10px] font-bold text-[#009CDA]">{p.buyerName?.[0]}</div>
                              <span className="text-[11px] font-medium text-gray-500 tracking-tight">{p.buyerName}</span>
                            </div>
                          </div>
                          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between rounded-b-[14px]">
                            <div>
                              <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest leading-none mb-1">Montant Total</p>
                              <p className="text-lg font-black text-[#136AA8] font-mono leading-none tracking-tighter">{p.totalAmount?.toLocaleString()} <span className="text-[10px] text-gray-400">DZD</span></p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1 justify-end"><Clock size={10} /> {new Date(p.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'da' && <motion.div key="da" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}><InternalRequests onConvertToPO={handleConvertDAToPO} onConvertToIntlPO={handleConvertDAToIntlPO} /></motion.div>}
            {activeTab === 'intl_purchases' && <motion.div key="intl_purchases" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}><IntlPurchases /></motion.div>}
            {activeTab === 'archive' && <motion.div key="archive" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}><Archive /></motion.div>}
            {activeTab === 'user_guide' && <motion.div key="user_guide" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}><UserGuide /></motion.div>}
            {activeTab === 'cash' && <motion.div key="cash" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}><CashRequests /></motion.div>}
            {activeTab === 'transfers' && <motion.div key="transfers" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}><Transfers /></motion.div>}
            {activeTab === 'suppliers' && <motion.div key="suppliers" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}><Suppliers /></motion.div>}
            {activeTab === 'products' && <motion.div key="products" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}><Products /></motion.div>}
            {activeTab === 'raw_materials' && <motion.div key="raw_materials" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}><RawMaterials /></motion.div>}
            {activeTab === 'boms' && <motion.div key="boms" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}><BOMs /></motion.div>}
            {activeTab === 'production_orders' && <motion.div key="production_orders" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}><ProductionOrders /></motion.div>}
            {activeTab === 'analytics' && <motion.div key="analytics" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}><Analytics /></motion.div>}
            {activeTab === 'history' && <motion.div key="history" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}><ActivityLog /></motion.div>}
                {activeTab === 'users' && ['admin', 'superadmin'].includes(role || '') && <motion.div key="users" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}><UsersComponent /></motion.div>}
                {activeTab === 'settings' && ['admin', 'superadmin'].includes(role || '') && <motion.div key="settings" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}><SettingsComponent /></motion.div>}
                {activeTab === 'exports' && ['admin', 'superadmin', 'export'].includes(role || '') && <motion.div key="exports" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}><Exports /></motion.div>}
              </AnimatePresence>
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      <CreatePOModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setInitialPOData(null); }} initialData={initialPOData} />
      <AddSupplierModal isOpen={isSupplierModalOpen} onClose={() => setIsSupplierModalOpen(false)} />
    </div>
  );
}
