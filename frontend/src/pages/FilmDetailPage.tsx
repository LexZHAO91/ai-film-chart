import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import type { FilmDetailResponse } from '../types';

function StarRating({
  value,
  onChange,
  size = 32,
  interactive = true,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  interactive?: boolean;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => interactive && setHover(star)}
          onMouseLeave={() => interactive && setHover(0)}
          className={`transition-transform ${interactive ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}`}
          style={{ fontSize: size, lineHeight: 1 }}
        >
          <span
            className={
              star <= (hover || value)
                ? 'text-yellow-400'
                : 'text-gray-600'
            }
          >
            ★
          </span>
        </button>
      ))}
    </div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="font-medium">{(value * 100).toFixed(0)}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function FilmDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<FilmDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRating, setUserRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);

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

  const handleRate = async (rating: number) => {
    if (!id || ratingLoading) return;
    setRatingLoading(true);
    try {
      const result = await api.submitRating(parseInt(id, 10), rating);
      setUserRating(rating);
      setRatingSubmitted(true);
      // Update local userRating data
      if (data) {
        setData({
          ...data,
          userRating: {
            average: parseFloat(result.average),
            count: result.count,
          },
        });
      }
    } catch {
      alert('评分提交失败，请稍后重试');
    } finally {
      setRatingLoading(false);
    }
  };

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

  const { film, metrics, aiAnalysis, score, userRating: avgUserRating } = data;
  const genres = JSON.parse(film.genre_json || '[]') as string[];

  // Format duration
  const durationMin = Math.floor(film.duration_seconds / 60);
  const durationSec = film.duration_seconds % 60;
  const durationText = film.duration_seconds > 0
    ? `${durationMin}:${durationSec.toString().padStart(2, '0')}`
    : 'Unknown';

  // Format published date
  let publishedText = 'Unknown';
  if (film.published_at) {
    const d = new Date(film.published_at);
    if (!isNaN(d.getTime())) {
      publishedText = d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link to="/" className="text-sm text-gray-400 hover:text-white mb-6 inline-block">
          ← Back to Rankings
        </Link>

        {/* Hero Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Poster */}
          <div className="md:col-span-1">
            <div className="aspect-video bg-gray-800 rounded-xl overflow-hidden shadow-lg">
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
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600 text-4xl">🎬</div>
              )}
            </div>

            {film.canonical_url && (
              <a
                href={film.canonical_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block w-full text-center py-3 bg-red-600 hover:bg-red-700 rounded-xl font-medium transition-colors shadow-lg"
              >
                ▶ Watch on YouTube
              </a>
            )}
          </div>

          {/* Title & Info */}
          <div className="md:col-span-2 space-y-5">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{film.title}</h1>
              <p className="mt-2 text-gray-400 text-lg">{film.channel_name || 'Unknown Creator'}</p>
            </div>

            {/* Score Badge */}
            {score && (
              <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-800 rounded-xl p-5">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-white">{(score.final_score * 100).toFixed(1)}</div>
                    <div className="text-xs text-blue-300 mt-1">AI CHART SCORE</div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <ScoreBar label="Popularity" value={score.popularity_score} color="bg-blue-500" />
                    <ScoreBar label="Momentum" value={score.momentum_score} color="bg-green-500" />
                    <ScoreBar label="Engagement" value={score.engagement_score} color="bg-purple-500" />
                    <ScoreBar label="Audience" value={score.audience_score} color="bg-yellow-500" />
                    <ScoreBar label="Quality" value={score.quality_score} color="bg-red-500" />
                  </div>
                </div>
              </div>
            )}

            {/* User Rating */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">观众评分</h3>
                {avgUserRating && avgUserRating.count > 0 && (
                  <div className="text-sm text-gray-400">
                    平均 <span className="text-yellow-400 font-bold text-lg">{(avgUserRating.average / 2).toFixed(1)}</span> / 5
                    <span className="ml-2">({avgUserRating.count} 人评分)</span>
                  </div>
                )}
              </div>

              {ratingSubmitted ? (
                <div className="text-center py-3">
                  <div className="text-green-400 text-lg mb-2">✓ 评分已提交！</div>
                  <StarRating value={userRating} interactive={false} />
                  <p className="text-sm text-gray-500 mt-2">你打了 {userRating} 星</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">点击星星为这部影片打分（1-5星）：</p>
                  <StarRating value={userRating} onChange={handleRate} />
                  {ratingLoading && <p className="text-sm text-gray-500">提交中...</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Basic Info */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4">影片信息</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">发布时间</span>
                <span>{publishedText}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">时长</span>
                <span>{durationText}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">类型</span>
                <span className="capitalize">{film.content_type?.replace(/_/g, ' ') || 'Short Film'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">语言</span>
                <span className="uppercase">{film.language || 'EN'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">风格</span>
                <span className="capitalize">{genres.join(', ').replace(/_/g, ' ') || '—'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-400">状态</span>
                <span className="capitalize text-green-400">{film.status}</span>
              </div>
            </div>
          </div>

          {/* Metrics */}
          {metrics && (
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <h2 className="text-lg font-semibold mb-4">数据指标</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-white">{metrics.views.toLocaleString()}</div>
                  <div className="text-xs text-gray-400 mt-1">Views</div>
                </div>
                <div className="text-center p-3 bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-white">{metrics.likes.toLocaleString()}</div>
                  <div className="text-xs text-gray-400 mt-1">Likes</div>
                </div>
                <div className="text-center p-3 bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-white">{metrics.comments.toLocaleString()}</div>
                  <div className="text-xs text-gray-400 mt-1">Comments</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Analysis */}
        {aiAnalysis && (
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-8">
            <h2 className="text-lg font-semibold mb-4">AI 分析</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
              <div className="text-center p-3 bg-gray-800 rounded-lg">
                <div className="text-xl font-bold text-blue-400">{(aiAnalysis.ai_generation_level * 100).toFixed(0)}%</div>
                <div className="text-xs text-gray-400 mt-1">AI Generation</div>
              </div>
              <div className="text-center p-3 bg-gray-800 rounded-lg">
                <div className="text-xl font-bold text-green-400">{(aiAnalysis.story_completeness * 100).toFixed(0)}%</div>
                <div className="text-xs text-gray-400 mt-1">Story Complete</div>
              </div>
              <div className="text-center p-3 bg-gray-800 rounded-lg">
                <div className="text-xl font-bold text-purple-400 capitalize">{aiAnalysis.content_type.replace(/_/g, ' ')}</div>
                <div className="text-xs text-gray-400 mt-1">Content Type</div>
              </div>
              <div className="text-center p-3 bg-gray-800 rounded-lg">
                <div className="text-xl font-bold text-yellow-400 uppercase">{aiAnalysis.language}</div>
                <div className="text-xs text-gray-400 mt-1">Language</div>
              </div>
            </div>
            {aiAnalysis.summary && (
              <p className="text-sm text-gray-400 leading-relaxed">{aiAnalysis.summary}</p>
            )}
          </div>
        )}

        {/* Description */}
        {film.description && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-3">简介</h2>
            <p className="text-gray-400 leading-relaxed">{film.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
