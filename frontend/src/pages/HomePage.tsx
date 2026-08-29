import { useEffect, useState } from 'react';
import { RankingList } from '../components/RankingList';
import { api } from '../utils/api';
import { useI18n } from '../i18n';
import type { RankingResponse } from '../types';

export function HomePage() {
  const { t } = useI18n();
  const [data, setData] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getTop100()
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
        <div className="text-lg">{t('home.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-lg text-red-400">{t('home.error')}: {error}</div>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">{t('home.empty.title')}</h2>
          <p className="text-gray-400 mb-4">{t('home.empty.subtitle')}</p>
          <p className="text-sm text-gray-500">{t('home.empty.hint')}</p>
        </div>
      </div>
    );
  }

  return (
    <RankingList
      items={data.items}
      title={t('nav.top100')}
      subtitle={t('home.empty.subtitle')}
    />
  );
}
