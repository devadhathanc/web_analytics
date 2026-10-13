'use client';

import React, { useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import UserJourneyModal from '../../components/UserJourneyModal';
import { API_BASE } from '../../lib/api';

export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sortField, setSortField] = useState('last_seen_at');
  const [sortDir, setSortDir] = useState(-1);

  const fetchSessions = async (searchQuery = '') => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/sessions?limit=100&search=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(() => fetchSessions(search), 4000);
    return () => clearInterval(interval);
  }, [search]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir((p) => p * -1);
    else { setSortField(field); setSortDir(-1); }
  };

  const sortedSessions = [...sessions].sort((a, b) => {
    const aVal = a[sortField] || 0;
    const bVal = b[sortField] || 0;
    if (typeof aVal === 'string') return sortDir * aVal.localeCompare(bVal);
    return sortDir * (aVal - bVal);
  });

  const formatDuration = (s) => {
    if (!s) return '0s';
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };

  const timeAgo = (iso) => {
    if (!iso) return '-';
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
  };

  const formatDate = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getDurationColor = (s) => {
    if (!s || s < 30) return 'duration-short';
    return s < 120 ? 'duration-medium' : 'duration-long';
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span style={{ opacity: 0.25, marginLeft: '3px', fontSize: '0.65rem' }}>↕</span>;
    return <span style={{ marginLeft: '3px', fontSize: '0.65rem' }}>{sortDir === 1 ? '↑' : '↓'}</span>;
  };

  return (
    <main className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Sessions</h1>
          <p className="page-subtitle">Inspect tracked visitor sessions. Click any row to explore the full journey.</p>
        </div>
        <button onClick={() => fetchSessions(search)} className="btn btn-secondary btn-sm">
          <Icon name="refresh" size={13} /> Refresh
        </button>
      </div>

      {/* Search */}
      <section className="glass-panel" style={{ padding: '12px 16px', marginBottom: '16px' }}>
        <form onSubmit={(e) => { e.preventDefault(); fetchSessions(search); }} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Icon name="search" size={15} style={{ color: 'var(--text-4)' }} />
          <input
            type="text"
            placeholder="Search by session ID or URL…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="select-input"
            style={{ width: '100%', border: 'none', background: 'transparent' }}
          />
          {search && (
            <button type="button" onClick={() => { setSearch(''); fetchSessions(''); }} className="btn btn-secondary btn-sm">
              <Icon name="x" size={12} /> Clear
            </button>
          )}
        </form>
      </section>

      {/* Table */}
      <section className="glass-panel" style={{ padding: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 600 }}>
            Sessions <span style={{ color: 'var(--text-4)', fontWeight: 400 }}>({total})</span>
          </h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>
            {sortedSessions.length} of {total} · Click headers to sort
          </span>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Session ID</th>
                <th onClick={() => handleSort('first_seen_at')} style={{ cursor: 'pointer' }}>First Seen<SortIcon field="first_seen_at" /></th>
                <th>Last Active</th>
                <th onClick={() => handleSort('duration_seconds')} style={{ cursor: 'pointer' }}>Duration<SortIcon field="duration_seconds" /></th>
                <th>Landing</th>
                <th onClick={() => handleSort('page_views')} style={{ cursor: 'pointer' }}>Views<SortIcon field="page_views" /></th>
                <th onClick={() => handleSort('clicks')} style={{ cursor: 'pointer' }}>Clicks<SortIcon field="clicks" /></th>
                <th onClick={() => handleSort('total_events')} style={{ cursor: 'pointer' }}>Events<SortIcon field="total_events" /></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 9 }).map((_, j) => <td key={j}><div className="skeleton" style={{ height: 12, width: '60%' }}></div></td>)}</tr>
                ))
              ) : sortedSessions.length === 0 ? (
                <tr><td colSpan={9}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><Icon name="search" size={24} /></div>
                    <div className="empty-state-title">No sessions found</div>
                    <div className="empty-state-desc">{search ? `No match for "${search}".` : 'Use "Seed Data" to generate demo sessions.'}</div>
                  </div>
                </td></tr>
              ) : (
                sortedSessions.map((session, idx) => (
                  <tr key={session.session_id} onClick={() => setSelectedSession(session)} className="animate-slide-up" style={{ animationDelay: `${idx * 0.02}s` }}>
                    <td><span className="session-code">{session.session_id.substring(0, 14)}…</span></td>
                    <td style={{ fontSize: '0.78rem' }}>{formatDate(session.first_seen_at)}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{timeAgo(session.last_seen_at)}</td>
                    <td><span className={getDurationColor(session.duration_seconds)} style={{ fontWeight: 500, fontSize: '0.8rem' }}>{formatDuration(session.duration_seconds)}</span></td>
                    <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <code style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{session.initial_url ? session.initial_url.replace(/http:\/\/localhost:\d+/, '') : '/'}</code>
                    </td>
                    <td><span className="badge-tag">{session.page_views || 0}</span></td>
                    <td><span className="badge-tag">{session.clicks || 0}</span></td>
                    <td><strong style={{ fontSize: '0.9rem' }}>{session.total_events}</strong></td>
                    <td>
                      <button className="btn btn-secondary btn-sm" style={{ fontSize: '0.7rem', padding: '3px 8px' }}>
                        <Icon name="eye" size={12} /> Journey
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedSession && <UserJourneyModal session={selectedSession} onClose={() => setSelectedSession(null)} />}
    </main>
  );
}
