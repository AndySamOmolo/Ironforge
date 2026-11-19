'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('IronForge runtime error caught by ErrorBoundary:', error);
  }, [error]);

  return (
    <div
      role="alert"
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary, #070710)',
        color: 'var(--text-primary, #F5F5FA)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 420,
          width: '100%',
          padding: 28,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          background: 'var(--bg-card, rgba(14, 14, 28, 0.85))',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
          borderRadius: 20,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            margin: '0 auto',
            background: 'color-mix(in srgb, var(--accent-red) 14%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-red) 35%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
          }}
          aria-hidden="true"
        >
          ⚡
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary, #A8A8C0)', lineHeight: 1.5 }}>
            Your active workout snapshots and local training history in storage are safe and untouched.
          </p>
          {error?.message && (
            <p
              style={{
                marginTop: 10,
                fontSize: 11,
                color: 'var(--text-muted, #8E8EA8)',
                background: 'rgba(0, 0, 0, 0.25)',
                padding: '8px 12px',
                borderRadius: 10,
                wordBreak: 'break-word',
              }}
            >
              {error.message}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => reset()}
            style={{ width: '100%' }}
          >
            Try Again
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              window.location.href = '/';
            }}
            style={{ width: '100%' }}
          >
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
}
