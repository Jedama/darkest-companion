// src/components/debug/DebugPanel.tsx
import React, { useState } from 'react';

interface DebugPanelProps {
  estateName: string;
}

export function DebugPanel({ estateName }: DebugPanelProps) {
  const [open, setOpen] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runAction = async (label: string, fn: () => Promise<any>) => {
    setLoading(true);
    setOutput(`Running ${label}...`);
    try {
      const result = await fn();
      setOutput(JSON.stringify(result, null, 2));
    } catch (err: any) {
      setOutput(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  const triggerReview = () =>
    runAction('Narrative Review', async () => {
      const res = await fetch(`http://localhost:3000/estates/${estateName}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      return res.json();
    });

  const triggerEvent = (eventId: string) =>
    runAction(`Event: ${eventId}`, async () => {
      const setupRes = await fetch(`http://localhost:3000/estates/${estateName}/events/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      return setupRes.json();
    });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 12,
          right: 12,
          zIndex: 9999,
          background: '#1a1a1a',
          color: '#ff6b35',
          border: '1px solid #ff6b35',
          borderRadius: 4,
          padding: '6px 12px',
          cursor: 'pointer',
          fontSize: 12,
          fontFamily: 'monospace',
        }}
      >
        DEBUG
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        zIndex: 9999,
        background: '#1a1a1ae6',
        border: '1px solid #ff6b35',
        borderRadius: 6,
        padding: 16,
        width: 420,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'monospace',
        fontSize: 12,
        color: '#ccc',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ color: '#ff6b35', fontWeight: 'bold' }}>Debug Panel</span>
        <button
          onClick={() => setOpen(false)}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        <button onClick={triggerReview} disabled={loading} style={btnStyle}>
          Run Narrative Review
        </button>
        <EventIdInput onSubmit={(id) => triggerEvent(id)} disabled={loading} />
      </div>

      {output && (
        <pre
          style={{
            flex: 1,
            overflow: 'auto',
            background: '#0a0a0a',
            padding: 8,
            borderRadius: 4,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 300,
            fontSize: 11,
          }}
        >
          {output}
        </pre>
      )}
    </div>
  );
}

function EventIdInput({ onSubmit, disabled }: { onSubmit: (id: string) => void; disabled: boolean }) {
  const [value, setValue] = useState('');

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Event ID (e.g. prologue_0)"
        disabled={disabled}
        style={{
          flex: 1,
          background: '#0a0a0a',
          border: '1px solid #444',
          borderRadius: 3,
          padding: '4px 8px',
          color: '#ccc',
          fontFamily: 'monospace',
          fontSize: 12,
        }}
      />
      <button
        onClick={() => value.trim() && onSubmit(value.trim())}
        disabled={disabled || !value.trim()}
        style={btnStyle}
      >
        Run
      </button>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#2a2a2a',
  border: '1px solid #555',
  borderRadius: 3,
  padding: '4px 10px',
  color: '#ccc',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 12,
};