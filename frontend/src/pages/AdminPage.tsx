import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import type { AdminDashboard, Candidate, Job } from '../types';

export function AdminPage() {
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('adminToken'));
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'candidates' | 'jobs'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboard();
    }
  }, [isAuthenticated]);

  const loadDashboard = async () => {
    try {
      const data = await api.getDashboard(token) as AdminDashboard;
      setDashboard(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load dashboard');
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
          <div className="mb-4 p-4 bg-blue-900 rounded-lg text-sm">
            {message}
          </div>
        )}

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-gray-800 pb-4">
          {(['dashboard', 'candidates', 'jobs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'candidates') loadCandidates();
                if (tab === 'jobs') loadJobs();
              }}
              className={`px-4 py-2 rounded font-medium capitalize transition-colors ${
                activeTab === tab ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && dashboard && (
          <div className="space-y-6">
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
                <button
                  onClick={() => handleAction('seed')}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium disabled:opacity-50"
                >
                  Seed Mock Data
                </button>
                <button
                  onClick={() => handleAction('discovery')}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium disabled:opacity-50"
                >
                  Run Discovery
                </button>
                <button
                  onClick={() => handleAction('ranking')}
                  disabled={loading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded font-medium disabled:opacity-50"
                >
                  Run Ranking
                </button>
              </div>
            </div>

            {dashboard.recentJobs.length > 0 && (
              <div className="bg-gray-900 rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-4">Recent Jobs</h2>
                <div className="space-y-2">
                  {dashboard.recentJobs.slice(0, 5).map((job) => (
                    <div key={job.id} className="flex items-center justify-between text-sm p-2 bg-gray-800 rounded">
                      <div>
                        <span className="font-medium">{job.type}</span>
                        <span className="ml-2 text-gray-400">{job.job_id}</span>
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
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Candidates Tab */}
        {activeTab === 'candidates' && (
          <div className="space-y-4">
            <div className="flex space-x-2">
              {['pending', 'approved', 'rejected'].map((status) => (
                <button
                  key={status}
                  onClick={() => loadCandidates(status)}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm capitalize"
                >
                  {status}
                </button>
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
                      <button
                        onClick={() => handleCandidateAction(candidate.id, 'approve')}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleCandidateAction(candidate.id, 'reject')}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                      >
                        Reject
                      </button>
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
                  {job.error_message && (
                    <div className="mt-1 text-red-400">{job.error_message}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
