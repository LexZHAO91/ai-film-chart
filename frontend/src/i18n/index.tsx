import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type Lang = 'en' | 'zh' | 'es' | 'fr' | 'ar';

export const LANGS: { code: Lang; name: string; native: string; flag: string }[] = [
  { code: 'en', name: 'English', native: 'English', flag: '🇺🇸' },
  { code: 'zh', name: 'Chinese', native: '中文', flag: '🇨🇳' },
  { code: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷' },
  { code: 'ar', name: 'Arabic', native: 'العربية', flag: '🇸🇦' },
];

// ============================================
// Translations
// ============================================
const translations: Record<Lang, Record<string, string>> = {
  en: {
    // Header
    'nav.top100': 'TOP 100',
    'nav.rising': 'RISING',
    'nav.new': 'NEW',
    'nav.admin': 'Admin',
    'site.title': 'AI FILM CHART',

    // Ranking List
    'ranking.updated': 'Updated every 3 days',
    'ranking.score': 'SCORE',
    'ranking.new': 'NEW',
    'ranking.noImage': 'No Image',

    // HomePage
    'home.loading': 'Loading rankings...',
    'home.error': 'Error',
    'home.empty.title': 'AI FILM CHART',
    'home.empty.subtitle': 'The AI films worth watching.',
    'home.empty.hint': 'No rankings available yet. Run ranking from admin.',

    // RisingPage
    'rising.title': 'RISING 50',
    'rising.subtitle': 'Films gaining momentum fast',

    // NewPage
    'new.title': 'NEW 50',
    'new.subtitle': 'Recently discovered AI films',

    // Film Detail
    'detail.back': '← Back to Rankings',
    'detail.watch': '▶ Watch on YouTube',
    'detail.noImage': '🎬',
    'detail.aiChartScore': 'AI CHART SCORE',
    'detail.popularity': 'Popularity',
    'detail.momentum': 'Momentum',
    'detail.engagement': 'Engagement',
    'detail.audience': 'Audience',
    'detail.quality': 'Quality',
    'detail.userRating': 'Audience Rating',
    'detail.ratingHint': 'Click stars to rate this film (1-5):',
    'detail.ratingSubmitted': '✓ Rating submitted!',
    'detail.yourRating': 'You rated',
    'detail.stars': 'stars',
    'detail.submitting': 'Submitting...',
    'detail.filmInfo': 'Film Info',
    'detail.published': 'Published',
    'detail.duration': 'Duration',
    'detail.type': 'Type',
    'detail.language': 'Language',
    'detail.genre': 'Genre',
    'detail.status': 'Status',
    'detail.metrics': 'Metrics',
    'detail.views': 'Views',
    'detail.likes': 'Likes',
    'detail.comments': 'Comments',
    'detail.aiAnalysis': 'AI Analysis',
    'detail.aiGeneration': 'AI Generation',
    'detail.storyComplete': 'Story Complete',
    'detail.contentType': 'Content Type',
    'detail.summary': 'Summary',
    'detail.description': 'Description',
    'detail.unknown': 'Unknown',
    'detail.avg': 'Avg',
    'detail.people': 'ratings',
    'detail.ratingFailed': 'Rating failed, please try again',

    // Language selector
    'lang.select': 'Language',
  },

  zh: {
    'nav.top100': 'TOP 100',
    'nav.rising': '飙升榜',
    'nav.new': '新片榜',
    'nav.admin': '管理后台',
    'site.title': 'AI 影视排行榜',

    'ranking.updated': '每 3 天更新',
    'ranking.score': '分数',
    'ranking.new': '新上榜',
    'ranking.noImage': '无图片',

    'home.loading': '加载排行榜中...',
    'home.error': '错误',
    'home.empty.title': 'AI 影视排行榜',
    'home.empty.subtitle': '值得一看的 AI 影视作品。',
    'home.empty.hint': '暂无排名数据。请从管理后台运行排名计算。',

    'rising.title': '飙升 50',
    'rising.subtitle': '热度快速上升的影片',

    'new.title': '新片 50',
    'new.subtitle': '最近发现的 AI 影片',

    'detail.back': '← 返回排行榜',
    'detail.watch': '▶ 在 YouTube 观看',
    'detail.noImage': '🎬',
    'detail.aiChartScore': 'AI 排行榜分数',
    'detail.popularity': '热度',
    'detail.momentum': '势头',
    'detail.engagement': '互动',
    'detail.audience': '观众',
    'detail.quality': '质量',
    'detail.userRating': '观众评分',
    'detail.ratingHint': '点击星星为这部影片打分（1-5星）：',
    'detail.ratingSubmitted': '✓ 评分已提交！',
    'detail.yourRating': '你打了',
    'detail.stars': '星',
    'detail.submitting': '提交中...',
    'detail.filmInfo': '影片信息',
    'detail.published': '发布时间',
    'detail.duration': '时长',
    'detail.type': '类型',
    'detail.language': '语言',
    'detail.genre': '风格',
    'detail.status': '状态',
    'detail.metrics': '数据指标',
    'detail.views': '播放量',
    'detail.likes': '点赞',
    'detail.comments': '评论',
    'detail.aiAnalysis': 'AI 分析',
    'detail.aiGeneration': 'AI 生成度',
    'detail.storyComplete': '故事完整度',
    'detail.contentType': '内容类型',
    'detail.summary': '简介',
    'detail.description': '剧情简介',
    'detail.unknown': '未知',
    'detail.avg': '平均',
    'detail.people': '人评分',
    'detail.ratingFailed': '评分提交失败，请稍后重试',

    'lang.select': '语言',
  },

  es: {
    'nav.top100': 'TOP 100',
    'nav.rising': 'TENDENCIA',
    'nav.new': 'NUEVO',
    'nav.admin': 'Admin',
    'site.title': 'AI FILM CHART',

    'ranking.updated': 'Actualizado cada 3 días',
    'ranking.score': 'PUNTUACIÓN',
    'ranking.new': 'NUEVO',
    'ranking.noImage': 'Sin imagen',

    'home.loading': 'Cargando clasificación...',
    'home.error': 'Error',
    'home.empty.title': 'AI FILM CHART',
    'home.empty.subtitle': 'Las películas de IA que vale la pena ver.',
    'home.empty.hint': 'No hay clasificaciones disponibles. Ejecute la clasificación desde admin.',

    'rising.title': 'TENDENCIA 50',
    'rising.subtitle': 'Películas ganando impulso rápido',

    'new.title': 'NUEVO 50',
    'new.subtitle': 'Películas de IA descubiertas recientemente',

    'detail.back': '← Volver a la clasificación',
    'detail.watch': '▶ Ver en YouTube',
    'detail.noImage': '🎬',
    'detail.aiChartScore': 'PUNTUACIÓN AI',
    'detail.popularity': 'Popularidad',
    'detail.momentum': 'Impulso',
    'detail.engagement': 'Interacción',
    'detail.audience': 'Audiencia',
    'detail.quality': 'Calidad',
    'detail.userRating': 'Calificación del público',
    'detail.ratingHint': 'Haz clic en las estrellas para calificar (1-5):',
    'detail.ratingSubmitted': '✓ ¡Calificación enviada!',
    'detail.yourRating': 'Calificaste con',
    'detail.stars': 'estrellas',
    'detail.submitting': 'Enviando...',
    'detail.filmInfo': 'Información',
    'detail.published': 'Publicado',
    'detail.duration': 'Duración',
    'detail.type': 'Tipo',
    'detail.language': 'Idioma',
    'detail.genre': 'Género',
    'detail.status': 'Estado',
    'detail.metrics': 'Métricas',
    'detail.views': 'Vistas',
    'detail.likes': 'Me gusta',
    'detail.comments': 'Comentarios',
    'detail.aiAnalysis': 'Análisis AI',
    'detail.aiGeneration': 'Generación AI',
    'detail.storyComplete': 'Historia completa',
    'detail.contentType': 'Tipo de contenido',
    'detail.summary': 'Resumen',
    'detail.description': 'Descripción',
    'detail.unknown': 'Desconocido',
    'detail.avg': 'Prom',
    'detail.people': 'calificaciones',
    'detail.ratingFailed': 'Error al enviar la calificación, inténtalo de nuevo',

    'lang.select': 'Idioma',
  },

  fr: {
    'nav.top100': 'TOP 100',
    'nav.rising': 'TENDANCE',
    'nav.new': 'NOUVEAU',
    'nav.admin': 'Admin',
    'site.title': 'AI FILM CHART',

    'ranking.updated': 'Mis à jour tous les 3 jours',
    'ranking.score': 'SCORE',
    'ranking.new': 'NOUVEAU',
    'ranking.noImage': 'Pas d\'image',

    'home.loading': 'Chargement du classement...',
    'home.error': 'Erreur',
    'home.empty.title': 'AI FILM CHART',
    'home.empty.subtitle': 'Les films IA à ne pas manquer.',
    'home.empty.hint': 'Aucun classement disponible. Lancez le classement depuis l\'admin.',

    'rising.title': 'TENDANCE 50',
    'rising.subtitle': 'Films gagnant rapidement en popularité',

    'new.title': 'NOUVEAU 50',
    'new.subtitle': 'Films IA récemment découverts',

    'detail.back': '← Retour au classement',
    'detail.watch': '▶ Regarder sur YouTube',
    'detail.noImage': '🎬',
    'detail.aiChartScore': 'SCORE AI',
    'detail.popularity': 'Popularité',
    'detail.momentum': 'Élan',
    'detail.engagement': 'Engagement',
    'detail.audience': 'Public',
    'detail.quality': 'Qualité',
    'detail.userRating': 'Note du public',
    'detail.ratingHint': 'Cliquez sur les étoiles pour noter (1-5):',
    'detail.ratingSubmitted': '✓ Note envoyée !',
    'detail.yourRating': 'Vous avez noté',
    'detail.stars': 'étoiles',
    'detail.submitting': 'Envoi en cours...',
    'detail.filmInfo': 'Informations',
    'detail.published': 'Publié',
    'detail.duration': 'Durée',
    'detail.type': 'Type',
    'detail.language': 'Langue',
    'detail.genre': 'Genre',
    'detail.status': 'Statut',
    'detail.metrics': 'Métriques',
    'detail.views': 'Vues',
    'detail.likes': 'J\'aime',
    'detail.comments': 'Commentaires',
    'detail.aiAnalysis': 'Analyse AI',
    'detail.aiGeneration': 'Génération AI',
    'detail.storyComplete': 'Histoire complète',
    'detail.contentType': 'Type de contenu',
    'detail.summary': 'Résumé',
    'detail.description': 'Description',
    'detail.unknown': 'Inconnu',
    'detail.avg': 'Moy',
    'detail.people': 'notes',
    'detail.ratingFailed': 'Échec de l\'envoi de la note, veuillez réessayer',

    'lang.select': 'Langue',
  },

  ar: {
    'nav.top100': 'أفضل 100',
    'nav.rising': 'الأكثر رواجاً',
    'nav.new': 'جديد',
    'nav.admin': 'الإدارة',
    'site.title': 'AI FILM CHART',

    'ranking.updated': 'يتم التحديث كل 3 أيام',
    'ranking.score': 'الدرجة',
    'ranking.new': 'جديد',
    'ranking.noImage': 'لا توجد صورة',

    'home.loading': 'جاري تحميل التصنيف...',
    'home.error': 'خطأ',
    'home.empty.title': 'AI FILM CHART',
    'home.empty.subtitle': 'أفلام الذكاء الاصطناعي التي تستحق المشاهدة.',
    'home.empty.hint': 'لا يوجد تصنيف متاح. قم بتشغيل التصنيف من الإدارة.',

    'rising.title': 'الأكثر رواجاً 50',
    'rising.subtitle': 'أفلام تكتسب زخماً سريعاً',

    'new.title': 'جديد 50',
    'new.subtitle': 'أفلام ذكاء اصطناعي مكتشفة حديثاً',

    'detail.back': '← العودة إلى التصنيف',
    'detail.watch': '▶ مشاهدة على YouTube',
    'detail.noImage': '🎬',
    'detail.aiChartScore': 'درجة AI',
    'detail.popularity': 'الشعبية',
    'detail.momentum': ' الزخم',
    'detail.engagement': 'التفاعل',
    'detail.audience': 'الجمهور',
    'detail.quality': 'الجودة',
    'detail.userRating': 'تقييم الجمهور',
    'detail.ratingHint': 'انقر على النجوم للتقييم (1-5):',
    'detail.ratingSubmitted': '✓ تم إرسال التقييم!',
    'detail.yourRating': 'قمت بتقييمه بـ',
    'detail.stars': 'نجوم',
    'detail.submitting': 'جاري الإرسال...',
    'detail.filmInfo': 'معلومات الفيلم',
    'detail.published': 'تاريخ النشر',
    'detail.duration': 'المدة',
    'detail.type': 'النوع',
    'detail.language': 'اللغة',
    'detail.genre': 'النوع',
    'detail.status': 'الحالة',
    'detail.metrics': 'المقاييس',
    'detail.views': 'المشاهدات',
    'detail.likes': 'الإعجابات',
    'detail.comments': 'التعليقات',
    'detail.aiAnalysis': 'تحليل AI',
    'detail.aiGeneration': 'توليد AI',
    'detail.storyComplete': 'اكتمال القصة',
    'detail.contentType': 'نوع المحتوى',
    'detail.summary': 'ملخص',
    'detail.description': 'الوصف',
    'detail.unknown': 'غير معروف',
    'detail.avg': 'متوسط',
    'detail.people': 'تقييم',
    'detail.ratingFailed': 'فشل إرسال التقييم، يرجى المحاولة مرة أخرى',

    'lang.select': 'اللغة',
  },
};

// ============================================
// Context
// ============================================
interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key: string) => key,
  isRTL: false,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('ai-film-chart-lang') as Lang;
    return LANGS.some(l => l.code === saved) ? saved : 'en';
  });

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem('ai-film-chart-lang', newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  }, []);

  const t = useCallback(
    (key: string) => translations[lang][key] || translations['en'][key] || key,
    [lang]
  );

  const isRTL = lang === 'ar';

  return (
    <I18nContext.Provider value={{ lang, setLang, t, isRTL }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
