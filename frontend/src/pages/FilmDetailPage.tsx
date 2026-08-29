import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import type { FilmDetailResponse } from '../types';

export function FilmDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<FilmDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getFilm(parseInt(id, 10))
      .then((response) => {
        setData(response as FilmDetailResponse);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-lg text-red-400">Error: {error || 'Film not found'}</div>
      </div>
    );
  }

  const { film, metrics, aiAnalysis } = data;
  const genres = JSON.parse(film.genre_json || '[]') as string[];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/" className="text-sm text-gray-400 hover:text-white mb-6 inline-block">
          ← Back to Rankings
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Thumbnail */}
          <div className="md:col-span-1">
            <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden">
              {film.thumbnail_url ? (
                <img
                  src={film.thumbnail_url}
                  alt={film.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src.includes('maxresdefault.jpg')) {
                      target.src = target.src.replace('maxresdefault.jpg', 'hqdefault.jpg');
                    } else if (target.src.includes('hqdefault.jpg')) {
                      target.src = target.src.replace('hqdefault.jpg', 'default.jpg');
                    } else {
                      target.onerror = null;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.className = 'aspect-video bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center text-gray-600';
                        parent.textContent = 'No Image';
                      }
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600">
                  No Image
                </div>
              )}
            </div>

            {film.canonical_url && (
              <a
                href={film.canonical_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block w-full text-center py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
              >
                Watch on YouTube
              </a>
            )}
          </div>

          {/* Details */}
          <div className="md:col-span-2 space-y-6">
            <div>
              <h1 className="text-2xl font-bold">{film.title}</h1>
              <p className="mt-2 text-gray-400">{film.channel_name}</p>
            </div>

            {aiAnalysis && (
              <div className="bg-gray-900 rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-3">AI Analysis</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">AI Generation Level</span>
                    <div className="text-white font-medium">{(aiAnalysis.ai_generation_level * 100).toFixed(0)}%</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Story Completeness</span>
                    <div className="text-white font-medium">{(aiAnalysis.story_completeness * 100).toFixed(0)}%</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Content Type</span>
                    <div className="text-white font-medium capitalize">{aiAnalysis.content_type.replace('_', ' ')}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Language</span>
                    <div className="text-white font-medium uppercase">{aiAnalysis.language}</div>
                  </div>
                </div>
                {aiAnalysis.summary && (
                  <p className="mt-3 text-sm text-gray-400">{aiAnalysis.summary}</p>
                )}
              </div>
            )}

            {metrics && (
              <div className="bg-gray-900 rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-3">Metrics</h2>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Views</span>
                    <div className="text-white font-medium">{metrics.views.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Likes</span>
                    <div className="text-white font-medium">{metrics.likes.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Comments</span>
                    <div className="text-white font-medium">{metrics.comments.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gray-900 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3">Details</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Published</span>
                  <span>{new Date(film.published_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Duration</span>
                  <span>{Math.floor(film.duration_seconds / 60)}:{(film.duration_seconds % 60).toString().padStart(2, '0')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Genre</span>
                  <span className="capitalize">{genres.join(', ').replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className="capitalize">{film.status}</span>
                </div>
              </div>
            </div>

            {film.description && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Description</h2>
                <p className="text-sm text-gray-400 leading-relaxed">{film.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
