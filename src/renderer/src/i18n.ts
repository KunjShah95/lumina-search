import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

const resources = {
  en: {
    translation: {
      // App
      appName: 'Perplexity Local',
      
      // Search
      search: {
        placeholder: 'Search anything...',
        searching: 'Searching...',
        noResults: 'No results found',
        results: '{{count}} results',
      },
      
      // Settings
      settings: {
        title: 'Settings',
        general: 'General',
        appearance: 'Appearance',
        providers: 'Providers',
        about: 'About',
        language: 'Language',
        theme: 'Theme',
        themeLight: 'Light',
        themeDark: 'Dark',
        themeSystem: 'System',
        themeAmoled: 'AMOLED',
      },
      
      // Knowledge Base
      knowledgeBase: {
        title: 'Knowledge Base',
        create: 'Create Knowledge Base',
        empty: 'No knowledge bases yet',
        documents: '{{count}} documents',
      },
      
      // Common
      common: {
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        close: 'Close',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        confirm: 'Confirm',
      },
      
      // Actions
      actions: {
        newSearch: 'New Search',
        openSettings: 'Open Settings',
        toggleTheme: 'Toggle Theme',
        focusSearch: 'Focus Search',
      },
      
      // Errors
      errors: {
        generic: 'Something went wrong',
        network: 'Network error',
        notFound: 'Not found',
      },
    },
  },
  es: {
    translation: {
      appName: 'Perplexity Local',
      search: {
        placeholder: 'Buscar cualquier cosa...',
        searching: 'Buscando...',
        noResults: 'No se encontraron resultados',
        results: '{{count}} resultados',
      },
      settings: {
        title: 'Configuración',
        general: 'General',
        appearance: 'Apariencia',
        providers: 'Proveedores',
        about: 'Acerca de',
        language: 'Idioma',
        theme: 'Tema',
        themeLight: 'Claro',
        themeDark: 'Oscuro',
        themeSystem: 'Sistema',
        themeAmoled: 'AMOLED',
      },
      knowledgeBase: {
        title: 'Base de Conocimiento',
        create: 'Crear Base de Conocimiento',
        empty: 'Sin bases de conocimiento aún',
        documents: '{{count}} documentos',
      },
      common: {
        save: 'Guardar',
        cancel: 'Cancelar',
        delete: 'Eliminar',
        edit: 'Editar',
        close: 'Cerrar',
        loading: 'Cargando...',
        error: 'Error',
        success: 'Éxito',
        confirm: 'Confirmar',
      },
      actions: {
        newSearch: 'Nueva Búsqueda',
        openSettings: 'Abrir Configuración',
        toggleTheme: 'Cambiar Tema',
        focusSearch: 'Enfocar Búsqueda',
      },
      errors: {
        generic: 'Algo salió mal',
        network: 'Error de red',
        notFound: 'No encontrado',
      },
    },
  },
  fr: {
    translation: {
      appName: 'Perplexity Local',
      search: {
        placeholder: 'Rechercher n\'importe quoi...',
        searching: 'Recherche en cours...',
        noResults: 'Aucun résultat trouvé',
        results: '{{count}} résultats',
      },
      settings: {
        title: 'Paramètres',
        general: 'Général',
        appearance: 'Apparence',
        providers: 'Fournisseurs',
        about: 'À propos',
        language: 'Langue',
        theme: 'Thème',
        themeLight: 'Clair',
        themeDark: 'Sombre',
        themeSystem: 'Système',
        themeAmoled: 'AMOLED',
      },
      knowledgeBase: {
        title: 'Base de Connaissances',
        create: 'Créer une Base',
        empty: 'Pas encore de bases de connaissances',
        documents: '{{count}} documents',
      },
      common: {
        save: 'Enregistrer',
        cancel: 'Annuler',
        delete: 'Supprimer',
        edit: 'Modifier',
        close: 'Fermer',
        loading: 'Chargement...',
        error: 'Erreur',
        success: 'Succès',
        confirm: 'Confirmer',
      },
      actions: {
        newSearch: 'Nouvelle Recherche',
        openSettings: 'Ouvrir Paramètres',
        toggleTheme: 'Changer le Thème',
        focusSearch: 'Focus Recherche',
      },
      errors: {
        generic: 'Quelque chose s\'est mal passé',
        network: 'Erreur réseau',
        notFound: 'Non trouvé',
      },
    },
  },
  de: {
    translation: {
      appName: 'Perplexity Local',
      search: {
        placeholder: 'Alles suchen...',
        searching: 'Suche läuft...',
        noResults: 'Keine Ergebnisse gefunden',
        results: '{{count}} Ergebnisse',
      },
      settings: {
        title: 'Einstellungen',
        general: 'Allgemein',
        appearance: 'Erscheinung',
        providers: 'Anbieter',
        about: 'Über',
        language: 'Sprache',
        theme: 'Thema',
        themeLight: 'Hell',
        themeDark: 'Dunkel',
        themeSystem: 'System',
        themeAmoled: 'AMOLED',
      },
      knowledgeBase: {
        title: 'Wissensbasis',
        create: 'Wissensbasis erstellen',
        empty: 'Noch keine Wissensbasen',
        documents: '{{count}} Dokumente',
      },
      common: {
        save: 'Speichern',
        cancel: 'Abbrechen',
        delete: 'Löschen',
        edit: 'Bearbeiten',
        close: 'Schließen',
        loading: 'Laden...',
        error: 'Fehler',
        success: 'Erfolg',
        confirm: 'Bestätigen',
      },
      actions: {
        newSearch: 'Neue Suche',
        openSettings: 'Einstellungen öffnen',
        toggleTheme: 'Thema wechseln',
        focusSearch: 'Suche fokussieren',
      },
      errors: {
        generic: 'Etwas ist schief gelaufen',
        network: 'Netzwerkfehler',
        notFound: 'Nicht gefunden',
      },
    },
  },
  zh: {
    translation: {
      appName: 'Perplexity Local',
      search: {
        placeholder: '搜索任何内容...',
        searching: '搜索中...',
        noResults: '未找到结果',
        results: '{{count}} 个结果',
      },
      settings: {
        title: '设置',
        general: '通用',
        appearance: '外观',
        providers: '提供商',
        about: '关于',
        language: '语言',
        theme: '主题',
        themeLight: '浅色',
        themeDark: '深色',
        themeSystem: '跟随系统',
        themeAmoled: 'AMOLED',
      },
      knowledgeBase: {
        title: '知识库',
        create: '创建知识库',
        empty: '暂无知识库',
        documents: '{{count}} 个文档',
      },
      common: {
        save: '保存',
        cancel: '取消',
        delete: '删除',
        edit: '编辑',
        close: '关闭',
        loading: '加载中...',
        error: '错误',
        success: '成功',
        confirm: '确认',
      },
      actions: {
        newSearch: '新建搜索',
        openSettings: '打开设置',
        toggleTheme: '切换主题',
        focusSearch: '聚焦搜索',
      },
      errors: {
        generic: '出现问题',
        network: '网络错误',
        notFound: '未找到',
      },
    },
  },
  ja: {
    translation: {
      appName: 'Perplexity Local',
      search: {
        placeholder: '何かを検索...',
        searching: '検索中...',
        noResults: '結果が見つかりません',
        results: '{{count}} 件の結果',
      },
      settings: {
        title: '設定',
        general: '一般',
        appearance: '外観',
        providers: 'プロバイダー',
        about: '概要',
        language: '言語',
        theme: 'テーマ',
        themeLight: 'ライト',
        themeDark: 'ダーク',
        themeSystem: 'システム',
        themeAmoled: 'AMOLED',
      },
      knowledgeBase: {
        title: 'ナレッジベース',
        create: 'ナレッジベースを作成',
        empty: 'ナレッジベースはまだありません',
        documents: '{{count}} 件のドキュメント',
      },
      common: {
        save: '保存',
        cancel: 'キャンセル',
        delete: '削除',
        edit: '編集',
        close: '閉じる',
        loading: '読み込み中...',
        error: 'エラー',
        success: '成功',
        confirm: '確認',
      },
      actions: {
        newSearch: '新規検索',
        openSettings: '設定を開く',
        toggleTheme: 'テーマを切り替え',
        focusSearch: '検索にフォーカス',
      },
      errors: {
        generic: '問題が発生しました',
        network: 'ネットワークエラー',
        notFound: '見つかりません',
      },
    },
  },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

export default i18n

export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
]
