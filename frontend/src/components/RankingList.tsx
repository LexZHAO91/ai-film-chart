import { Link } from 'react-router-dom';
import type { RankingSnapshotItem } from '../types';

interface RankingListProps {
  items: RankingSnapshotItem[];
  title: string;
  subtitle: string;
}

export function RankingList({ items, title, subtitle }: RankingListProps) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-gray-400">{subtitle}</p>
          <p className="mt-1 text-sm text-gray-500">Updated every 3 days</p>
        </div>

        <div className="space-y-4">
          {items.map((item) => (
            <Link
              key={item.film_id}
              to={`/film/${item.film_id}`}
              className="flex items-center space-x-4 p-4 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <div className="flex-shrink-0 w-12 text-center">
                <span className="text-2xl font-bold text-gray-400">{item.rank}</span>
              </div>

              <div className="flex-shrink-0 w-24 h-16 bg-gray-800 rounded overflow-hidden">
                {item.thumbnail_url ? (
                  <img
                    src={item.thumbnail_url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                    No Image
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium truncate">{item.film_title || 'Unknown'}</h3>
                <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                  <span>Score: {(item.score * 100).toFixed(1)}</span>
                  {item.is_new && (
                    <span className="text-green-400 font-medium">NEW</span>
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
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
