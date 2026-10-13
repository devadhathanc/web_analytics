'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Icon from '../components/Icon';
import UserJourneyModal from '../components/UserJourneyModal';
import { API_BASE } from '../lib/api';

function AnimatedNumber({ value, suffix = '' }) {
  const [displayed, setDisplayed] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const end = typeof value === 'number' ? value : parseFloat(value) || 0;
    if (start === end) return;
    const duration = 500;
    const startTime = performance.now();
    function animate(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(animate);
      else prevRef.current = end;
    }
    requestAnimationFrame(animate);
  }, [value]);

  return <>{displayed.toLocaleString()}{suffix}</>;
}

export default function OverviewPage() {
  const [stats, setStats] = useState({
    total_sessions: 0, total_events: 0, total_clicks: 0,
    total_page_views: 0, avg_events_per_session: 0, avg_duration_seconds: 0,
  });
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, sessionsRes] = await Promise.all([
        fetch(`${API_BASE}/api/analytics/stats`).then((r) => r.json()).catch(() => ({ stats: {} })),
        fetch(`${API_BASE}/api/sessions?limit=6`).then((r) => r.json()).catch(() => ({ sessions: [] })),
      ]);
      if (statsRes?.stats) setStats(statsRes.stats);
      if (sessionsRes?.sessions) setRecentSessions(sessionsRes.sessions);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 6000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const timeAgo = (isoString) => {
    if (!isoString) return '-';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getDurationColor = (seconds) => {
    if (!seconds || seconds < 30) return 'duration-short';
    if (seconds < 120) return 'duration-medium';
    return 'duration-long';
  };

  const kpiCards = [
    { label: 'Total Sessions', value: stats.total_sessions, icon: 'users', desc: 'Unique tracked visitors' },
    { label: 'Total Events', value: stats.total_events, icon: 'activity', desc: 'Page views + clicks' },
    { label: 'Total Clicks', value: stats.total_clicks, icon: 'cursor', desc: 'Mapped for heatmap' },
    { label: 'Avg Journey', value: stats.avg_events_per_session, icon: 'trendUp', desc: `Avg ${formatDuration(stats.avg_duration_seconds)} per session`, suffix: ' events' },
  ];

  return (
    <main className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics Overview</h1>
          <p className="page-subtitle">
            Real-time session telemetry, user interactions, and click heatmap insights
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={fetchDashboardData} className="btn btn-secondary btn-sm">
            <Icon name="refresh" size={13} /> Refresh
          </button>
          <Link href="/sessions" className="btn btn-primary btn-sm">
            All Sessions <Icon name="arrowRight" size={13} />
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <section className="kpi-grid">
        {kpiCards.map((kpi, idx) => (
          <div key={kpi.label} className="kpi-card glass-panel animate-slide-up" style={{ animationDelay: `${idx * 0.06}s` }}>
            <div className="kpi-header">
              <span className="kpi-label">{kpi.label}</span>
              <div className="kpi-icon"><Icon name={kpi.icon} size={15} /></div>
            </div>
            {loading ? (
              <div className="skeleton" style={{ height: 28, width: '50%', marginBottom: 8 }}></div>
            ) : (
              <div className="kpi-value animate-count">
                <AnimatedNumber value={kpi.value} suffix={kpi.suffix || ''} />
              </div>
            )}
            <div className="kpi-trend">{kpi.desc}</div>
          </div>
        ))}
      </section>

      {/* Quick Launch */}
      <section className="quick-launch-grid">
        <Link href="/sessions" className="glass-panel quick-launch-card">
          <div>
            <div className="badge-tag" style={{ marginBottom: '8px' }}>
              <Icon name="users" size={11} /> Sessions
            </div>
            <div className="ql-title">User Journey Explorer</div>
            <p className="ql-desc">Inspect chronological event paths step-by-step for every visitor.</p>
          </div>
          <div className="arrow"><Icon name="arrowRight" size={18} /></div>
        </Link>

        <Link href="/heatmap" className="glass-panel quick-launch-card">
          <div>
            <div className="badge-tag" style={{ marginBottom: '8px' }}>
              <Icon name="crosshair" size={11} /> Heatmap
            </div>
            <div className="ql-title">Interactive Click Heatmap</div>
            <p className="ql-desc">Visualize density hotspots and click coordinates on any page.</p>
          </div>
          <div className="arrow"><Icon name="arrowRight" size={18} /></div>
        </Link>
      </section>

      {/* Recent Sessions */}
      <section className="glass-panel" style={{ padding: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Recent Sessions</h2>
            <p style={{ color: 'var(--text-4)', fontSize: '0.78rem', marginTop: '2px' }}>
              Click any session to explore the full user journey
            </p>
          </div>
          <Link href="/sessions" className="btn btn-secondary btn-sm">
            View All ({stats.total_sessions || 0})
          </Link>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Active</th>
                <th>Duration</th>
                <th>Views</th>
                <th>Clicks</th>
                <th>Events</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j}><div className="skeleton" style={{ height: 14, width: '65%' }}></div></td>
                    ))}
                  </tr>
                ))
              ) : recentSessions.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-state-icon"><Icon name="layers" size={28} /></div>
                      <div className="empty-state-title">No sessions yet</div>
                      <div className="empty-state-desc">
                        Click &quot;Seed Data&quot; in the navigation bar to generate demo analytics.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                recentSessions.map((session, idx) => (
                  <tr key={session.session_id} onClick={() => setSelectedSession(session)} className="animate-slide-up" style={{ animationDelay: `${idx * 0.04}s` }}>
                    <td><span className="session-code">{session.session_id.substring(0, 14)}…</span></td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{timeAgo(session.last_seen_at)}</td>
                    <td><span className={getDurationColor(session.duration_seconds)} style={{ fontWeight: 500, fontSize: '0.82rem' }}>{formatDuration(session.duration_seconds)}</span></td>
                    <td><span className="badge-tag">{session.page_views || 0}</span></td>
                    <td><span className="badge-tag">{session.clicks || 0}</span></td>
                    <td><strong style={{ fontSize: '0.9rem' }}>{session.total_events}</strong></td>
                    <td style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Explore <Icon name="arrowRight" size={12} />
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedSession && (
        <UserJourneyModal session={selectedSession} onClose={() => setSelectedSession(null)} />
      )}
    </main>
  );
}
