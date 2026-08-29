import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import type { RankingSnapshotItem } from '../types';

interface RankingListProps {
  items: RankingSnapshotItem[];
  title: string;
  subtitle: string;
}

// Format view count: 1234 -> 1.2K, 1234567 -> 1.2M
function formatCount(n: number | undefined): string {
  if (!n || n <= 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// Format duration: 360 -> 6:00, 90 -> 1:30
function formatDuration(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Genre tag
function GenreTag({ genre }: { genre: string }) {
  const colors = [
    'bg-blue-900/40 text-blue-300',
    'bg-purple-900/40 text-purple-300',
    'bg-green-900/40 text-green-300',
    'bg-orange-900/40 text-orange-300',
    'bg-pink-900/40 text-pink-300',
    'bg-cyan-900/40 text-cyan-300',
  ];
  const colorIndex = genre.length % colors.length;
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${colors[colorIndex]}`}>
      {genre.replace(/_/g, ' ')}
    </span>
  );
}

export function RankingList({ items, title, subtitle }: RankingListProps) {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-gray-400">{subtitle}</p>
          <p className="mt-1 text-sm text-gray-500">{t('ranking.updated')}</p>
        </div>

        {/* List */}
        <div className="space-y-3">
          {items.map((item) => {
            const genres = JSON.parse(item.genre_json || '[]') as string[];
            const durationStr = formatDuration(item.duration_seconds);

            return (
              <Link
                key={item.film_id}
                to={`/film/${item.film_id}`}
                className="flex items-start space-x-4 p-4 bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors border border-gray-800 hover:border-gray-700"
              >
                {/* Rank */}
                <div className="flex-shrink-0 w-10 text-center pt-1">
                  <span className={`text-2xl font-bold ${
                    item.rank <= 3 ? 'text-yellow-400' :
                    item.rank <= 10 ? 'text-gray-300' :
                    'text-gray-500'
                  }`}>
                    {item.rank}
                  </span>
                </div>

                {/* Thumbnail */}
                <div className="flex-shrink-0 relative w-32 h-20 bg-gray-800 rounded-lg overflow-hidden">
                  {item.thumbnail_url ? (
                    <img
                      src={item.thumbnail_url}
                      alt={item.film_title || ''}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (target.src.includes('maxresdefault.jpg')) {
                          target.src = target.src.replace('maxresdefault.jpg', 'hqdefault.jpg');
                        } else {
                          target.onerror = null;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.className = 'flex-shrink-0 w-32 h-20 bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center text-gray-600 text-xs';
                            parent.textContent = t('ranking.noImage');
                          }
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                      {t('ranking.noImage')}
                    </div>
                  )}
                  {/* Duration badge on thumbnail */}
                  {durationStr && (
                    <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                      {durationStr}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <h3 className="text-base font-semibold truncate text-white">{item.film_title || 'Unknown'}</h3>

                  {/* Creator + Country */}
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                    {item.creator_name && (
                      <span className="truncate max-w-[160px]">
                        <span className="text-gray-500">{t('ranking.by')}</span> {item.creator_name}
                      </span>
                    )}
                    {item.country && (
                      <>
                        <span className="text-gray-600">·</span>
                        <span className="truncate">{item.country}</span>
                      </>
                    )}
                    {item.language && (
                      <>
                        <span className="text-gray-600">·</span>
                        <span className="uppercase text-gray-500">{item.language}</span>
                      </>
                    )}
                  </div>

                  {/* Stats row: views, likes, rating */}
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    {item.views != null && item.views > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {formatCount(item.views)}
                      </span>
                    )}
                    {item.likes != null && item.likes > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        {formatCount(item.likes)}
                      </span>
                    )}
                    {item.avg_rating != null && item.avg_rating > 0 && item.rating_count != null && item.rating_count > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="text-yellow-400">★</span>
                        <span className="text-yellow-400 font-medium">{(item.avg_rating / 2).toFixed(1)}</span>
                        <span className="text-gray-600">({item.rating_count})</span>
                      </span>
                    )}
                  </div>

                  {/* Genre tags + Rank change */}
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {genres.slice(0, 3).map((g, i) => (
                      <GenreTag key={i} genre={g} />
                    ))}
                    {item.is_new && (
                      <span className="px-2 py-0.5 bg-green-900/50 text-green-400 rounded text-[10px] font-medium">{t('ranking.new')}</span>
                    )}
                    {item.rank_change > 0 && (
                      <span className="text-green-400 text-[10px] font-medium">↑ {item.rank_change}</span>
                    )}
                    {item.rank_change < 0 && (
                      <span className="text-red-400 text-[10px] font-medium">↓ {Math.abs(item.rank_change)}</span>
                    )}
                  </div>
                </div>

                {/* Score Badge */}
                <div className="flex-shrink-0 text-right pt-1">
                  <div className={`text-2xl font-bold ${
                    item.score >= 0.7 ? 'text-yellow-400' :
                    item.score >= 0.5 ? 'text-blue-400' :
                    'text-gray-400'
                  }`}>
                    {(item.score * 100).toFixed(1)}
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">{t('ranking.score')}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
