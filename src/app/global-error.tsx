'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('IronForge global error caught by GlobalError:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#070710',
          color: '#F5F5FA',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          role="alert"
          style={{
            maxWidth: 420,
            width: '100%',
            padding: 28,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: 'rgba(14, 14, 28, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 20,
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              margin: '0 auto',
              background: 'rgba(255, 61, 90, 0.14)',
              border: '1px solid rgba(255, 61, 90, 0.35)',
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
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>
              Application Recovery
            </h1>
            <p style={{ fontSize: 13, color: '#A8A8C0', lineHeight: 1.5, margin: 0 }}>
              An unexpected error occurred. Your local workout snapshots and database records remain intact.
            </p>
            {error?.message && (
              <p
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: '#8E8EA8',
                  background: 'rgba(0, 0, 0, 0.3)',
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
              onClick={() => reset()}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: 14,
                border: 'none',
                background: 'linear-gradient(135deg, #FF3D5A 0%, #FF6B3D 100%)',
                color: '#090A0F',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/';
              }}
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: 14,
                border: '1px solid rgba(255, 255, 255, 0.16)',
                background: 'rgba(255, 255, 255, 0.06)',
                color: '#F5F5FA',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Return to Home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
