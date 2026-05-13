import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  fr: {
    translation: {
      "dashboard": "Tableau de Bord",
      "da": "Demandes d'Achat",
      "cash_requests": "Bon de Caisse (بيان صرف)",
      "transfers": "Transferts et Mouvements",
      "suppliers": "Fournisseurs",
      "products": "Catalogue des Articles",
      "analytics": "Analytics",
      "history": "Historique",
      "archive": "Archives",
      "users": "Utilisateurs",
      "settings": "Paramètres",
      "logout": "Déconnexion",
      "sys_name": "Système de Gestion d'Entrepôt et des Achats"
    }
  },
  ar: {
    translation: {
      "dashboard": "لوحة القيادة",
      "da": "طلبات الشراء",
      "cash_requests": "بيان صرف",
      "transfers": "التحويلات والحركات",
      "suppliers": "الموردين",
      "products": "كتالوج العناصر",
      "analytics": "التحليلات",
      "history": "السجل",
      "archive": "الأرشيف",
      "users": "المستخدمين",
      "settings": "الإعدادات",
      "logout": "تسجيل الخروج",
      "sys_name": "نظام إدارة المستودعات والمشتريات"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "fr", // default language
    fallbackLng: "fr",
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
