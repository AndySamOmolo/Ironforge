'use client';

import { Home, ClipboardList, Play, BarChart3, User } from 'lucide-react';
import { useUIStore } from '@/lib/store/uiStore';
import { motion } from 'framer-motion';

const tabs = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'plans', label: 'Plans', icon: ClipboardList },
  { id: 'start', label: 'Start', icon: Play },
  { id: 'progress', label: 'Progress', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: User },
];

export default function BottomNav() {
  const { activeTab, setActiveTab } = useUIStore();

  const handleTabClick = (tabId: string) => {
    if (tabId === 'start') {
      setActiveTab('exercises');
      return;
    }
    setActiveTab(tabId);
  };

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        if (tab.id === 'start') {
          return (
            <button
              key={tab.id}
              className="nav-start-btn"
              onClick={() => handleTabClick(tab.id)}
              aria-label="Start workout"
            >
              {/* Pulse ring */}
              <div style={{
                position: 'absolute', width: 64, height: 64, borderRadius: '50%',
                border: '2px solid rgba(255,61,90,0.25)',
                animation: 'pulse-dot 3s ease-in-out infinite',
                pointerEvents: 'none',
              }} />
              <Play size={24} fill="white" />
            </button>
          );
        }
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
            aria-label={tab.label}
          >
            <tab.icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
            <span className="nav-label" style={{ fontWeight: isActive ? 700 : 500 }}>{tab.label}</span>
            {isActive && (
              <motion.div
                layoutId="nav-indicator"
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: 'var(--accent-red)',
                  boxShadow: '0 0 8px var(--glow-red)',
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
