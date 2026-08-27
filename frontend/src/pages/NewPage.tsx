import { useEffect, useState } from 'react';
import { RankingList } from '../components/RankingList';
import { api } from '../utils/api';
import type { RankingResponse } from '../types';

export function NewPage() {
  const [data, setData] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getNew50()
      .then((response) => {
        setData(response as RankingResponse);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

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
        <div className="text-lg text-red-400">Error: {error || 'No data'}</div>
      </div>
    );
  }

  return (
    <RankingList
      items={data.items}
      title="NEW 50"
      subtitle="Recently discovered AI films"
    />
  );
}
