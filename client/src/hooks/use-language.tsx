import React, { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { translateBookData } from "@/lib/translate";
import { Book } from "@shared/schema";

// Supported languages
export type Language = "en" | "es" | "fr" | "de" | "zh";

// Translations object structure
type Translations = {
  [key in Language]: {
    [key: string]: string;
  };
};

// Language change callback type
export type LanguageChangeCallback = (newLanguage: Language, oldLanguage: Language) => void;

// Default translations
const translations: Translations = {
  en: {
    appName: "LibraryLens AI",
    bookAnalysis: "Book Analysis",
    bookArchive: "Book Archive",
    batchProcessing: "Batch Processing",
    settings: "Settings",
    recentBooks: "Recent Books",
    uploadCover: "Upload Book Cover",
    uploadFile: "Upload a file",
    dragDrop: "or drag and drop",
    enterDetails: "Or enter book details manually",
    title: "Title",
    author: "Author",
    isbn: "ISBN",
    analyzeBook: "Analyze Book",
    analysisOptions: "Analysis Options",
    generateSummary: "Generate Summary",
    summaryDesc: "Creates a concise summary of the book's content",
    identifyGenres: "Identify Genres",
    genresDesc: "Detects primary and secondary genres",
    extractThemes: "Extract Themes",
    themesDesc: "Identifies major themes and motifs",
    assessReadingLevel: "Assess Reading Level",
    readingLevelDesc: "Determines appropriate age/grade level",
    generateCatalog: "Generate Catalog Entry",
    catalogDesc: "Creates a formatted catalog entry",
    results: "Book Analysis Results",
    insights: "AI-powered insights and classification",
    complete: "Complete",
    processing: "Processing",
    publisher: "Publisher",
    published: "Published",
    pages: "Pages",
    edition: "Edition",
    dimensions: "Dimensions",
    binding: "Binding",
    location: "Publication Location",
    contributors: "Contributors",
    illustrator: "Illustrator",
    genres: "Genres",
    themes: "Themes",
    readingLevel: "Reading Level",
    aiSummary: "AI-Generated Summary",
    majorThemes: "Major Themes",
    catalogEntry: "Library Catalog Entry",
    similarBooks: "Similar Books",
    exportResults: "Export Results",
    exportToPDF: "Export to PDF",
    saveToArchive: "Save to Archive",
    searching: "Searching...",
    noResults: "No results found",
    error: "An error occurred",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    edit: "Edit",
    confirm: "Confirm",
    confirmDelete: "Yes, Delete All Books",
    search: "Search",
    clear: "Clear",
    close: "Close",
    view: "View",
    loading: "Loading...",
    translating: "Translating...",
    translationComplete: "Translation complete",
    // Filter-related translations
    filters: "Filters",
    selectAuthors: "Select authors",
    selectGenres: "Select genres",
    selectThemes: "Select themes",
    clearFilters: "Clear all filters",
    clearAllBooks: "Clear All Analyzed Books",
    selected: "selected",
    bookCount: "book",
    booksCount: "books",
    found: "found",
    with: "with",
    authorFilter: "Author:",
    genreFilter: "Genre:",
    themeFilter: "Theme:",
    noFilterResults: "No books match your filter criteria",
    noBooks: "No books have been analyzed yet",
    ageRange: "Age Range",
    gradeLevel: "Grade Level",
    complexity: "Complexity",
    lexileMeasure: "Lexile Measure",
    bookNotFound: "Book not found",
    areYouSure: "Are you sure?",
    selectAll: "Select All",
    deselectAll: "Deselect All",
    booksSelected: "books selected",
    exportSelected: "Export Selected",
    exportSelectedTooltip: "Export selected books to a single PDF catalog",
    noBookSelected: "No books selected",
    pleaseSelectBooks: "Please select at least one book to export",
    exportSuccess: "Export successful",
    booksExportedToPDF: "Selected books have been exported to PDF",
    exportFailed: "Export failed",
    errorGeneratingPDF: "An error occurred while generating the PDF",
    deleteAllBooksWarning: "This action will permanently delete ALL books from your library. This cannot be undone.",
    // Authentication related translations
    login: "Login",
    register: "Register", 
    username: "Username",
    password: "Password",
    createAccount: "Create Account",
    signIn: "Sign In",
    signOut: "Sign Out",
    authRequired: "Authentication Required",
    librarian: "Librarian",
    general: "General",
    analysis: "Analysis",
    language: "Language",
    generalSettingsDescription: "Manage your application preferences and appearance",
    apiSettingsDescription: "Configure API keys and external service connections",
    analysisSettingsDescription: "Configure default analysis options and behavior",
  },
  es: {
    appName: "LibraryLens AI",
    bookAnalysis: "Análisis de Libros",
    bookArchive: "Archivo de Libros",
    batchProcessing: "Procesamiento por Lotes",
    settings: "Configuración",
    recentBooks: "Libros Recientes",
    uploadCover: "Subir Portada del Libro",
    uploadFile: "Subir un archivo",
    dragDrop: "o arrastrar y soltar",
    enterDetails: "O ingrese los detalles del libro manualmente",
    title: "Título",
    author: "Autor",
    isbn: "ISBN",
    analyzeBook: "Analizar Libro",
    analysisOptions: "Opciones de Análisis",
    generateSummary: "Generar Resumen",
    summaryDesc: "Crea un resumen conciso del contenido del libro",
    identifyGenres: "Identificar Géneros",
    genresDesc: "Detecta géneros primarios y secundarios",
    extractThemes: "Extraer Temas",
    themesDesc: "Identifica temas y motivos principales",
    assessReadingLevel: "Evaluar Nivel de Lectura",
    readingLevelDesc: "Determina el nivel de edad/grado apropiado",
    generateCatalog: "Generar Entrada de Catálogo",
    catalogDesc: "Crea una entrada de catálogo formateada",
    results: "Resultados del Análisis del Libro",
    insights: "Información y clasificación con IA",
    complete: "Completo",
    processing: "Procesando",
    publisher: "Editorial",
    published: "Publicado",
    pages: "Páginas",
    genres: "Géneros",
    readingLevel: "Nivel de Lectura",
    aiSummary: "Resumen Generado por IA",
    majorThemes: "Temas Principales",
    catalogEntry: "Entrada de Catálogo de Biblioteca",
    similarBooks: "Libros Similares",
    exportResults: "Exportar Resultados",
    exportToPDF: "Exportar a PDF",
    saveToArchive: "Guardar en Archivo",
    searching: "Buscando...",
    noResults: "No se encontraron resultados",
    error: "Ocurrió un error",
    cancel: "Cancelar",
    save: "Guardar",
    delete: "Eliminar",
    edit: "Editar",
    confirm: "Confirmar",
    search: "Buscar",
    clear: "Limpiar",
    loading: "Cargando...",
    translating: "Traduciendo...",
    translationComplete: "Traducción completa",
  },
  fr: {
    appName: "LibraryLens AI",
    bookAnalysis: "Analyse de Livres",
    bookArchive: "Archives de Livres",
    batchProcessing: "Traitement par Lots",
    settings: "Paramètres",
    recentBooks: "Livres Récents",
    uploadCover: "Télécharger la Couverture",
    uploadFile: "Télécharger un fichier",
    dragDrop: "ou glisser-déposer",
    enterDetails: "Ou entrez les détails du livre manuellement",
    title: "Titre",
    author: "Auteur",
    isbn: "ISBN",
    analyzeBook: "Analyser le Livre",
    analysisOptions: "Options d'Analyse",
    generateSummary: "Générer un Résumé",
    summaryDesc: "Crée un résumé concis du contenu du livre",
    identifyGenres: "Identifier les Genres",
    genresDesc: "Détecte les genres primaires et secondaires",
    extractThemes: "Extraire les Thèmes",
    themesDesc: "Identifie les thèmes et motifs majeurs",
    assessReadingLevel: "Évaluer le Niveau de Lecture",
    readingLevelDesc: "Détermine le niveau d'âge/grade approprié",
    generateCatalog: "Générer une Entrée de Catalogue",
    catalogDesc: "Crée une entrée de catalogue formatée",
    results: "Résultats de l'Analyse du Livre",
    insights: "Informations et classification par IA",
    complete: "Terminé",
    processing: "En traitement",
    publisher: "Éditeur",
    published: "Publié",
    pages: "Pages",
    genres: "Genres",
    readingLevel: "Niveau de Lecture",
    aiSummary: "Résumé Généré par IA",
    majorThemes: "Thèmes Principaux",
    catalogEntry: "Entrée de Catalogue de Bibliothèque",
    similarBooks: "Livres Similaires",
    exportResults: "Exporter les Résultats",
    exportToPDF: "Exporter en PDF",
    saveToArchive: "Enregistrer dans les Archives",
    searching: "Recherche en cours...",
    noResults: "Aucun résultat trouvé",
    error: "Une erreur est survenue",
    cancel: "Annuler",
    save: "Enregistrer",
    delete: "Supprimer",
    edit: "Modifier",
    confirm: "Confirmer",
    search: "Rechercher",
    clear: "Effacer",
    loading: "Chargement...",
    translating: "Traduction en cours...",
    translationComplete: "Traduction terminée",
  },
  de: {
    appName: "LibraryLens AI",
    bookAnalysis: "Buchanalyse",
    bookArchive: "Bucharchiv",
    batchProcessing: "Stapelverarbeitung",
    settings: "Einstellungen",
    recentBooks: "Neueste Bücher",
    uploadCover: "Buchcover hochladen",
    uploadFile: "Datei hochladen",
    dragDrop: "oder ziehen und ablegen",
    enterDetails: "Oder geben Sie die Buchdetails manuell ein",
    title: "Titel",
    author: "Autor",
    isbn: "ISBN",
    analyzeBook: "Buch analysieren",
    analysisOptions: "Analyseoptionen",
    generateSummary: "Zusammenfassung erstellen",
    summaryDesc: "Erstellt eine prägnante Zusammenfassung des Buchinhalts",
    identifyGenres: "Genres identifizieren",
    genresDesc: "Erkennt primäre und sekundäre Genres",
    extractThemes: "Themen extrahieren",
    themesDesc: "Identifiziert Hauptthemen und Motive",
    assessReadingLevel: "Leseniveau bewerten",
    readingLevelDesc: "Bestimmt das angemessene Alters-/Klassenniveau",
    generateCatalog: "Katalogeintrag erstellen",
    catalogDesc: "Erstellt einen formatierten Katalogeintrag",
    results: "Buchanalyse-Ergebnisse",
    insights: "KI-gestützte Erkenntnisse und Klassifizierung",
    complete: "Abgeschlossen",
    processing: "Verarbeitung",
    publisher: "Verlag",
    published: "Veröffentlicht",
    pages: "Seiten",
    edition: "Ausgabe",
    dimensions: "Abmessungen",
    binding: "Einband",
    location: "Erscheinungsort",
    contributors: "Mitwirkende",
    illustrator: "Illustrator",
    genres: "Genres",
    readingLevel: "Leseniveau",
    aiSummary: "KI-generierte Zusammenfassung",
    majorThemes: "Hauptthemen",
    catalogEntry: "Bibliothekskatalog-Eintrag",
    similarBooks: "Ähnliche Bücher",
    exportResults: "Ergebnisse exportieren",
    exportToPDF: "Als PDF exportieren",
    saveToArchive: "Im Archiv speichern",
    searching: "Suche...",
    noResults: "Keine Ergebnisse gefunden",
    error: "Ein Fehler ist aufgetreten",
    cancel: "Abbrechen",
    save: "Speichern",
    delete: "Löschen",
    edit: "Bearbeiten",
    confirm: "Bestätigen",
    confirmDelete: "Ja, alle Bücher löschen",
    search: "Suchen",
    clear: "Löschen",
    close: "Schließen",
    view: "Ansehen",
    loading: "Laden...",
    translating: "Übersetze...",
    translationComplete: "Übersetzung abgeschlossen",
    filters: "Filter",
    selectAuthors: "Autoren auswählen",
    selectGenres: "Genres auswählen",
    selectThemes: "Themen auswählen",
    clearFilters: "Alle Filter löschen",
    clearAllBooks: "Alle analysierten Bücher löschen",
    selected: "ausgewählt",
    bookCount: "Buch",
    booksCount: "Bücher",
    found: "gefunden",
    with: "mit",
    authorFilter: "Autor:",
    genreFilter: "Genre:",
    themeFilter: "Thema:",
    noFilterResults: "Keine Bücher entsprechen Ihren Filterkriterien",
    noBooks: "Es wurden noch keine Bücher analysiert",
    ageRange: "Altersbereich",
    gradeLevel: "Klassenstufe",
    complexity: "Komplexität",
    lexileMeasure: "Lexile-Maß",
    bookNotFound: "Buch nicht gefunden",
    areYouSure: "Sind Sie sicher?",
    selectAll: "Alle auswählen",
    deselectAll: "Alle abwählen",
    booksSelected: "Bücher ausgewählt",
    exportSelected: "Ausgewählte exportieren",
    exportSelectedTooltip: "Ausgewählte Bücher in einem einzigen PDF-Katalog exportieren",
    noBookSelected: "Keine Bücher ausgewählt",
    pleaseSelectBooks: "Bitte wählen Sie mindestens ein Buch zum Exportieren aus",
    exportSuccess: "Export erfolgreich",
    booksExportedToPDF: "Ausgewählte Bücher wurden als PDF exportiert",
    exportFailed: "Export fehlgeschlagen",
    errorGeneratingPDF: "Beim Generieren des PDFs ist ein Fehler aufgetreten",
    deleteAllBooksWarning: "Diese Aktion löscht ALLE Bücher dauerhaft aus Ihrer Bibliothek. Dies kann nicht rückgängig gemacht werden.",
    generalSettingsDescription: "Verwalten Sie Ihre Anwendungseinstellungen und Darstellung",
    apiSettingsDescription: "API-Schlüssel und externe Dienstverbindungen konfigurieren",
    analysisSettingsDescription: "Konfigurieren Sie die Standardanalyseoptionen und das Verhalten",
    dataManagement: "Datenverwaltung",
    dataManagementDescription: "Verwalten Sie Ihre Anwendungsdaten und löschen Sie den Analyseverlauf",
    defaultAnalysisOptions: "Standard-Analyseoptionen",
    batchProcessingLimit: "Stapelverarbeitungs-Limit",
    batchProcessingLimitDescription: "Maximale Anzahl von Büchern, die in einem einzelnen Stapel verarbeitet werden können",
    selectLimit: "Limit auswählen",
    update: "Aktualisieren",
    noApiKeySet: "Kein API-Schlüssel festgelegt",
    openaiApiKeyDescription: "Der OpenAI API-Schlüssel wird über Umgebungsvariablen konfiguriert",
    googleBooksApiKeyDescription: "Der Google Books API-Schlüssel wird über Umgebungsvariablen konfiguriert",
  },
  zh: {
    appName: "LibraryLens AI",
    bookAnalysis: "图书分析",
    bookArchive: "图书档案",
    batchProcessing: "批量处理",
    settings: "设置",
    recentBooks: "最近的书籍",
    uploadCover: "上传书籍封面",
    uploadFile: "上传文件",
    dragDrop: "或拖放",
    enterDetails: "或手动输入书籍详情",
    title: "标题",
    author: "作者",
    isbn: "ISBN",
    analyzeBook: "分析书籍",
    analysisOptions: "分析选项",
    generateSummary: "生成摘要",
    summaryDesc: "创建书籍内容的简明摘要",
    identifyGenres: "识别类型",
    genresDesc: "检测主要和次要类型",
    extractThemes: "提取主题",
    themesDesc: "识别主要主题和motifs",
    assessReadingLevel: "评估阅读水平",
    readingLevelDesc: "确定适当的年龄/年级水平",
    generateCatalog: "生成目录条目",
    catalogDesc: "创建格式化的目录条目",
    results: "图书分析结果",
    insights: "AI驱动的洞察和分类",
    complete: "完成",
    processing: "处理中",
    publisher: "出版商",
    published: "出版日期",
    pages: "页数",
    genres: "类型",
    readingLevel: "阅读水平",
    aiSummary: "AI生成的摘要",
    majorThemes: "主要主题",
    catalogEntry: "图书馆目录条目",
    similarBooks: "类似书籍",
    exportResults: "导出结果",
    exportToPDF: "导出为PDF",
    saveToArchive: "保存到档案",
    searching: "搜索中...",
    noResults: "未找到结果",
    error: "发生错误",
    cancel: "取消",
    save: "保存",
    delete: "删除",
    edit: "编辑",
    confirm: "确认",
    search: "搜索",
    clear: "清除",
    loading: "加载中...",
    translating: "翻译中...",
    translationComplete: "翻译完成",
  }
};

// Create a context for language
interface LanguageContextType {
  language: Language;
  changeLanguage: (lang: Language) => void;
  t: (key: string) => string;
  translateBook: (book: Partial<Book>) => Promise<Partial<Book>>;
  isTranslating: boolean;
  registerTranslationCallback: (id: string, callback: LanguageChangeCallback) => void;
  unregisterTranslationCallback: (id: string) => void;
}

export const LanguageContext = createContext<LanguageContextType | null>(null);

// Provider component
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("de");
  const [isTranslating, setIsTranslating] = useState(false);
  const [callbacks, setCallbacks] = useState<Record<string, LanguageChangeCallback>>({});
  
  // Function to change the current language
  const changeLanguage = useCallback((lang: Language) => {
    if (lang === language) return; // No change needed
    
    setIsTranslating(true);
    const previousLanguage = language;
    
    setLanguage(lang);
    localStorage.setItem("preferredLanguage", lang);
    
    // Notify all registered callbacks about the language change
    Object.values(callbacks).forEach(callback => {
      callback(lang, previousLanguage);
    });
    
    // Set translating to false after a short delay
    setTimeout(() => {
      setIsTranslating(false);
    }, 300);
  }, [language, callbacks]);
  
  // Translation function
  const t = useCallback((key: string): string => {
    return translations[language][key] || key;
  }, [language]);
  
  // Register a callback function to be notified of language changes
  const registerTranslationCallback = useCallback((id: string, callback: LanguageChangeCallback) => {
    setCallbacks(prev => ({ ...prev, [id]: callback }));
  }, []);
  
  // Unregister a callback function
  const unregisterTranslationCallback = useCallback((id: string) => {
    setCallbacks(prev => {
      const newCallbacks = { ...prev };
      delete newCallbacks[id];
      return newCallbacks;
    });
  }, []);
  
  // Translate book data
  const translateBook = useCallback(async (book: Partial<Book>): Promise<Partial<Book>> => {
    if (!book) return book;
    setIsTranslating(true);
    
    try {
      const translatedBook = await translateBookData(book, language);
      return translatedBook;
    } catch (error) {
      console.error("Error translating book:", error);
      return book;
    } finally {
      setIsTranslating(false);
    }
  }, [language]);
  
  // Load saved language preference on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem("preferredLanguage") as Language;
    if (savedLanguage && Object.keys(translations).includes(savedLanguage)) {
      setLanguage(savedLanguage);
    } else {
      // Set German as default if no preference is saved
      setLanguage("de");
      localStorage.setItem("preferredLanguage", "de");
    }
  }, []);
  
  const contextValue = {
    language,
    changeLanguage,
    t,
    translateBook,
    isTranslating,
    registerTranslationCallback,
    unregisterTranslationCallback
  };
  
  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
