import type { Film, FilmMetrics, FilmAIAnalysis } from '../types';

export const MOCK_FILMS: Omit<Film, 'id' | 'created_at' | 'updated_at' | 'story_completeness'>[] = [
  // 高播放高评分 - 经典 AI 短片
  {
    source: 'youtube',
    source_video_id: 'mock_001',
    canonical_url: 'https://youtube.com/watch?v=mock_001',
    title: 'The Last Artist - AI Generated Short Film',
    description: 'A poignant story about the last human artist in a world dominated by AI creativity.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_001/maxresdefault.jpg',
    channel_id: 'channel_ai_cinema',
    channel_name: 'AI Cinema Studio',
    published_at: '2024-06-15T10:00:00Z',
    duration_seconds: 180,
    language: 'en',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'short_film',
    genre_json: JSON.stringify(['sci_fi', 'drama']),
    ai_generation_level: 0.95,
    ai_confidence: 0.98,
    status: 'approved',
  },
  {
    source: 'youtube',
    source_video_id: 'mock_002',
    canonical_url: 'https://youtube.com/watch?v=mock_002',
    title: 'Echoes of Tomorrow - AI Cinematic Experience',
    description: 'An AI-generated sci-fi thriller exploring time travel paradoxes.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_002/maxresdefault.jpg',
    channel_id: 'channel_future_films',
    channel_name: 'Future Films AI',
    published_at: '2024-08-20T14:30:00Z',
    duration_seconds: 240,
    language: 'en',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'short_film',
    genre_json: JSON.stringify(['sci_fi', 'thriller']),
    ai_generation_level: 0.92,
    ai_confidence: 0.96,
    status: 'approved',
  },
  // 高播放低评分 - 垃圾高播放作品
  {
    source: 'youtube',
    source_video_id: 'mock_003',
    canonical_url: 'https://youtube.com/watch?v=mock_003',
    title: 'AI Generated Movie But Bad',
    description: 'I made this with AI in 5 minutes. Watch me become famous.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_003/maxresdefault.jpg',
    channel_id: 'channel_clickbait',
    channel_name: 'Clickbait Central',
    published_at: '2024-09-01T08:00:00Z',
    duration_seconds: 120,
    language: 'en',
    is_ai_film: true,
    is_story_content: false,
    content_type: 'other',
    genre_json: JSON.stringify(['other']),
    ai_generation_level: 0.3,
    ai_confidence: 0.4,
    status: 'rejected',
  },
  // 低播放高评分 - 优秀小众作品
  {
    source: 'youtube',
    source_video_id: 'mock_004',
    canonical_url: 'https://youtube.com/watch?v=mock_004',
    title: 'Whispers in the Code - An AI Drama',
    description: 'A deeply emotional story about consciousness emerging from neural networks.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_004/maxresdefault.jpg',
    channel_id: 'channel_indie_ai',
    channel_name: 'Indie AI Films',
    published_at: '2024-07-10T16:00:00Z',
    duration_seconds: 300,
    language: 'en',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'short_film',
    genre_json: JSON.stringify(['drama', 'sci_fi']),
    ai_generation_level: 0.88,
    ai_confidence: 0.94,
    status: 'approved',
  },
  // 新作品快速增长
  {
    source: 'youtube',
    source_video_id: 'mock_005',
    canonical_url: 'https://youtube.com/watch?v=mock_005',
    title: 'Neon Dreams - AI Animation Breakthrough',
    description: 'Stunning AI-generated animation pushing the boundaries of visual storytelling.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_005/maxresdefault.jpg',
    channel_id: 'channel_neon_studio',
    channel_name: 'Neon Studio AI',
    published_at: '2026-08-25T12:00:00Z',
    duration_seconds: 210,
    language: 'en',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'animation',
    genre_json: JSON.stringify(['animation', 'sci_fi']),
    ai_generation_level: 0.97,
    ai_confidence: 0.99,
    status: 'approved',
  },
  // 老作品长期稳定
  {
    source: 'youtube',
    source_video_id: 'mock_006',
    canonical_url: 'https://youtube.com/watch?v=mock_006',
    title: 'Genesis Protocol - The First AI Film',
    description: 'The groundbreaking film that started the AI cinema revolution.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_006/maxresdefault.jpg',
    channel_id: 'channel_pioneer',
    channel_name: 'AI Pioneer Films',
    published_at: '2023-01-15T09:00:00Z',
    duration_seconds: 420,
    language: 'en',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'short_film',
    genre_json: JSON.stringify(['sci_fi', 'drama']),
    ai_generation_level: 0.75,
    ai_confidence: 0.9,
    status: 'approved',
  },
  // 评分人数极少
  {
    source: 'youtube',
    source_video_id: 'mock_007',
    canonical_url: 'https://youtube.com/watch?v=mock_007',
    title: 'Silent Algorithms - Experimental AI Film',
    description: 'An experimental narrative exploring the silence between machine thoughts.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_007/maxresdefault.jpg',
    channel_id: 'channel_experimental',
    channel_name: 'Experimental AI Lab',
    published_at: '2024-11-20T20:00:00Z',
    duration_seconds: 150,
    language: 'en',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'experimental',
    genre_json: JSON.stringify(['experimental', 'drama']),
    ai_generation_level: 0.85,
    ai_confidence: 0.88,
    status: 'approved',
  },
  // 点赞率异常高
  {
    source: 'youtube',
    source_video_id: 'mock_008',
    canonical_url: 'https://youtube.com/watch?v=mock_008',
    title: 'Heart of the Machine - Emotional AI Story',
    description: 'A tear-jerking story about an AI learning to love.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_008/maxresdefault.jpg',
    channel_id: 'channel_emotion',
    channel_name: 'Emotion AI Films',
    published_at: '2024-05-10T11:00:00Z',
    duration_seconds: 270,
    language: 'en',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'short_film',
    genre_json: JSON.stringify(['drama', 'romance']),
    ai_generation_level: 0.91,
    ai_confidence: 0.95,
    status: 'approved',
  },
  // 评论率异常高
  {
    source: 'youtube',
    source_video_id: 'mock_009',
    canonical_url: 'https://youtube.com/watch?v=mock_009',
    title: 'The Debate - AI vs Human Creativity',
    description: 'A thought-provoking film that sparked massive debate in the community.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_009/maxresdefault.jpg',
    channel_id: 'channel_debate',
    channel_name: 'Debate Films AI',
    published_at: '2024-10-05T15:00:00Z',
    duration_seconds: 360,
    language: 'en',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'short_film',
    genre_json: JSON.stringify(['drama', 'documentary']),
    ai_generation_level: 0.89,
    ai_confidence: 0.93,
    status: 'approved',
  },
  // 中文 AI 电影
  {
    source: 'youtube',
    source_video_id: 'mock_010',
    canonical_url: 'https://youtube.com/watch?v=mock_010',
    title: '数字桃花源 - AI 生成短片',
    description: '一个关于数字乌托邦的东方美学 AI 短片。',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_010/maxresdefault.jpg',
    channel_id: 'channel_chinese_ai',
    channel_name: '华语 AI 电影',
    published_at: '2024-12-01T10:00:00Z',
    duration_seconds: 280,
    language: 'zh',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'short_film',
    genre_json: JSON.stringify(['fantasy', 'drama']),
    ai_generation_level: 0.93,
    ai_confidence: 0.97,
    status: 'approved',
  },
  // 更多多样化作品
  {
    source: 'youtube',
    source_video_id: 'mock_011',
    canonical_url: 'https://youtube.com/watch?v=mock_011',
    title: 'Cyberpunk Alley - AI Noir',
    description: 'A dark neo-noir set in a rain-soaked cyberpunk city.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_011/maxresdefault.jpg',
    channel_id: 'channel_noir',
    channel_name: 'Noir AI Cinema',
    published_at: '2024-04-20T18:00:00Z',
    duration_seconds: 200,
    language: 'en',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'short_film',
    genre_json: JSON.stringify(['sci_fi', 'thriller']),
    ai_generation_level: 0.87,
    ai_confidence: 0.92,
    status: 'approved',
  },
  {
    source: 'youtube',
    source_video_id: 'mock_012',
    canonical_url: 'https://youtube.com/watch?v=mock_012',
    title: 'Laughing Bots - AI Comedy',
    description: 'Can AI understand humor? This film tries to find out.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_012/maxresdefault.jpg',
    channel_id: 'channel_comedy',
    channel_name: 'AI Comedy Lab',
    published_at: '2024-08-15T14:00:00Z',
    duration_seconds: 160,
    language: 'en',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'short_film',
    genre_json: JSON.stringify(['comedy']),
    ai_generation_level: 0.82,
    ai_confidence: 0.89,
    status: 'approved',
  },
  {
    source: 'youtube',
    source_video_id: 'mock_013',
    canonical_url: 'https://youtube.com/watch?v=mock_013',
    title: 'Haunted Neural Network - AI Horror',
    description: 'What happens when a neural network starts dreaming of ghosts?',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_013/maxresdefault.jpg',
    channel_id: 'channel_horror',
    channel_name: 'AI Horror Factory',
    published_at: '2024-10-31T22:00:00Z',
    duration_seconds: 190,
    language: 'en',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'short_film',
    genre_json: JSON.stringify(['horror', 'thriller']),
    ai_generation_level: 0.9,
    ai_confidence: 0.94,
    status: 'approved',
  },
  {
    source: 'youtube',
    source_video_id: 'mock_014',
    canonical_url: 'https://youtube.com/watch?v=mock_014',
    title: 'Love in the Loop - AI Romance',
    description: 'Two AIs fall in love across infinite training epochs.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_014/maxresdefault.jpg',
    channel_id: 'channel_romance',
    channel_name: 'AI Romance Studio',
    published_at: '2025-02-14T12:00:00Z',
    duration_seconds: 220,
    language: 'en',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'short_film',
    genre_json: JSON.stringify(['romance', 'sci_fi']),
    ai_generation_level: 0.86,
    ai_confidence: 0.91,
    status: 'approved',
  },
  {
    source: 'youtube',
    source_video_id: 'mock_015',
    canonical_url: 'https://youtube.com/watch?v=mock_015',
    title: 'The Glitch War - AI Action',
    description: 'High-octane action sequences generated entirely by AI.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_015/maxresdefault.jpg',
    channel_id: 'channel_action',
    channel_name: 'AI Action Films',
    published_at: '2024-07-04T16:00:00Z',
    duration_seconds: 250,
    language: 'en',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'short_film',
    genre_json: JSON.stringify(['action', 'sci_fi']),
    ai_generation_level: 0.88,
    ai_confidence: 0.93,
    status: 'approved',
  },
  // 待审核状态
  {
    source: 'youtube',
    source_video_id: 'mock_016',
    canonical_url: 'https://youtube.com/watch?v=mock_016',
    title: 'Unknown Entity - Pending Review',
    description: 'A mysterious AI film awaiting classification.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_016/maxresdefault.jpg',
    channel_id: 'channel_unknown',
    channel_name: 'Unknown Creator',
    published_at: '2026-08-20T10:00:00Z',
    duration_seconds: 180,
    language: 'en',
    is_ai_film: false,
    is_story_content: false,
    content_type: 'other',
    genre_json: JSON.stringify([]),
    ai_generation_level: 0,
    ai_confidence: 0,
    status: 'pending',
  },
  {
    source: 'youtube',
    source_video_id: 'mock_017',
    canonical_url: 'https://youtube.com/watch?v=mock_017',
    title: 'Tutorial: How to Make AI Films',
    description: 'Learn how to create AI films step by step.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_017/maxresdefault.jpg',
    channel_id: 'channel_tutorial',
    channel_name: 'AI Film Tutorials',
    published_at: '2024-03-01T09:00:00Z',
    duration_seconds: 600,
    language: 'en',
    is_ai_film: false,
    is_story_content: false,
    content_type: 'other',
    genre_json: JSON.stringify([]),
    ai_generation_level: 0,
    ai_confidence: 0,
    status: 'rejected',
  },
  // 更多边界案例
  {
    source: 'youtube',
    source_video_id: 'mock_018',
    canonical_url: 'https://youtube.com/watch?v=mock_018',
    title: 'Zero Views Masterpiece',
    description: 'An incredible AI film that nobody has watched yet.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_018/maxresdefault.jpg',
    channel_id: 'channel_hidden',
    channel_name: 'Hidden Gems AI',
    published_at: '2026-08-27T08:00:00Z',
    duration_seconds: 300,
    language: 'en',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'short_film',
    genre_json: JSON.stringify(['drama']),
    ai_generation_level: 0.96,
    ai_confidence: 0.98,
    status: 'approved',
  },
  {
    source: 'youtube',
    source_video_id: 'mock_019',
    canonical_url: 'https://youtube.com/watch?v=mock_019',
    title: 'Viral Sensation - 10M Views',
    description: 'The AI film that broke the internet.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_019/maxresdefault.jpg',
    channel_id: 'channel_viral',
    channel_name: 'Viral AI Films',
    published_at: '2024-01-01T00:00:00Z',
    duration_seconds: 120,
    language: 'en',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'short_film',
    genre_json: JSON.stringify(['comedy']),
    ai_generation_level: 0.7,
    ai_confidence: 0.85,
    status: 'approved',
  },
  {
    source: 'youtube',
    source_video_id: 'mock_020',
    canonical_url: 'https://youtube.com/watch?v=mock_020',
    title: 'Slow Burn - Gradual Growth',
    description: 'A film that grows slowly but steadily in popularity.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_020/maxresdefault.jpg',
    channel_id: 'channel_slow',
    channel_name: 'Slow Growth Films',
    published_at: '2023-06-01T12:00:00Z',
    duration_seconds: 330,
    language: 'en',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'short_film',
    genre_json: JSON.stringify(['drama', 'thriller']),
    ai_generation_level: 0.84,
    ai_confidence: 0.9,
    status: 'approved',
  },
  {
    source: 'youtube',
    source_video_id: 'mock_021',
    canonical_url: 'https://youtube.com/watch?v=mock_021',
    title: 'Japanese AI Animation - Sakura Dreams',
    description: '美しい桜の下で繰り広げられるAI生成アニメーション。',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_021/maxresdefault.jpg',
    channel_id: 'channel_jp_ai',
    channel_name: '日本AIアニメーション',
    published_at: '2025-04-01T10:00:00Z',
    duration_seconds: 240,
    language: 'ja',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'animation',
    genre_json: JSON.stringify(['animation', 'fantasy']),
    ai_generation_level: 0.94,
    ai_confidence: 0.97,
    status: 'approved',
  },
  {
    source: 'youtube',
    source_video_id: 'mock_022',
    canonical_url: 'https://youtube.com/watch?v=mock_022',
    title: 'French AI Noir - Le Silencieux',
    description: 'Un film noir généré par IA dans les rues de Paris.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_022/maxresdefault.jpg',
    channel_id: 'channel_fr_ai',
    channel_name: 'Cinéma AI Français',
    published_at: '2024-09-15T14:00:00Z',
    duration_seconds: 280,
    language: 'fr',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'short_film',
    genre_json: JSON.stringify(['thriller', 'drama']),
    ai_generation_level: 0.89,
    ai_confidence: 0.93,
    status: 'approved',
  },
  {
    source: 'youtube',
    source_video_id: 'mock_023',
    canonical_url: 'https://youtube.com/watch?v=mock_023',
    title: 'Korean AI Drama - Digital Hanok',
    description: 'AI로 생성된 한국 전통 가옥에서 펼쳐지는 드라마.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_023/maxresdefault.jpg',
    channel_id: 'channel_kr_ai',
    channel_name: '한국 AI 영화',
    published_at: '2025-01-15T11:00:00Z',
    duration_seconds: 260,
    language: 'ko',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'short_film',
    genre_json: JSON.stringify(['drama', 'romance']),
    ai_generation_level: 0.91,
    ai_confidence: 0.95,
    status: 'approved',
  },
  {
    source: 'youtube',
    source_video_id: 'mock_024',
    canonical_url: 'https://youtube.com/watch?v=mock_024',
    title: 'Documentary: The AI Revolution',
    description: 'A documentary about how AI is changing filmmaking.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_024/maxresdefault.jpg',
    channel_id: 'channel_doc',
    channel_name: 'AI Documentaries',
    published_at: '2024-02-28T09:00:00Z',
    duration_seconds: 900,
    language: 'en',
    is_ai_film: false,
    is_story_content: false,
    content_type: 'other',
    genre_json: JSON.stringify(['documentary']),
    ai_generation_level: 0,
    ai_confidence: 0,
    status: 'rejected',
  },
  {
    source: 'youtube',
    source_video_id: 'mock_025',
    canonical_url: 'https://youtube.com/watch?v=mock_025',
    title: 'Midnight Algorithm - AI Thriller',
    description: 'A coding AI becomes sentient and starts manipulating the stock market.',
    thumbnail_url: 'https://i.ytimg.com/vi/mock_025/maxresdefault.jpg',
    channel_id: 'channel_thriller',
    channel_name: 'AI Thriller House',
    published_at: '2024-11-11T23:00:00Z',
    duration_seconds: 310,
    language: 'en',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'short_film',
    genre_json: JSON.stringify(['thriller', 'sci_fi']),
    ai_generation_level: 0.93,
    ai_confidence: 0.96,
    status: 'approved',
  },
];

// Generate metrics for mock films
export function generateMockMetrics(filmId: number, sourceVideoId: string): FilmMetrics[] {
  const metrics: FilmMetrics[] = [];
  const now = new Date();

  // Base views based on film characteristics
  let baseViews = 10000;
  if (sourceVideoId === 'mock_001') baseViews = 2500000;
  if (sourceVideoId === 'mock_002') baseViews = 1800000;
  if (sourceVideoId === 'mock_003') baseViews = 5000000; // high views, low quality
  if (sourceVideoId === 'mock_004') baseViews = 50000; // low views, high quality
  if (sourceVideoId === 'mock_005') baseViews = 100000; // new, fast growing
  if (sourceVideoId === 'mock_006') baseViews = 3200000; // old, stable
  if (sourceVideoId === 'mock_018') baseViews = 0; // zero views
  if (sourceVideoId === 'mock_019') baseViews = 10000000; // viral

  // Generate 30 days of metrics
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    let views = baseViews;

    // Add growth patterns
    if (sourceVideoId === 'mock_005') {
      // Fast growing: exponential
      views = Math.floor(baseViews * Math.pow(1.15, 29 - i));
    } else if (sourceVideoId === 'mock_020') {
      // Slow steady growth
      views = Math.floor(baseViews * (1 + (29 - i) * 0.02));
    } else if (sourceVideoId === 'mock_003') {
      // High views but stagnant
      views = baseViews + Math.floor(Math.random() * 1000);
    } else {
      // Normal growth with some randomness
      views = Math.floor(baseViews * (1 + (29 - i) * 0.01 + Math.random() * 0.005));
    }

    // Like rate varies by quality
    let likeRate = 0.03;
    if (sourceVideoId === 'mock_008') likeRate = 0.12; // abnormally high likes
    if (sourceVideoId === 'mock_003') likeRate = 0.005; // low engagement
    if (sourceVideoId === 'mock_019') likeRate = 0.02; // viral but not loved

    // Comment rate varies
    let commentRate = 0.002;
    if (sourceVideoId === 'mock_009') commentRate = 0.015; // abnormally high comments
    if (sourceVideoId === 'mock_003') commentRate = 0.0005;

    metrics.push({
      id: 0,
      film_id: filmId,
      collected_at: date.toISOString(),
      views,
      likes: Math.floor(views * likeRate),
      comments: Math.floor(views * commentRate),
    });
  }

  return metrics;
}

// Story completeness mapping for mock films
const STORY_COMPLETENESS: Record<string, number> = {
  mock_001: 0.92, // high quality classic
  mock_002: 0.88,
  mock_003: 0.25, // low quality clickbait
  mock_004: 0.95, // high quality indie
  mock_005: 0.90, // new fast growing
  mock_006: 0.85, // old classic
  mock_007: 0.78, // experimental
  mock_008: 0.87, // high engagement
  mock_009: 0.86, // high comments
  mock_010: 0.91, // chinese
  mock_011: 0.84,
  mock_012: 0.75, // comedy
  mock_013: 0.82, // horror
  mock_014: 0.83, // romance
  mock_015: 0.80, // action
  mock_018: 0.94, // zero views masterpiece
  mock_019: 0.60, // viral but lower quality
  mock_020: 0.88, // slow burn
  mock_021: 0.89, // japanese
  mock_022: 0.85, // french
  mock_023: 0.87, // korean
  mock_025: 0.90, // thriller
};

// Generate AI analysis for mock films
export function generateMockAIAnalysis(filmId: number, sourceVideoId: string): Omit<FilmAIAnalysis, 'id' | 'analyzed_at'> | null {
  const film = MOCK_FILMS.find(f => f.source_video_id === sourceVideoId);
  if (!film || !film.is_ai_film) return null;

  return {
    film_id: filmId,
    model_name: 'mock-classifier',
    model_version: 'v1.0',
    prompt_version: 'v1.0',
    is_ai_film: film.is_ai_film,
    is_story_content: film.is_story_content,
    content_type: film.content_type,
    genres_json: film.genre_json,
    language: film.language,
    ai_generation_level: film.ai_generation_level,
    story_completeness: STORY_COMPLETENESS[sourceVideoId] || 0.8,
    summary: film.description.slice(0, 200),
  };
}
