'use client';

import React, { useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import HeatmapCanvas from '../../components/HeatmapCanvas';
import { useToast } from '../../components/Toast';

export default function HeatmapPage() {
  const [pages, setPages] = useState([]);
  const [selectedUrl, setSelectedUrl] = useState('all');
  const [clicks, setClicks] = useState([]);
  const [totalClicks, setTotalClicks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentMode, setCurrentMode] = useState('density');
  const [isLivePolling, setIsLivePolling] = useState(true);
  const addToast = useToast();

  const fetchPages = () => {
    fetch('http://localhost:5005/api/analytics/pages')
      .then((r) => r.json())
      .then((d) => { if (d.success && d.pages) setPages(d.pages); })
      .catch(() => {});
  };

  const fetchClicks = () => {
    const q = selectedUrl && selectedUrl !== 'all' ? `?url=${encodeURIComponent(selectedUrl)}` : '';
    fetch(`http://localhost:5005/api/analytics/clicks${q}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) { setClicks(d.clicks || []); setTotalClicks(d.total_clicks || 0); } setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchPages(); fetchClicks(); }, [selectedUrl]);

  useEffect(() => {
    if (!isLivePolling) return;
    const interval = setInterval(() => { fetchPages(); fetchClicks(); }, 3000);
    return () => clearInterval(interval);
  }, [selectedUrl, isLivePolling]);

  const handleSeedClicks = async () => {
    try {
      const res = await fetch('http://localhost:5005/api/analytics/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) { addToast(`Seeded ${data.events} events.`, { type: 'success' }); fetchPages(); fetchClicks(); }
    } catch { addToast('Failed to seed data.', { type: 'error' }); }
  };

  const uniqueSessions = new Set(clicks.map((c) => c.session_id)).size;

  const modes = [
    { key: 'density', label: 'Thermal', icon: 'flame' },
    { key: 'dots', label: 'Scatter', icon: 'mapPin' },
    { key: 'grid', label: 'Grid', icon: 'grid' },
  ];

  return (
    <main className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Click Heatmap</h1>
          <p className="page-subtitle">Visualize user interaction hotspots and click density patterns</p>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={() => { setLoading(true); fetchPages(); fetchClicks(); }} className="btn btn-secondary btn-sm">
            <Icon name="refresh" size={13} /> Refresh
          </button>
          <button onClick={() => setIsLivePolling(!isLivePolling)} className={`btn btn-sm ${isLivePolling ? 'btn-primary' : 'btn-secondary'}`}>
            <Icon name="radio" size={13} /> {isLivePolling ? 'Live' : 'Paused'}
          </button>
          <a href="http://localhost:5005/demo/index.html" target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
            <Icon name="externalLink" size={13} /> Demo Store
          </a>
        </div>
      </div>

      {/* Stats */}
      <section className="kpi-grid" style={{ marginBottom: '16px' }}>
        <div className="kpi-card glass-panel">
          <div className="kpi-header"><span className="kpi-label">Total Clicks</span><div className="kpi-icon"><Icon name="cursor" size={14} /></div></div>
          <div className="kpi-value">{totalClicks}</div>
          <div className="kpi-trend">Click events on selected page</div>
        </div>
        <div className="kpi-card glass-panel">
          <div className="kpi-header"><span className="kpi-label">Unique Sessions</span><div className="kpi-icon"><Icon name="users" size={14} /></div></div>
          <div className="kpi-value">{uniqueSessions}</div>
          <div className="kpi-trend">Distinct visitors clicking</div>
        </div>
        <div className="kpi-card glass-panel">
          <div className="kpi-header"><span className="kpi-label">Tracked Pages</span><div className="kpi-icon"><Icon name="fileText" size={14} /></div></div>
          <div className="kpi-value">{pages.length}</div>
          <div className="kpi-trend">Unique URLs with events</div>
        </div>
        <div className="kpi-card glass-panel">
          <div className="kpi-header"><span className="kpi-label">Avg Clicks/Session</span><div className="kpi-icon"><Icon name="target" size={14} /></div></div>
          <div className="kpi-value">{uniqueSessions > 0 ? Math.round(totalClicks / uniqueSessions) : 0}</div>
          <div className="kpi-trend">Click density per visitor</div>
        </div>
      </section>

      {/* Controls */}
      <section className="glass-panel" style={{ padding: '14px 18px', marginBottom: '16px' }}>
        <div className="heatmap-controls">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="filter" size={14} style={{ color: 'var(--text-4)' }} />
            <select value={selectedUrl} onChange={(e) => setSelectedUrl(e.target.value)} className="select-input">
              <option value="all">All Tracked Pages</option>
              {pages.map((p, i) => <option key={i} value={p.url}>{p.url} ({p.total_clicks} clicks)</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="toggle-group">
              {modes.map((m) => (
                <button key={m.key} className={`toggle-btn ${currentMode === m.key ? 'active' : ''}`} onClick={() => setCurrentMode(m.key)}>
                  <Icon name={m.icon} size={12} /> {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {currentMode === 'density' && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-1)', alignItems: 'center' }}>
            <div className="heatmap-legend">
              <span>Low</span><div className="legend-bar"></div><span>High</span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-4)' }}>{totalClicks} data points</span>
          </div>
        )}
        {currentMode === 'dots' && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-1)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="info" size={13} /> Hover over scatter points to inspect click details
          </div>
        )}
      </section>

      {/* Canvas */}
      <section className="glass-panel" style={{ padding: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="crosshair" size={15} /> Click Visualization
            <span className="badge-tag" style={{ textTransform: 'capitalize', marginLeft: '4px' }}>{currentMode}</span>
          </h2>
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: '450px', width: '100%' }}></div>
        ) : clicks.length === 0 ? (
          <div className="empty-state" style={{ minHeight: '360px' }}>
            <div className="empty-state-icon"><Icon name="mapPin" size={28} /></div>
            <div className="empty-state-title">No clicks recorded</div>
            <div className="empty-state-desc">Generate demo data or interact with the demo store.</div>
            <button onClick={handleSeedClicks} className="btn btn-primary btn-sm">
              <Icon name="zap" size={13} /> Generate Clicks
            </button>
          </div>
        ) : (
          <HeatmapCanvas clicks={clicks} selectedUrl={selectedUrl} currentMode={currentMode} />
        )}
      </section>
    </main>
  );
}
