import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import type { AdminDashboard, Candidate, Job } from '../types';

// Extended API for new admin features
const adminApi = {
  ...api,

  // Works management
  getWorks: (token: string) => fetch(`${(api as any).API_BASE || 'https://ai-film-chart-api.906402759lex.workers.dev'}/api/admin/works`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()),

  updateWork: (token: string, id: number, data: object) => fetch(`${(api as any).API_BASE || 'https://ai-film-chart-api.906402759lex.workers.dev'}/api/admin/works/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...data, admin_id: 'admin' }),
  }).then(r => r.json()),

  requestDeleteWork: (token: string, id: number, reason?: string) => fetch(`${(api as any).API_BASE || 'https://ai-film-chart-api.906402759lex.workers.dev'}/api/admin/works/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason, admin_id: 'admin' }),
  }).then(r => r.json()),

  confirmDeleteWork: (token: string, id: number, confirmationToken: string) => fetch(`${(api as any).API_BASE || 'https://ai-film-chart-api.906402759lex.workers.dev'}/api/admin/works/${id}/confirm-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ confirmation_token: confirmationToken, admin_id: 'admin' }),
  }).then(r => r.json()),

  cancelDeleteWork: (token: string, id: number) => fetch(`${(api as any).API_BASE || 'https://ai-film-chart-api.906402759lex.workers.dev'}/api/admin/works/${id}/cancel-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ admin_id: 'admin' }),
  }).then(r => r.json()),

  restoreWork: (token: string, id: number) => fetch(`${(api as any).API_BASE || 'https://ai-film-chart-api.906402759lex.workers.dev'}/api/admin/works/${id}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ admin_id: 'admin' }),
  }).then(r => r.json()),

  // Watch sources
  addWatchSource: (token: string, data: object) => fetch(`${(api as any).API_BASE || 'https://ai-film-chart-api.906402759lex.workers.dev'}/api/admin/watch-sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...data, admin_id: 'admin' }),
  }).then(r => r.json()),

  updateWatchSource: (token: string, id: number, data: object) => fetch(`${(api as any).API_BASE || 'https://ai-film-chart-api.906402759lex.workers.dev'}/api/admin/watch-sources/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...data, admin_id: 'admin' }),
  }).then(r => r.json()),

  deleteWatchSource: (token: string, id: number) => fetch(`${(api as any).API_BASE || 'https://ai-film-chart-api.906402759lex.workers.dev'}/api/admin/watch-sources/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ admin_id: 'admin' }),
  }).then(r => r.json()),

  // Reviews
  submitReview: (token: string, workId: number, data: object) => fetch(`${(api as any).API_BASE || 'https://ai-film-chart-api.906402759lex.workers.dev'}/api/admin/works/${workId}/review`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...data, admin_id: 'admin' }),
  }).then(r => r.json()),

  clearReview: (token: string, workId: number) => fetch(`${(api as any).API_BASE || 'https://ai-film-chart-api.906402759lex.workers.dev'}/api/admin/works/${workId}/review`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ admin_id: 'admin' }),
  }).then(r => r.json()),

  // Phase 34
  getReviewQueue: (token: string) => fetch(`${(api as any).API_BASE || 'https://ai-film-chart-api.906402759lex.workers.dev'}/api/admin/phase34/review-queue`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()),

  getPhase34Dashboard: (token: string) => fetch(`${(api as any).API_BASE || 'https://ai-film-chart-api.906402759lex.workers.dev'}/api/admin/phase34/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()),

  getPhase34RankingReadiness: (token: string) => fetch(`${(api as any).API_BASE || 'https://ai-film-chart-api.906402759lex.workers.dev'}/api/admin/phase34/ranking-readiness`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()),

  // Audit log
  getAuditLog: (token: string, workId: number) => fetch(`${(api as any).API_BASE || 'https://ai-film-chart-api.906402759lex.workers.dev'}/api/admin/works/${workId}/audit-log`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()),

  // Phase 35
  getPhase35PoolStatus: (token: string) => fetch(`${(api as any).API_BASE || 'https://ai-film-chart-api.906402759lex.workers.dev'}/api/admin/phase35/pool-status`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()),
};

interface WorkItem {
  id: number;
  canonical_title: string;
  creator_name: string | null;
  eligibility_status: string;
  review_origin: string | null;
  human_quality_rating: number | null;
  validation_eligible: number;
  watch_sources: { id: number; url: string; source_role: string; watch_status: string; source_type: string }[];
}

interface ReviewQueueItem {
  workId: number;
  title: string;
  creator: string | null;
  watchUrl: string;
  contentType: string;
  synopsis: string | null;
  reviewStatus: string;
}

export function AdminPage() {
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('adminToken'));
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'works' | 'review_queue' | 'candidates' | 'jobs'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Works state
  const [works, setWorks] = useState<WorkItem[]>([]);
  const [worksFilter, setWorksFilter] = useState('');
  const [editingWork, setEditingWork] = useState<WorkItem | null>(null);
  const [editingWatchSource, setEditingWatchSource] = useState<{ workId: number; source?: any } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<WorkItem | null>(null);
  const [viewingAuditLog, setViewingAuditLog] = useState<number | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Review queue state
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [reviewingWork, setReviewingWork] = useState<ReviewQueueItem | null>(null);
  const [reviewForm, setReviewForm] = useState({ rating: 3, classification: 'KEEP' as const, notes: '' });

  // Phase 34 dashboard
  const [p34Dashboard, setP34Dashboard] = useState<any>(null);
  const [p34Readiness, setP34Readiness] = useState<any>(null);

  // Phase 35 state
  const [p35Status, setP35Status] = useState<any>(null);
  const [p35Loading, setP35Loading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboard();
      loadPhase34Data();
      loadPhase35Status();
    }
  }, [isAuthenticated]);

  const loadPhase35Status = async () => {
    try {
      const data = await adminApi.getPhase35PoolStatus(token);
      if (data.success) setP35Status(data.status);
    } catch (err) {
      console.error('Failed to load Phase 35 status', err);
    }
  };

  const loadDashboard = async () => {
    try {
      const data = await api.getDashboard(token) as AdminDashboard;
      setDashboard(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load dashboard');
    }
  };

  const loadPhase34Data = async () => {
    try {
      const [dash, readiness] = await Promise.all([
        adminApi.getPhase34Dashboard(token),
        adminApi.getPhase34RankingReadiness(token),
      ]);
      if (dash.success) setP34Dashboard(dash.dashboard);
      if (readiness.success) setP34Readiness(readiness.readiness);
    } catch (err) {
      console.error('Failed to load Phase 34 data', err);
    }
  };

  const loadWorks = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getWorks(token);
      if (data.success) setWorks(data.works);
    } catch (err) {
      setMessage('Failed to load works');
    } finally {
      setLoading(false);
    }
  };

  const loadReviewQueue = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getReviewQueue(token);
      if (data.success) setReviewQueue(data.queue);
    } catch (err) {
      setMessage('Failed to load review queue');
    } finally {
      setLoading(false);
    }
  };

  const loadCandidates = async (status?: string) => {
    try {
      const data = await api.getCandidates(token, status) as { candidates: Candidate[] };
      setCandidates(data.candidates);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load candidates');
    }
  };

  const loadJobs = async () => {
    try {
      const data = await api.getJobs(token) as { jobs: Job[] };
      setJobs(data.jobs);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load jobs');
    }
  };

  const handleLogin = () => {
    localStorage.setItem('adminToken', token);
    setIsAuthenticated(true);
  };

  const handleAction = async (action: string) => {
    setLoading(true);
    setMessage(null);
    try {
      switch (action) {
        case 'seed':
          await api.seedMockData(token);
          setMessage('Mock data seeded successfully');
          break;
        case 'discovery':
          await api.runDiscovery(token);
          setMessage('Discovery job started');
          break;
        case 'ranking':
          await api.runRanking(token);
          setMessage('Ranking completed');
          break;
      }
      await loadDashboard();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCandidateAction = async (id: number, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') {
        await api.approveCandidate(token, id);
      } else {
        await api.rejectCandidate(token, id);
      }
      await loadCandidates();
      setMessage(`Candidate ${action}d successfully`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Action failed');
    }
  };

  // Work edit handlers
  const handleSaveWork = async (workId: number, updates: object) => {
    try {
      const result = await adminApi.updateWork(token, workId, updates);
      if (result.success) {
        setMessage('Work updated successfully');
        setEditingWork(null);
        loadWorks();
      } else {
        setMessage(result.message || 'Update failed');
      }
    } catch (err) {
      setMessage('Failed to update work');
    }
  };

  const handleRequestDelete = async (work: WorkItem, reason?: string) => {
    try {
      const result = await adminApi.requestDeleteWork(token, work.id, reason);
      if (result.success) {
        setMessage(result.message);
        setConfirmingDelete(work);
        loadWorks();
      } else {
        setMessage(result.message || 'Delete request failed');
      }
    } catch (err) {
      setMessage('Failed to request deletion');
    }
  };

  const handleConfirmDelete = async (work: WorkItem) => {
    const confirmationToken = `CONFIRM_DELETE_${work.id}`;
    try {
      const result = await adminApi.confirmDeleteWork(token, work.id, confirmationToken);
      if (result.success) {
        setMessage(result.message);
        setConfirmingDelete(null);
        loadWorks();
      } else {
        setMessage(result.message || 'Confirmation failed');
      }
    } catch (err) {
      setMessage('Failed to confirm deletion');
    }
  };

  const handleCancelDelete = async (workId: number) => {
    try {
      const result = await adminApi.cancelDeleteWork(token, workId);
      if (result.success) {
        setMessage('Deletion cancelled');
        setConfirmingDelete(null);
        loadWorks();
      }
    } catch (err) {
      setMessage('Failed to cancel deletion');
    }
  };

  const handleRestoreWork = async (workId: number) => {
    try {
      const result = await adminApi.restoreWork(token, workId);
      if (result.success) {
        setMessage('Work restored');
        loadWorks();
      }
    } catch (err) {
      setMessage('Failed to restore work');
    }
  };

  // Watch source handlers
  const handleSaveWatchSource = async (data: object) => {
    try {
      const result = editingWatchSource?.source
        ? await adminApi.updateWatchSource(token, editingWatchSource.source.id, data)
        : await adminApi.addWatchSource(token, { ...data, work_id: editingWatchSource?.workId });
      if (result.success) {
        setMessage('Watch source saved');
        setEditingWatchSource(null);
        loadWorks();
      } else {
        setMessage(result.message || 'Save failed');
      }
    } catch (err) {
      setMessage('Failed to save watch source');
    }
  };

  const handleDeleteWatchSource = async (sourceId: number) => {
    if (!confirm('Delete this watch source?')) return;
    try {
      const result = await adminApi.deleteWatchSource(token, sourceId);
      if (result.success) {
        setMessage('Watch source deleted');
        loadWorks();
      }
    } catch (err) {
      setMessage('Failed to delete watch source');
    }
  };

  // Review handlers
  const handleSubmitReview = async (workId: number) => {
    try {
      const result = await adminApi.submitReview(token, workId, {
        human_quality_rating: reviewForm.rating,
        human_classification: reviewForm.classification,
        review_notes: reviewForm.notes,
        review_origin: 'HUMAN',
      });
      if (result.success) {
        setMessage('Review submitted successfully');
        setReviewingWork(null);
        setReviewForm({ rating: 3, classification: 'KEEP', notes: '' });
        loadReviewQueue();
        loadPhase34Data();
      } else {
        setMessage(result.message || 'Review submission failed');
      }
    } catch (err) {
      setMessage('Failed to submit review');
    }
  };

  // Audit log
  const loadAuditLog = async (workId: number) => {
    try {
      const data = await adminApi.getAuditLog(token, workId);
      if (data.success) setAuditLogs(data.logs);
    } catch (err) {
      setMessage('Failed to load audit log');
    }
  };

  const filteredWorks = works.filter(w =>
    w.canonical_title.toLowerCase().includes(worksFilter.toLowerCase()) ||
    (w.creator_name && w.creator_name.toLowerCase().includes(worksFilter.toLowerCase()))
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="w-full max-w-md p-6 bg-gray-900 rounded-lg">
          <h1 className="text-2xl font-bold mb-4">Admin Login</h1>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter admin token"
            className="w-full px-4 py-2 bg-gray-800 rounded border border-gray-700 text-white placeholder-gray-500"
          />
          <button
            onClick={handleLogin}
            className="w-full mt-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

        {message && (
          <div className="mb-4 p-4 bg-blue-900 rounded-lg text-sm relative">
            {message}
            <button onClick={() => setMessage(null)} className="absolute right-2 top-2 text-blue-300 hover:text-white">✕</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex space-x-2 mb-6 border-b border-gray-800 pb-4 overflow-x-auto">
          {([
            { key: 'dashboard', label: 'Dashboard' },
            { key: 'works', label: 'Works' },
            { key: 'review_queue', label: 'Review Queue' },
            { key: 'candidates', label: 'Candidates' },
            { key: 'jobs', label: 'Jobs' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                if (tab.key === 'works') loadWorks();
                if (tab.key === 'review_queue') loadReviewQueue();
                if (tab.key === 'candidates') loadCandidates();
                if (tab.key === 'jobs') loadJobs();
              }}
              className={`px-4 py-2 rounded font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Phase 34 Status */}
            {p34Dashboard && (
              <div className="bg-gray-900 rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-4">Phase 34: Real Review Status</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-2xl font-bold">{p34Dashboard.totalWorks}</div>
                    <div className="text-sm text-gray-400">Total Works</div>
                  </div>
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-2xl font-bold text-green-400">{p34Dashboard.humanReviewed}</div>
                    <div className="text-sm text-gray-400">Human Reviewed</div>
                  </div>
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-2xl font-bold text-yellow-400">{p34Dashboard.syntheticReviewed}</div>
                    <div className="text-sm text-gray-400">Synthetic</div>
                  </div>
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-2xl font-bold text-blue-400">{p34Dashboard.verifiedWatchSources}</div>
                    <div className="text-sm text-gray-400">Watch Sources</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-2xl font-bold text-purple-400">{p34Dashboard.goldenDatasetHuman}</div>
                    <div className="text-sm text-gray-400">Golden Dataset</div>
                  </div>
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-2xl font-bold">{p34Dashboard.reviewReady}</div>
                    <div className="text-sm text-gray-400">Review Ready</div>
                  </div>
                  <div className="bg-gray-800 rounded p-3 col-span-2">
                    <div className="text-lg font-bold">{p34Dashboard.rankingReadiness}</div>
                    <div className="text-sm text-gray-400">Ranking Readiness</div>
                  </div>
                </div>
              </div>
            )}

            {p34Readiness && (
              <div className="bg-gray-900 rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-2">Ranking Thresholds</h2>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Early Preview', threshold: p34Readiness.thresholds.earlyPreview, current: p34Readiness.humanReviewed },
                    { label: 'Early Experiment', threshold: p34Readiness.thresholds.earlyExperiment, current: p34Readiness.humanReviewed },
                    { label: 'Seed Validation', threshold: p34Readiness.thresholds.seedValidation, current: p34Readiness.humanReviewed },
                    { label: 'Stable Evaluation', threshold: p34Readiness.thresholds.stableEvaluation, current: p34Readiness.humanReviewed },
                  ].map(t => (
                    <div key={t.label} className={`px-3 py-2 rounded text-sm ${t.current >= t.threshold ? 'bg-green-900 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                      {t.label}: {t.current}/{t.threshold}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Phase 35: Initial 100 Status */}
            {p35Status && (
              <div className="bg-gray-900 rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-4">Phase 35: Initial AI Cinema Pool</h2>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Pool Progress</span>
                    <span className="text-sm font-medium">{p35Status.currentWorks} / {p35Status.target}</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (p35Status.currentWorks / p35Status.target) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-2xl font-bold text-green-400">{p35Status.verified}</div>
                    <div className="text-sm text-gray-400">Verified</div>
                  </div>
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-2xl font-bold text-yellow-400">{p35Status.reviewNeeded}</div>
                    <div className="text-sm text-gray-400">Review Needed</div>
                  </div>
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-2xl font-bold text-red-400">{p35Status.rejected}</div>
                    <div className="text-sm text-gray-400">Rejected</div>
                  </div>
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-2xl font-bold text-blue-400">{p35Status.humanReviewed}</div>
                    <div className="text-sm text-gray-400">Human Reviewed</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-xl font-bold">{p35Status.watchAvailable}</div>
                    <div className="text-xs text-gray-400">Watch Available</div>
                  </div>
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-xl font-bold text-gray-400">{p35Status.watchUnavailable}</div>
                    <div className="text-xs text-gray-400">Watch Unavailable</div>
                  </div>
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-xl font-bold">{p35Status.popularityVerified}</div>
                    <div className="text-xs text-gray-400">Popularity Verified</div>
                  </div>
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-xl font-bold text-gray-400">{p35Status.popularityUnknown}</div>
                    <div className="text-xs text-gray-400">Popularity Unknown</div>
                  </div>
                </div>
                {p35Status.workTypes && Object.keys(p35Status.workTypes).length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm text-gray-400 mb-2">Work Types</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(p35Status.workTypes).map(([type, count]) => (
                        <span key={type} className="px-3 py-1 bg-gray-800 rounded text-sm">
                          {type}: <span className="font-medium">{count as number}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {dashboard && (
              <>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-2xl font-bold">{dashboard.stats.totalFilms}</div>
                    <div className="text-sm text-gray-400">Total Films</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-2xl font-bold text-yellow-400">{dashboard.stats.pending}</div>
                    <div className="text-sm text-gray-400">Pending</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-400">{dashboard.stats.approved}</div>
                    <div className="text-sm text-gray-400">Approved</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-2xl font-bold text-red-400">{dashboard.stats.rejected}</div>
                    <div className="text-sm text-gray-400">Rejected</div>
                  </div>
                </div>

                <div className="bg-gray-900 rounded-lg p-4">
                  <h2 className="text-lg font-semibold mb-4">Actions</h2>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => handleAction('seed')} disabled={loading} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium disabled:opacity-50">Seed Mock Data</button>
                    <button onClick={() => handleAction('discovery')} disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium disabled:opacity-50">Run Discovery</button>
                    <button onClick={() => handleAction('ranking')} disabled={loading} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded font-medium disabled:opacity-50">Run Ranking</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Works Tab */}
        {activeTab === 'works' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <input
                type="text"
                value={worksFilter}
                onChange={(e) => setWorksFilter(e.target.value)}
                placeholder="Search works..."
                className="flex-1 px-4 py-2 bg-gray-900 rounded border border-gray-700 text-white placeholder-gray-500"
              />
              <button onClick={loadWorks} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded">Refresh</button>
            </div>

            {loading && <div className="text-gray-400">Loading...</div>}

            <div className="space-y-3">
              {filteredWorks.map((work) => (
                <div key={work.id} className={`bg-gray-900 rounded-lg p-4 ${work.eligibility_status === 'pending_removal' ? 'border border-red-800' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-lg">{work.canonical_title}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          work.eligibility_status === 'approved' ? 'bg-green-900 text-green-400' :
                          work.eligibility_status === 'pending_removal' ? 'bg-red-900 text-red-400' :
                          'bg-gray-700 text-gray-400'
                        }`}>
                          {work.eligibility_status}
                        </span>
                        {work.validation_eligible === 1 && (
                          <span className="px-2 py-0.5 rounded text-xs bg-purple-900 text-purple-400">Golden</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">{work.creator_name || 'Unknown creator'}</p>
                      <div className="mt-1 flex items-center space-x-3 text-xs text-gray-500">
                        <span>Rating: {work.human_quality_rating ?? 'N/A'}</span>
                        <span>Origin: {work.review_origin ?? 'N/A'}</span>
                        <span>Watch: {work.watch_sources.length} source(s)</span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button onClick={() => setEditingWork(work)} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm">Edit</button>
                      <button onClick={() => { setViewingAuditLog(work.id); loadAuditLog(work.id); }} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">Log</button>
                      {work.eligibility_status === 'pending_removal' ? (
                        <>
                          <button onClick={() => handleConfirmDelete(work)} className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm">Confirm Delete</button>
                          <button onClick={() => handleCancelDelete(work.id)} className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm">Cancel</button>
                        </>
                      ) : work.eligibility_status === 'removed' ? (
                        <button onClick={() => handleRestoreWork(work.id)} className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm">Restore</button>
                      ) : (
                        <button onClick={() => handleRequestDelete(work)} className="px-3 py-1 bg-red-900 hover:bg-red-800 rounded text-sm">Delete</button>
                      )}
                    </div>
                  </div>

                  {/* Watch Sources */}
                  <div className="mt-3 space-y-2">
                    {work.watch_sources.map((source) => (
                      <div key={source.id} className="flex items-center justify-between bg-gray-800 rounded p-2 text-sm">
                        <div className="flex items-center space-x-2 overflow-hidden">
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-700">{source.source_type}</span>
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-700">{source.source_role}</span>
                          <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 truncate">{source.url}</a>
                        </div>
                        <div className="flex space-x-1 flex-shrink-0">
                          <button onClick={() => setEditingWatchSource({ workId: work.id, source })} className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-xs">Edit</button>
                          <button onClick={() => handleDeleteWatchSource(source.id)} className="px-2 py-0.5 bg-red-900 hover:bg-red-800 rounded text-xs">Del</button>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setEditingWatchSource({ workId: work.id })} className="text-sm text-blue-400 hover:text-blue-300">+ Add watch source</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Review Queue Tab */}
        {activeTab === 'review_queue' && (
          <div className="space-y-4">
            {loading && <div className="text-gray-400">Loading...</div>}
            {reviewQueue.length === 0 && !loading && (
              <div className="text-gray-400 text-center py-8">No works in review queue</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reviewQueue.map((item) => (
                <div key={item.workId} className="bg-gray-900 rounded-lg p-4">
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="text-sm text-gray-400">{item.creator || 'Unknown creator'}</p>
                  <p className="text-xs text-gray-500 mt-1">{item.contentType}</p>
                  <a href={item.watchUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:text-blue-300 mt-2 block truncate">
                    {item.watchUrl}
                  </a>
                  <button
                    onClick={() => setReviewingWork(item)}
                    className="mt-3 w-full py-2 bg-purple-600 hover:bg-purple-700 rounded font-medium"
                  >
                    Review This Work
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Candidates Tab */}
        {activeTab === 'candidates' && (
          <div className="space-y-4">
            <div className="flex space-x-2">
              {['pending', 'approved', 'rejected'].map((status) => (
                <button key={status} onClick={() => loadCandidates(status)} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm capitalize">{status}</button>
              ))}
            </div>
            <div className="space-y-3">
              {candidates.map((candidate) => (
                <div key={candidate.id} className="bg-gray-900 rounded-lg p-4">
                  <div className="flex items-start space-x-4">
                    <div className="w-24 h-16 bg-gray-800 rounded overflow-hidden flex-shrink-0">
                      {candidate.thumbnail_url ? (
                        <img src={candidate.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-600">No Image</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{candidate.title}</h3>
                      <p className="text-sm text-gray-400">{candidate.channel_name}</p>
                      <div className="mt-1 flex items-center space-x-3 text-xs text-gray-500">
                        <span>AI: {candidate.is_ai_film ? 'Yes' : 'No'}</span>
                        <span>Story: {candidate.is_story_content ? 'Yes' : 'No'}</span>
                        <span>Confidence: {(candidate.ai_confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button onClick={() => handleCandidateAction(candidate.id, 'approve')} className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm">Approve</button>
                      <button onClick={() => handleCandidateAction(candidate.id, 'reject')} className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm">Reject</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{job.type}</span>
                    <span className="ml-2 text-sm text-gray-400">{job.job_id}</span>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    job.status === 'completed' ? 'bg-green-900 text-green-400' :
                    job.status === 'failed' ? 'bg-red-900 text-red-400' :
                    job.status === 'processing' ? 'bg-blue-900 text-blue-400' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {job.status}
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  Progress: {job.progress}% | Batch: {job.batch_size}
                  {job.error_message && <div className="mt-1 text-red-400">{job.error_message}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Work Modal */}
      {editingWork && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Edit Work</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Title</label>
                <input type="text" defaultValue={editingWork.canonical_title} id="edit-title" className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Creator</label>
                <input type="text" defaultValue={editingWork.creator_name || ''} id="edit-creator" className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Synopsis</label>
                <textarea defaultValue={''} id="edit-synopsis" rows={3} className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Type</label>
                  <select id="edit-type" defaultValue={''} className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700">
                    <option value="SHORT_FILM">Short Film</option>
                    <option value="DOCUMENTARY">Documentary</option>
                    <option value="FEATURE">Feature</option>
                    <option value="EXPERIMENTAL">Experimental</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Year</label>
                  <input type="number" id="edit-year" defaultValue={''} className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700" />
                </div>
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => {
                handleSaveWork(editingWork.id, {
                  canonical_title: (document.getElementById('edit-title') as HTMLInputElement).value,
                  creator_name: (document.getElementById('edit-creator') as HTMLInputElement).value,
                  synopsis: (document.getElementById('edit-synopsis') as HTMLTextAreaElement).value,
                  type: (document.getElementById('edit-type') as HTMLSelectElement).value,
                  release_year: parseInt((document.getElementById('edit-year') as HTMLInputElement).value) || undefined,
                });
              }} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium">Save</button>
              <button onClick={() => setEditingWork(null)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Watch Source Modal */}
      {editingWatchSource && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">{editingWatchSource.source ? 'Edit' : 'Add'} Watch Source</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">URL</label>
                <input type="text" defaultValue={editingWatchSource.source?.url || ''} id="ws-url" className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700" placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Type</label>
                  <select id="ws-type" defaultValue={editingWatchSource.source?.source_type || 'YOUTUBE'} className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700">
                    <option value="YOUTUBE">YouTube</option>
                    <option value="VIMEO">Vimeo</option>
                    <option value="RUNWAY">Runway</option>
                    <option value="OFFICIAL">Official</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Role</label>
                  <select id="ws-role" defaultValue={editingWatchSource.source?.source_role || 'WATCH'} className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700">
                    <option value="WATCH">Watch</option>
                    <option value="METADATA">Metadata</option>
                    <option value="RECOGNITION">Recognition</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Status</label>
                <select id="ws-status" defaultValue={editingWatchSource.source?.watch_status || 'ACTIVE'} className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700">
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING">Pending</option>
                  <option value="BROKEN">Broken</option>
                </select>
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => {
                handleSaveWatchSource({
                  url: (document.getElementById('ws-url') as HTMLInputElement).value,
                  source_type: (document.getElementById('ws-type') as HTMLSelectElement).value,
                  source_role: (document.getElementById('ws-role') as HTMLSelectElement).value,
                  watch_status: (document.getElementById('ws-status') as HTMLSelectElement).value,
                });
              }} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium">Save</button>
              <button onClick={() => setEditingWatchSource(null)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewingWork && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-2">Review: {reviewingWork.title}</h2>
            <p className="text-sm text-gray-400 mb-4">by {reviewingWork.creator || 'Unknown'}</p>

            <div className="bg-gray-800 rounded p-3 mb-4 text-sm">
              <p className="text-gray-300">{reviewingWork.synopsis || 'No synopsis'}</p>
              <a href={reviewingWork.watchUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 mt-2 block">Open Watch URL ↗</a>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Quality Rating (1-5)</label>
                <div className="flex space-x-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setReviewForm({ ...reviewForm, rating: n })}
                      className={`w-10 h-10 rounded font-bold ${
                        reviewForm.rating === n ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {reviewForm.rating === 1 && 'Poor'}
                  {reviewForm.rating === 2 && 'Weak'}
                  {reviewForm.rating === 3 && 'Average'}
                  {reviewForm.rating === 4 && 'Good'}
                  {reviewForm.rating === 5 && 'Excellent'}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Classification</label>
                <div className="flex space-x-2">
                  {(['KEEP', 'REVIEW', 'REJECT'] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setReviewForm({ ...reviewForm, classification: c })}
                      className={`px-4 py-2 rounded text-sm font-medium ${
                        reviewForm.classification === c ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea
                  value={reviewForm.notes}
                  onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700"
                  placeholder="Your review notes..."
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button onClick={() => handleSubmitReview(reviewingWork.workId)} className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 rounded font-medium">Submit Review</button>
              <button onClick={() => setReviewingWork(null)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {viewingAuditLog && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Audit Log (Work ID: {viewingAuditLog})</h2>
            <div className="space-y-2">
              {auditLogs.length === 0 && <div className="text-gray-400">No audit logs found</div>}
              {auditLogs.map((log) => (
                <div key={log.id} className="bg-gray-800 rounded p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-blue-400">{log.action}</span>
                    <span className="text-xs text-gray-500">{log.created_at}</span>
                  </div>
                  <div className="text-gray-400 mt-1">Admin: {log.admin_id}</div>
                  {log.old_value && <div className="text-xs text-gray-500 mt-1">Old: {log.old_value.substring(0, 100)}...</div>}
                  {log.new_value && <div className="text-xs text-gray-500">New: {log.new_value.substring(0, 100)}...</div>}
                </div>
              ))}
            </div>
            <button onClick={() => setViewingAuditLog(null)} className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
