'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useToast } from './Toast';
import Icon from './Icon';

export default function Navbar() {
  const pathname = usePathname();
  const [seeding, setSeeding] = useState(false);
  const addToast = useToast();

  const handleSeedData = async () => {
    try {
      setSeeding(true);
      const res = await fetch('http://localhost:5005/api/analytics/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        addToast(
          `Generated ${data.sessions} sessions with ${data.events} events.`,
          { type: 'success', title: 'Demo data created' }
        );
        setTimeout(() => window.location.reload(), 800);
      } else {
        addToast('Seed request returned an error.', { type: 'error' });
      }
    } catch (err) {
      console.error('Error seeding data:', err);
      addToast('Ensure the Flask backend is running on port 5005.', { type: 'error', title: 'Connection failed' });
    } finally {
      setSeeding(false);
    }
  };

  const navItems = [
    { href: '/', label: 'Overview', icon: 'chart' },
    { href: '/sessions', label: 'Sessions', icon: 'users' },
    { href: '/heatmap', label: 'Heatmap', icon: 'flame' },
  ];

  return (
    <header className="dashboard-navbar">
      <Link href="/" className="brand-wrapper">
        <div className="brand-badge">WA</div>
        <div className="brand-title">
          <span>Web Analytics</span>
        </div>
      </Link>

      <nav className="nav-menu">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${pathname === item.href ? 'active' : ''}`}
          >
            <Icon name={item.icon} size={14} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="nav-actions">
        <div className="live-indicator">
          <span className="pulse-dot"></span>
          <span>Live</span>
        </div>

        <button
          onClick={handleSeedData}
          disabled={seeding}
          className="btn btn-secondary btn-sm"
        >
          <Icon name={seeding ? 'refresh' : 'zap'} size={13} />
          {seeding ? 'Seeding…' : 'Seed Data'}
        </button>

        <a
          href="http://localhost:5005/demo/index.html"
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary btn-sm"
        >
          <Icon name="externalLink" size={13} />
          Demo Store
        </a>
      </div>
    </header>
  );
}
