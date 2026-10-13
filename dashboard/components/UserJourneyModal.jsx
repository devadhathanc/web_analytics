'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Icon from './Icon';

export default function UserJourneyModal({ session, onClose }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!session?.session_id) return;
    let mounted = true;
    setLoading(true);
    fetch(`http://localhost:5005/api/sessions/${encodeURIComponent(session.session_id)}/events`)
      .then((r) => r.json())
      .then((d) => { if (mounted) { setEvents(d.events || []); setLoading(false); } })
      .catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [session]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const copySessionId = useCallback(() => {
    if (!session?.session_id) return;
    navigator.clipboard.writeText(session.session_id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [session]);

  if (!session) return null;

  const formatTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getDelta = (idx) => {
    if (idx === 0 || !events[0] || !events[idx]) return '+0s';
    return `+${Math.max(0, Math.round((new Date(events[idx].timestamp).getTime() - new Date(events[0].timestamp).getTime()) / 1000))}s`;
  };

  const fmtDur = (s) => { if (!s) return '0s'; const m = Math.floor(s / 60); return m > 0 ? `${m}m ${s % 60}s` : `${s}s`; };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span className="badge-tag"><Icon name="activity" size={11} /> Journey</span>
              <button
                onClick={copySessionId}
                className="session-code"
                style={{ cursor: 'pointer', border: copied ? '1px solid var(--text-3)' : undefined, transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Click to copy"
              >
                {copied ? <><Icon name="check" size={11} /> Copied</> : <><Icon name="copy" size={11} /> {session.session_id.substring(0, 14)}…</>}
              </button>
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>User Interaction Timeline</h3>
          </div>
          <button className="btn-close" onClick={onClose} title="Close (Esc)">
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="drawer-body">
          <div className="mini-stats-grid">
            {[
              { label: 'Events', value: session.total_events || events.length, icon: 'activity' },
              { label: 'Views', value: session.page_views || 0, icon: 'eye' },
              { label: 'Clicks', value: session.clicks || 0, icon: 'cursor' },
              { label: 'Duration', value: fmtDur(session.duration_seconds), icon: 'clock' },
            ].map((s) => (
              <div key={s.label} className="mini-stat">
                <div className="mini-stat-label">{s.label}</div>
                <div className="mini-stat-value">{s.value}</div>
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 60, width: '100%' }}></div>)}
            </div>
          ) : events.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Icon name="layers" size={24} /></div>
              <div className="empty-state-title">No events recorded</div>
              <div className="empty-state-desc">No interaction events found for this session.</div>
            </div>
          ) : (
            <div className="timeline">
              {events.map((ev, idx) => {
                const isClick = ev.event === 'click';
                return (
                  <div key={idx} className="timeline-item">
                    <div className={`timeline-dot ${isClick ? 'click' : 'page-view'}`}>
                      <Icon name={isClick ? 'cursor' : 'eye'} size={11} />
                    </div>
                    <div className="timeline-card">
                      <div className="timeline-time" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Step {idx + 1} · {formatTime(ev.timestamp)}</span>
                        <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>{getDelta(idx)}</span>
                      </div>
                      <div className="timeline-title">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span className="badge-tag" style={{ fontSize: '0.62rem' }}>
                            {isClick ? 'CLICK' : 'VIEW'}
                          </span>
                          <span style={{ fontSize: '0.85rem' }}>
                            {isClick ? (ev.targetText || ev.targetTag || 'element') : (ev.title || 'Page Visit')}
                          </span>
                        </span>
                        {isClick && ev.x !== undefined && (
                          <span className="coord-tag">({ev.x}, {ev.y})</span>
                        )}
                      </div>
                      {isClick ? (
                        <div style={{ marginTop: '4px', fontSize: '0.75rem' }}>
                          {ev.targetText && <div style={{ color: 'var(--text-1)', marginBottom: '2px' }}>Clicked: <strong>&quot;{ev.targetText}&quot;</strong></div>}
                          {ev.targetSelector && <div style={{ color: 'var(--text-4)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', wordBreak: 'break-all' }}>{ev.targetSelector}</div>}
                          {ev.xPercent !== undefined && <div style={{ color: 'var(--text-4)', fontSize: '0.65rem', marginTop: '2px' }}>Viewport: {ev.xPercent}% × {ev.yPercent}% · {ev.viewportWidth}×{ev.viewportHeight}</div>}
                        </div>
                      ) : (
                        <div style={{ marginTop: '3px', fontSize: '0.75rem', color: 'var(--text-3)' }}>
                          <code style={{ color: 'var(--text-2)', fontSize: '0.72rem' }}>{ev.url || ev.pathname}</code>
                          {ev.referrer && <div style={{ fontSize: '0.68rem', color: 'var(--text-4)', marginTop: '2px' }}>Referrer: {ev.referrer}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
