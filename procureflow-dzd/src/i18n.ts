import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  fr: {
    translation: {
      "dashboard": "Tableau de Bord",
      "da": "Demandes d'Achat",
      "intl_purchases": "Achats Internationaux",
      "ppi": "Programme PPI",
      "suppliers": "Fournisseurs & Tiers",
      "products": "Catalogue des Articles",
      "raw_materials": "Matières Premières",
      "boms": "Nomenclatures (BOM)",
      "production_orders": "Ordres de Production",
      "cash_requests": "Bon de Caisse (بيان صرف)",
      "transfers": "Transferts et Stocks",
      "analytics": "Analyses & Rapports",
      "history": "Journal d'Activité",
      "archive": "Archives D10",
      "users": "Utilisateurs & Rôles",
      "settings": "Paramètres Société",
      "user_guide": "Guide Utilisateur",
      "exports": "Factures Export",
      "communications": "Emails & Suivi DHL Banque",
      "logout": "Déconnexion",
      "sys_name": "Système de Gestion d'Entrepôt et des Achats",
      "new_po": "Nouveau Bon de Commande",
      "new_supplier": "Nouveau Fournisseur",
      "search_placeholder": "Rechercher par N° BC, Référence, Fournisseur...",
      "local_purchases": "Achats Locaux",
      "intl_imports": "Achats Internationaux (Import)",
      "total_pos": "Bons de Commande (Total)",
      "pending_delivery": "En Attente de Livraison",
      "stock_alerts": "Alertes Ruptures & Min.",
      "total_spend": "Total Engagements (TTC)",
      "language": "Langue"
    }
  },
  en: {
    translation: {
      "dashboard": "Dashboard",
      "da": "Purchase Requests (PR)",
      "intl_purchases": "International Purchases",
      "ppi": "PPI Program",
      "suppliers": "Suppliers & Vendors",
      "products": "Item Catalog",
      "raw_materials": "Raw Materials",
      "boms": "Bills of Materials (BOM)",
      "production_orders": "Production Orders",
      "cash_requests": "Petty Cash Requests",
      "transfers": "Transfers & Stock Movements",
      "analytics": "Analytics & Reports",
      "history": "Activity Audit Log",
      "archive": "Customs D10 Archives",
      "users": "Users & Permissions",
      "settings": "Company Settings",
      "user_guide": "User Guide",
      "exports": "Export Invoices",
      "communications": "Emails & DHL Bank Files",
      "logout": "Sign Out",
      "sys_name": "Warehouse & Procurement Management System",
      "new_po": "New Purchase Order",
      "new_supplier": "New Supplier",
      "search_placeholder": "Search by PO #, Reference, Supplier...",
      "local_purchases": "Domestic Purchases",
      "intl_imports": "International Purchases (Import)",
      "total_pos": "Total Purchase Orders",
      "pending_delivery": "Awaiting Delivery",
      "stock_alerts": "Low Stock Alerts",
      "total_spend": "Total Commitments (Tax Inc.)",
      "language": "Language"
    }
  },
  ar: {
    translation: {
      "dashboard": "لوحة القيادة",
      "da": "طلبات الشراء الداخلي",
      "intl_purchases": "المشتريات الدولية (استيراد)",
      "ppi": "برنامج PPI",
      "suppliers": "الموردين والشركاء",
      "products": "كتالوج المنتجات والمواد",
      "raw_materials": "المواد الأولية",
      "boms": "شجرة المواد (BOM)",
      "production_orders": "أوامر الإنتاج والتصنيع",
      "cash_requests": "بيان صرف نقدية",
      "transfers": "التحويلات والمخزون",
      "analytics": "التحليلات والتقارير",
      "history": "سجل النشاطات",
      "archive": "أرشيف الجمارك D10",
      "users": "المستخدمين والصلاحيات",
      "settings": "إعدادات الشركة",
      "user_guide": "دليل المستخدم",
      "exports": "فواتير التصدير",
      "communications": "البريد وإرساليات البنك DHL",
      "logout": "تسجيل الخروج",
      "sys_name": "نظام إدارة المستودعات والمشتريات",
      "new_po": "أمر شراء جديد",
      "new_supplier": "مورد جديد",
      "search_placeholder": "بحث برقم الطلب، المورد، المادة...",
      "local_purchases": "المشتريات المحلية",
      "intl_imports": "المشتريات الدولية",
      "total_pos": "إجمالي أوامر الشراء",
      "pending_delivery": "في انتظار الاستلام",
      "stock_alerts": "تنبيهات انخفاض المخزون",
      "total_spend": "إجمالي الالتزامات المالية",
      "language": "اللغة"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "fr", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
