import { useEffect, useState } from 'react';
import { api } from '../utils/api';

// ============================================
// 扩展 API 客户端 / Extended API Client
// ============================================
const API_BASE = (api as any).API_BASE || 'https://ai-film-chart-api.906402759lex.workers.dev';

const adminApi = {
  getWorks: (token: string) => fetch(`${API_BASE}/api/admin/works`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()),

  updateWork: (token: string, id: number, data: object) => fetch(`${API_BASE}/api/admin/works/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...data, admin_id: 'admin' }),
  }).then(r => r.json()),

  requestDeleteWork: (token: string, id: number, reason?: string) => fetch(`${API_BASE}/api/admin/works/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason, admin_id: 'admin' }),
  }).then(r => r.json()),

  confirmDeleteWork: (token: string, id: number, confirmationToken: string) => fetch(`${API_BASE}/api/admin/works/${id}/confirm-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ confirmation_token: confirmationToken, admin_id: 'admin' }),
  }).then(r => r.json()),

  cancelDeleteWork: (token: string, id: number) => fetch(`${API_BASE}/api/admin/works/${id}/cancel-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ admin_id: 'admin' }),
  }).then(r => r.json()),

  restoreWork: (token: string, id: number) => fetch(`${API_BASE}/api/admin/works/${id}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ admin_id: 'admin' }),
  }).then(r => r.json()),

  addWatchSource: (token: string, data: object) => fetch(`${API_BASE}/api/admin/watch-sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...data, admin_id: 'admin' }),
  }).then(r => r.json()),

  updateWatchSource: (token: string, id: number, data: object) => fetch(`${API_BASE}/api/admin/watch-sources/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...data, admin_id: 'admin' }),
  }).then(r => r.json()),

  deleteWatchSource: (token: string, id: number) => fetch(`${API_BASE}/api/admin/watch-sources/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ admin_id: 'admin' }),
  }).then(r => r.json()),

  submitReview: (token: string, workId: number, data: object) => fetch(`${API_BASE}/api/admin/works/${workId}/review`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...data, admin_id: 'admin' }),
  }).then(r => r.json()),

  getPhase34Dashboard: (token: string) => fetch(`${API_BASE}/api/admin/phase34/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()),

  getPhase35PoolStatus: (token: string) => fetch(`${API_BASE}/api/admin/phase35/pool-status`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()),

  getAuditLog: (token: string, workId: number) => fetch(`${API_BASE}/api/admin/works/${workId}/audit-log`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()),

  generateThumbnail: (token: string, workId: number) => fetch(`${API_BASE}/api/admin/works/${workId}/generate-thumbnail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()),

  generateAllThumbnails: (token: string) => fetch(`${API_BASE}/api/admin/thumbnails/generate-all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()),

  updatePoster: (token: string, workId: number, posterUrl: string) => fetch(`${API_BASE}/api/admin/works/${workId}/poster`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ poster_url: posterUrl, admin_id: 'admin' }),
  }).then(r => r.json()),
};

// ============================================
// 类型定义 / Types
// ============================================
interface WorkItem {
  id: number;
  canonical_title: string;
  creator_name: string | null;
  eligibility_status: string;
  review_origin: string | null;
  human_quality_rating: number | null;
  validation_eligible: number;
  type?: string;
  synopsis?: string | null;
  country?: string | null;
  release_year?: number | null;
  duration_seconds?: number | null;
  poster_url?: string | null;
  watch_sources: { id: number; url: string; source_role: string; watch_status: string; source_type: string }[];
}

// ============================================
// 双语标签 / Bilingual Labels
// ============================================
const L = {
  login: { zh: '管理后台登录', en: 'Admin Login' },
  tokenPlaceholder: { zh: '请输入管理 Token', en: 'Enter admin token' },
  loginBtn: { zh: '登录', en: 'Login' },
  dashboard: { zh: '总览', en: 'Dashboard' },
  works: { zh: '作品管理', en: 'Works' },
  logout: { zh: '退出', en: 'Logout' },
  totalWorks: { zh: '作品总数', en: 'Total Works' },
  verified: { zh: '已验证', en: 'Verified' },
  reviewNeeded: { zh: '待审核', en: 'Review Needed' },
  rejected: { zh: '已拒绝', en: 'Rejected' },
  humanReviewed: { zh: '人工评分', en: 'Human Reviewed' },
  watchAvailable: { zh: '可观看', en: 'Watch Available' },
  watchUnavailable: { zh: '不可观看', en: 'Watch Unavailable' },
  popularityVerified: { zh: '热度已验证', en: 'Popularity Verified' },
  popularityUnknown: { zh: '热度未知', en: 'Popularity Unknown' },
  poolProgress: { zh: '候选池进度', en: 'Pool Progress' },
  workTypes: { zh: '作品类型分布', en: 'Work Types' },
  search: { zh: '搜索作品...', en: 'Search works...' },
  refresh: { zh: '刷新', en: 'Refresh' },
  edit: { zh: '编辑', en: 'Edit' },
  delete: { zh: '删除', en: 'Delete' },
  confirmDelete: { zh: '确认删除', en: 'Confirm Delete' },
  cancelDelete: { zh: '取消删除', en: 'Cancel Delete' },
  restore: { zh: '恢复', en: 'Restore' },
  auditLog: { zh: '审计日志', en: 'Audit Log' },
  addWatchSource: { zh: '+ 添加观看链接', en: '+ Add Watch Source' },
  title: { zh: '标题', en: 'Title' },
  creator: { zh: '创作者', en: 'Creator' },
  type: { zh: '类型', en: 'Type' },
  year: { zh: '年份', en: 'Year' },
  synopsis: { zh: '简介', en: 'Synopsis' },
  country: { zh: '国家', en: 'Country' },
  save: { zh: '保存', en: 'Save' },
  cancel: { zh: '取消', en: 'Cancel' },
  close: { zh: '关闭', en: 'Close' },
  url: { zh: '链接地址', en: 'URL' },
  sourceType: { zh: '来源类型', en: 'Source Type' },
  role: { zh: '角色', en: 'Role' },
  status: { zh: '状态', en: 'Status' },
  rating: { zh: '评分', en: 'Rating' },
  origin: { zh: '来源', en: 'Origin' },
  watch: { zh: '观看', en: 'Watch' },
  noWorks: { zh: '暂无作品', en: 'No works found' },
  loading: { zh: '加载中...', en: 'Loading...' },
  golden: { zh: '黄金数据集', en: 'Golden' },
  shortFilm: { zh: '短片', en: 'Short Film' },
  featureFilm: { zh: '长片', en: 'Feature' },
  documentary: { zh: '纪录片', en: 'Documentary' },
  experimental: { zh: '实验', en: 'Experimental' },
  series: { zh: '剧集', en: 'Series' },
  generatePoster: { zh: '生成海报', en: 'Generate Poster' },
  generateAllPosters: { zh: '批量生成海报', en: 'Generate All Posters' },
  poster: { zh: '海报', en: 'Poster' },
  noPoster: { zh: '暂无海报', en: 'No Poster' },
  generating: { zh: '生成中...', en: 'Generating...' },
};

function t(label: keyof typeof L, lang: 'zh' | 'en') {
  return L[label][lang];
}

// ============================================
// 主组件 / Main Component
// ============================================
export function AdminPage() {
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('adminToken'));
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'works'>('dashboard');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Data states
  const [works, setWorks] = useState<WorkItem[]>([]);
  const [worksFilter, setWorksFilter] = useState('');
  const [p35Status, setP35Status] = useState<any>(null);

  // Modal states
const [editingWork, setEditingWork] = useState<WorkItem | null>(null);
const [editingWatchSource, setEditingWatchSource] = useState<{ workId: number; source?: any } | null>(null);
const [viewingAuditLog, setViewingAuditLog] = useState<number | null>(null);
const [auditLogs, setAuditLogs] = useState<any[]>([]);
const [generatingPoster, setGeneratingPoster] = useState<number | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadPhase35Status();
    }
  }, [isAuthenticated]);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 4000);
  };

  const loadWorks = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getWorks(token);
      if (data.success) {
        setWorks(data.works);
      } else {
        showMessage(data.error || '加载失败');
      }
    } catch (err) {
      showMessage('网络错误，请检查连接');
    } finally {
      setLoading(false);
    }
  };

  const loadPhase35Status = async () => {
    try {
      const data = await adminApi.getPhase35PoolStatus(token);
      if (data.success) setP35Status(data.status);
    } catch (err) {
      console.error('Failed to load Phase 35 status', err);
    }
  };

  const handleLogin = () => {
    localStorage.setItem('adminToken', token);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
    setToken('');
  };

  const handleSaveWork = async (workId: number, updates: object) => {
    try {
      const result = await adminApi.updateWork(token, workId, updates);
      if (result.success) {
        showMessage('保存成功');
        setEditingWork(null);
        loadWorks();
        loadPhase35Status();
      } else {
        showMessage(result.message || '保存失败');
      }
    } catch {
      showMessage('保存失败');
    }
  };

  const handleRequestDelete = async (work: WorkItem) => {
    if (!confirm(`确定要删除作品「${work.canonical_title}」吗？\n此操作需要二次确认。`)) return;
    try {
      const result = await adminApi.requestDeleteWork(token, work.id, '管理员手动删除');
      if (result.success) {
        showMessage(result.message);
        loadWorks();
      } else {
        showMessage(result.message || '删除请求失败');
      }
    } catch {
      showMessage('删除请求失败');
    }
  };

  const handleConfirmDelete = async (work: WorkItem) => {
    if (!confirm(`最终确认：永久删除作品「${work.canonical_title}」？\n此操作不可撤销！`)) return;
    try {
      const result = await adminApi.confirmDeleteWork(token, work.id, `CONFIRM_DELETE_${work.id}`);
      if (result.success) {
        showMessage('作品已删除');
        loadWorks();
        loadPhase35Status();
      } else {
        showMessage(result.message || '删除失败');
      }
    } catch {
      showMessage('删除失败');
    }
  };

  const handleCancelDelete = async (workId: number) => {
    try {
      const result = await adminApi.cancelDeleteWork(token, workId);
      if (result.success) {
        showMessage('已取消删除');
        loadWorks();
      }
    } catch {
      showMessage('取消失败');
    }
  };

  const handleRestoreWork = async (workId: number) => {
    try {
      const result = await adminApi.restoreWork(token, workId);
      if (result.success) {
        showMessage('作品已恢复');
        loadWorks();
        loadPhase35Status();
      }
    } catch {
      showMessage('恢复失败');
    }
  };

  const handleGeneratePoster = async (workId: number) => {
    setGeneratingPoster(workId);
    try {
      const result = await adminApi.generateThumbnail(token, workId);
      if (result.success) {
        showMessage('海报生成成功');
        loadWorks();
      } else {
        showMessage(result.error || '海报生成失败');
      }
    } catch {
      showMessage('海报生成失败');
    } finally {
      setGeneratingPoster(null);
    }
  };

  const handleGenerateAllPosters = async () => {
    if (!confirm('确定要为所有缺少海报的作品生成海报吗？这可能需要较长时间。')) return;
    setLoading(true);
    try {
      const result = await adminApi.generateAllThumbnails(token);
      if (result.success) {
        showMessage(`海报生成完成：${result.result.generated} 成功, ${result.result.failed} 失败`);
        loadWorks();
      } else {
        showMessage(result.error || '批量生成失败');
      }
    } catch {
      showMessage('批量生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWatchSource = async (data: object) => {
    try {
      const result = editingWatchSource?.source
        ? await adminApi.updateWatchSource(token, editingWatchSource.source.id, data)
        : await adminApi.addWatchSource(token, { ...data, work_id: editingWatchSource?.workId });
      if (result.success) {
        showMessage('保存成功');
        setEditingWatchSource(null);
        loadWorks();
      } else {
        showMessage(result.message || '保存失败');
      }
    } catch {
      showMessage('保存失败');
    }
  };

  const handleDeleteWatchSource = async (sourceId: number) => {
    if (!confirm('确定删除这个观看链接？')) return;
    try {
      const result = await adminApi.deleteWatchSource(token, sourceId);
      if (result.success) {
        showMessage('已删除');
        loadWorks();
      }
    } catch {
      showMessage('删除失败');
    }
  };

  const loadAuditLog = async (workId: number) => {
    try {
      const data = await adminApi.getAuditLog(token, workId);
      if (data.success) setAuditLogs(data.logs);
    } catch {
      showMessage('加载日志失败');
    }
  };

  const filteredWorks = works.filter(w =>
    w.canonical_title?.toLowerCase().includes(worksFilter.toLowerCase()) ||
    (w.creator_name && w.creator_name.toLowerCase().includes(worksFilter.toLowerCase()))
  );

  const getTypeLabel = (type?: string) => {
    const map: Record<string, string> = {
      SHORT_FILM: t('shortFilm', lang),
      FEATURE_FILM: t('featureFilm', lang),
      DOCUMENTARY: t('documentary', lang),
      EXPERIMENTAL: t('experimental', lang),
      SERIES: t('series', lang),
    };
    return map[type || ''] || type || '-';
  };

  // ==================== Login Screen ====================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="w-full max-w-md p-8 bg-gray-900 rounded-xl shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">{t('login', lang)}</h1>
            <div className="flex bg-gray-800 rounded-lg overflow-hidden">
              <button onClick={() => setLang('zh')} className={`px-3 py-1 text-sm ${lang === 'zh' ? 'bg-blue-600' : ''}`}>中</button>
              <button onClick={() => setLang('en')} className={`px-3 py-1 text-sm ${lang === 'en' ? 'bg-blue-600' : ''}`}>EN</button>
            </div>
          </div>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t('tokenPlaceholder', lang)}
            className="w-full px-4 py-3 bg-gray-800 rounded-lg border border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button
            onClick={handleLogin}
            className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            {t('loginBtn', lang)}
          </button>
        </div>
      </div>
    );
  }

  // ==================== Main Dashboard ====================
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold">AI Film Chart {t('dashboard', lang)}</h1>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">Admin</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex bg-gray-800 rounded-lg overflow-hidden">
                <button onClick={() => setLang('zh')} className={`px-3 py-1 text-sm ${lang === 'zh' ? 'bg-blue-600' : ''}`}>中</button>
                <button onClick={() => setLang('en')} className={`px-3 py-1 text-sm ${lang === 'en' ? 'bg-blue-600' : ''}`}>EN</button>
              </div>
              <button onClick={handleLogout} className="px-4 py-2 bg-red-900 hover:bg-red-800 rounded-lg text-sm transition-colors">
                {t('logout', lang)}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Message Toast */}
        {message && (
          <div className="mb-4 p-4 bg-blue-900 rounded-lg text-sm relative animate-fade-in">
            {message}
            <button onClick={() => setMessage(null)} className="absolute right-3 top-3 text-blue-300 hover:text-white">✕</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex space-x-2 mb-6 border-b border-gray-800 pb-4">
          {([
            { key: 'dashboard', label: t('dashboard', lang) },
            { key: 'works', label: t('works', lang) },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                if (tab.key === 'works') loadWorks();
              }}
              className={`px-5 py-2.5 rounded-lg font-medium transition-colors ${
                activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ==================== DASHBOARD TAB ==================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Phase 35 Status Card */}
            {p35Status && (
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h2 className="text-lg font-semibold mb-4 flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                  Phase 35: Initial AI Cinema Pool
                </h2>

                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">{t('poolProgress', lang)}</span>
                    <span className="font-medium">{p35Status.currentWorks} / {p35Status.target}</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (p35Status.currentWorks / p35Status.target) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <StatCard value={p35Status.verified} label={t('verified', lang)} color="green" />
                  <StatCard value={p35Status.reviewNeeded} label={t('reviewNeeded', lang)} color="yellow" />
                  <StatCard value={p35Status.rejected} label={t('rejected', lang)} color="red" />
                  <StatCard value={p35Status.humanReviewed} label={t('humanReviewed', lang)} color="blue" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard value={p35Status.watchAvailable} label={t('watchAvailable', lang)} color="default" />
                  <StatCard value={p35Status.watchUnavailable} label={t('watchUnavailable', lang)} color="gray" />
                  <StatCard value={p35Status.popularityVerified} label={t('popularityVerified', lang)} color="default" />
                  <StatCard value={p35Status.popularityUnknown} label={t('popularityUnknown', lang)} color="gray" />
                </div>

                {/* Work Types */}
                {p35Status.workTypes && Object.keys(p35Status.workTypes).length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-800">
                    <h3 className="text-sm text-gray-400 mb-3">{t('workTypes', lang)}</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(p35Status.workTypes).map(([type, count]) => (
                        <span key={type} className="px-4 py-2 bg-gray-800 rounded-lg text-sm border border-gray-700">
                          {getTypeLabel(type)}: <span className="font-bold text-white">{count as number}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!p35Status && (
              <div className="bg-gray-900 rounded-xl p-12 text-center text-gray-500">
                {t('loading', lang)}
              </div>
            )}
          </div>
        )}

        {/* ==================== WORKS TAB ==================== */}
        {activeTab === 'works' && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex items-center space-x-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={worksFilter}
                  onChange={(e) => setWorksFilter(e.target.value)}
                  placeholder={t('search', lang)}
                  className="w-full px-4 py-3 bg-gray-900 rounded-lg border border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none pl-10"
                />
                <span className="absolute left-3 top-3.5 text-gray-500">🔍</span>
              </div>
              <button onClick={loadWorks} className="px-5 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors whitespace-nowrap">
                {t('refresh', lang)}
              </button>
              <button onClick={handleGenerateAllPosters} className="px-5 py-3 bg-purple-700 hover:bg-purple-600 rounded-lg transition-colors whitespace-nowrap">
                {t('generateAllPosters', lang)}
              </button>
            </div>

            {loading && (
              <div className="text-center py-12 text-gray-500">{t('loading', lang)}</div>
            )}

            {!loading && filteredWorks.length === 0 && (
              <div className="text-center py-12 text-gray-500 bg-gray-900 rounded-xl">{t('noWorks', lang)}</div>
            )}

            {/* Works List */}
            <div className="space-y-3">
              {filteredWorks.map((work) => (
                <div
                  key={work.id}
                  className={`bg-gray-900 rounded-xl p-5 border ${
                    work.eligibility_status === 'pending_removal' ? 'border-red-700' : 'border-gray-800'
                  } hover:border-gray-700 transition-colors`}
                >
                  {/* Work Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4 flex-1 min-w-0">
                      {/* Poster */}
                      <div className="flex-shrink-0">
                        {work.poster_url ? (
                          <img
                            src={work.poster_url}
                            alt={work.canonical_title}
                            className="w-20 h-28 object-cover rounded-lg border border-gray-700"
                            loading="lazy"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-20 h-28 bg-gray-800 rounded-lg border border-gray-700 flex flex-col items-center justify-center text-gray-600 text-xs">
                            <span className="text-2xl mb-1">🎬</span>
                            <span>{t('noPoster', lang)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-lg truncate">{work.canonical_title}</h3>
                          <StatusBadge status={work.eligibility_status} lang={lang} />
                          {work.validation_eligible === 1 && (
                            <span className="px-2 py-0.5 rounded text-xs bg-purple-900 text-purple-300 border border-purple-700">
                              {t('golden', lang)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 mt-1">
                          {work.creator_name || 'Unknown'} · {getTypeLabel(work.type)} · {work.release_year || '-'} · {work.country || '-'}
                        </p>
                        {work.synopsis && (
                          <p className="text-sm text-gray-500 mt-2 line-clamp-2">{work.synopsis}</p>
                        )}
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                          <span>⭐ {t('rating', lang)}: {work.human_quality_rating ?? '-'}</span>
                          <span>📋 {t('origin', lang)}: {work.review_origin ?? '-'}</span>
                          <span>🔗 {t('watch', lang)}: {work.watch_sources.length}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button onClick={() => setEditingWork(work)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors">
                        {t('edit', lang)}
                      </button>
                      <button
                        onClick={() => handleGeneratePoster(work.id)}
                        disabled={generatingPoster === work.id}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 rounded-lg text-sm transition-colors"
                      >
                        {generatingPoster === work.id ? t('generating', lang) : t('generatePoster', lang)}
                      </button>
                      <button
                        onClick={() => { setViewingAuditLog(work.id); loadAuditLog(work.id); }}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                      >
                        {t('auditLog', lang)}
                      </button>
                      {work.eligibility_status === 'pending_removal' ? (
                        <>
                          <button onClick={() => handleConfirmDelete(work)} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors">
                            {t('confirmDelete', lang)}
                          </button>
                          <button onClick={() => handleCancelDelete(work.id)} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition-colors">
                            {t('cancelDelete', lang)}
                          </button>
                        </>
                      ) : work.eligibility_status === 'removed' ? (
                        <button onClick={() => handleRestoreWork(work.id)} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition-colors">
                          {t('restore', lang)}
                        </button>
                      ) : (
                        <button onClick={() => handleRequestDelete(work)} className="px-3 py-1.5 bg-red-900 hover:bg-red-800 rounded-lg text-sm transition-colors">
                          {t('delete', lang)}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Watch Sources */}
                  {work.watch_sources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-800 space-y-2">
                      {work.watch_sources.map((source) => (
                        <div key={source.id} className="flex items-center justify-between bg-gray-800 rounded-lg p-3 text-sm">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="px-2 py-0.5 rounded text-xs bg-gray-700">{source.source_type}</span>
                            <span className="px-2 py-0.5 rounded text-xs bg-gray-700">{source.source_role}</span>
                            <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 truncate">
                              {source.url}
                            </a>
                          </div>
                          <div className="flex gap-1 flex-shrink-0 ml-2">
                            <button onClick={() => setEditingWatchSource({ workId: work.id, source })} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">{t('edit', lang)}</button>
                            <button onClick={() => handleDeleteWatchSource(source.id)} className="px-2 py-1 bg-red-900 hover:bg-red-800 rounded text-xs">{t('delete', lang)}</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setEditingWatchSource({ workId: work.id })} className="mt-3 text-sm text-blue-400 hover:text-blue-300">
                    {t('addWatchSource', lang)}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ==================== EDIT WORK MODAL ==================== */}
      {editingWork && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-700">
            <h2 className="text-xl font-bold mb-4">{t('edit', lang)}: {editingWork.canonical_title}</h2>
            <div className="space-y-4">
              <FormField label={t('title', lang)}>
                <input type="text" defaultValue={editingWork.canonical_title} id="edit-title" className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none" />
              </FormField>
              <FormField label={t('creator', lang)}>
                <input type="text" defaultValue={editingWork.creator_name || ''} id="edit-creator" className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none" />
              </FormField>
              <FormField label={t('synopsis', lang)}>
                <textarea defaultValue={editingWork.synopsis || ''} id="edit-synopsis" rows={3} className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none" />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t('type', lang)}>
                  <select id="edit-type" defaultValue={editingWork.type || 'SHORT_FILM'} className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none">
                    <option value="SHORT_FILM">{t('shortFilm', lang)}</option>
                    <option value="FEATURE_FILM">{t('featureFilm', lang)}</option>
                    <option value="DOCUMENTARY">{t('documentary', lang)}</option>
                    <option value="EXPERIMENTAL">{t('experimental', lang)}</option>
                    <option value="SERIES">{t('series', lang)}</option>
                  </select>
                </FormField>
                <FormField label={t('year', lang)}>
                  <input type="number" id="edit-year" defaultValue={editingWork.release_year || ''} className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none" />
                </FormField>
              </div>
              <FormField label={t('country', lang)}>
                <input type="text" id="edit-country" defaultValue={editingWork.country || ''} className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none" />
              </FormField>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => {
                handleSaveWork(editingWork.id, {
                  canonical_title: (document.getElementById('edit-title') as HTMLInputElement).value,
                  creator_name: (document.getElementById('edit-creator') as HTMLInputElement).value,
                  synopsis: (document.getElementById('edit-synopsis') as HTMLTextAreaElement).value,
                  type: (document.getElementById('edit-type') as HTMLSelectElement).value,
                  release_year: parseInt((document.getElementById('edit-year') as HTMLInputElement).value) || undefined,
                  country: (document.getElementById('edit-country') as HTMLInputElement).value || undefined,
                });
              }} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">{t('save', lang)}</button>
              <button onClick={() => setEditingWork(null)} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors">{t('cancel', lang)}</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== EDIT WATCH SOURCE MODAL ==================== */}
      {editingWatchSource && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <h2 className="text-xl font-bold mb-4">{editingWatchSource.source ? t('edit', lang) : t('addWatchSource', lang)}</h2>
            <div className="space-y-4">
              <FormField label={t('url', lang)}>
                <input type="text" defaultValue={editingWatchSource.source?.url || ''} id="ws-url" className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none" placeholder="https://..." />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t('sourceType', lang)}>
                  <select id="ws-type" defaultValue={editingWatchSource.source?.source_type || 'YOUTUBE'} className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none">
                    <option value="YOUTUBE">YouTube</option>
                    <option value="VIMEO">Vimeo</option>
                    <option value="RUNWAY">Runway</option>
                    <option value="OFFICIAL">Official</option>
                    <option value="OTHER">Other</option>
                  </select>
                </FormField>
                <FormField label={t('role', lang)}>
                  <select id="ws-role" defaultValue={editingWatchSource.source?.source_role || 'WATCH'} className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none">
                    <option value="WATCH">Watch</option>
                    <option value="METADATA">Metadata</option>
                    <option value="RECOGNITION">Recognition</option>
                  </select>
                </FormField>
              </div>
              <FormField label={t('status', lang)}>
                <select id="ws-status" defaultValue={editingWatchSource.source?.watch_status || 'ACTIVE'} className="w-full px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none">
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING">Pending</option>
                  <option value="BROKEN">Broken</option>
                </select>
              </FormField>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => {
                handleSaveWatchSource({
                  url: (document.getElementById('ws-url') as HTMLInputElement).value,
                  source_type: (document.getElementById('ws-type') as HTMLSelectElement).value,
                  source_role: (document.getElementById('ws-role') as HTMLSelectElement).value,
                  watch_status: (document.getElementById('ws-status') as HTMLSelectElement).value,
                });
              }} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">{t('save', lang)}</button>
              <button onClick={() => setEditingWatchSource(null)} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors">{t('cancel', lang)}</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== AUDIT LOG MODAL ==================== */}
      {viewingAuditLog && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto border border-gray-700">
            <h2 className="text-xl font-bold mb-4">{t('auditLog', lang)} (ID: {viewingAuditLog})</h2>
            <div className="space-y-2">
              {auditLogs.length === 0 && <div className="text-gray-500 text-center py-8">无日志记录</div>}
              {auditLogs.map((log) => (
                <div key={log.id} className="bg-gray-800 rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-blue-400">{log.action}</span>
                    <span className="text-xs text-gray-500">{log.created_at}</span>
                  </div>
                  <div className="text-gray-400 mt-1">Admin: {log.admin_id}</div>
                  {log.old_value && <div className="text-xs text-gray-500 mt-1">旧: {log.old_value.substring(0, 100)}...</div>}
                  {log.new_value && <div className="text-xs text-gray-500">新: {log.new_value.substring(0, 100)}...</div>}
                </div>
              ))}
            </div>
            <button onClick={() => setViewingAuditLog(null)} className="mt-4 w-full py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors">{t('close', lang)}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// 子组件 / Sub Components
// ============================================

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  const colorClasses: Record<string, string> = {
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    gray: 'text-gray-400',
    default: 'text-white',
  };
  return (
    <div className="bg-gray-800 rounded-lg p-4 text-center">
      <div className={`text-2xl font-bold ${colorClasses[color] || 'text-white'}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function StatusBadge({ status, lang }: { status: string; lang: 'zh' | 'en' }) {
  const statusMap: Record<string, { text: string; className: string }> = {
    approved: { text: lang === 'zh' ? '已通过' : 'Approved', className: 'bg-green-900 text-green-300 border-green-700' },
    pending: { text: lang === 'zh' ? '待审核' : 'Pending', className: 'bg-yellow-900 text-yellow-300 border-yellow-700' },
    rejected: { text: lang === 'zh' ? '已拒绝' : 'Rejected', className: 'bg-red-900 text-red-300 border-red-700' },
    pending_removal: { text: lang === 'zh' ? '待删除' : 'Pending Removal', className: 'bg-red-900 text-red-300 border-red-700' },
    removed: { text: lang === 'zh' ? '已删除' : 'Removed', className: 'bg-gray-700 text-gray-300 border-gray-600' },
  };
  const s = statusMap[status] || { text: status, className: 'bg-gray-700 text-gray-300' };
  return (
    <span className={`px-2 py-0.5 rounded text-xs border ${s.className}`}>
      {s.text}
    </span>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
