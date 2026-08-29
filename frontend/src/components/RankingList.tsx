import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import type { RankingSnapshotItem } from '../types';

interface RankingListProps {
  items: RankingSnapshotItem[];
  title: string;
  subtitle: string;
}

export function RankingList({ items, title, subtitle }: RankingListProps) {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-gray-400">{subtitle}</p>
          <p className="mt-1 text-sm text-gray-500">{t('ranking.updated')}</p>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.film_id}
              to={`/film/${item.film_id}`}
              className="flex items-center space-x-4 p-4 bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors border border-gray-800 hover:border-gray-700"
            >
              {/* Rank */}
              <div className="flex-shrink-0 w-12 text-center">
                <span className={`text-2xl font-bold ${
                  item.rank <= 3 ? 'text-yellow-400' :
                  item.rank <= 10 ? 'text-gray-300' :
                  'text-gray-500'
                }`}>
                  {item.rank}
                </span>
              </div>

              {/* Thumbnail */}
              <div className="flex-shrink-0 w-28 h-18 bg-gray-800 rounded-lg overflow-hidden">
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
                          parent.className = 'flex-shrink-0 w-28 h-18 bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center text-gray-600 text-xs';
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
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-medium truncate">{item.film_title || 'Unknown'}</h3>
                <div className="mt-1 flex items-center space-x-3 text-xs text-gray-500">
                  {item.is_new && (
                    <span className="px-2 py-0.5 bg-green-900/50 text-green-400 rounded font-medium">{t('ranking.new')}</span>
                  )}
                  {item.rank_change > 0 && (
                    <span className="text-green-400">↑ {item.rank_change}</span>
                  )}
                  {item.rank_change < 0 && (
                    <span className="text-red-400">↓ {Math.abs(item.rank_change)}</span>
                  )}
                  {!item.is_new && item.rank_change === 0 && (
                    <span className="text-gray-500">—</span>
                  )}
                </div>
              </div>

              {/* Score Badge */}
              <div className="flex-shrink-0 text-right">
                <div className={`text-2xl font-bold ${
                  item.score >= 0.7 ? 'text-yellow-400' :
                  item.score >= 0.5 ? 'text-blue-400' :
                  'text-gray-400'
                }`}>
                  {(item.score * 100).toFixed(1)}
                </div>
                <div className="text-xs text-gray-500">{t('ranking.score')}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
