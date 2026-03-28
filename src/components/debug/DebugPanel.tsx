// src/components/debug/DebugPanel.tsx
import React, { useState } from 'react';
import { useEstateContext } from '../../contexts/EstateContext';

interface QuirkEntry {
  characterId: string;
  gained: string;
  lost: string;
}

export function DebugPanel() {
  const { currentEstate } = useEstateContext();
  const [open, setOpen] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'events' | 'dungeon'>('events');

  if (!currentEstate) return null;

  const estateName = currentEstate.name;

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
        width: 480,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'monospace',
        fontSize: 12,
        color: '#ccc',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ color: '#ff6b35', fontWeight: 'bold' }}>Debug Panel — {estateName}</span>
        <button
          onClick={() => setOpen(false)}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        <button
          onClick={() => setActiveTab('events')}
          style={{ ...btnStyle, borderColor: activeTab === 'events' ? '#ff6b35' : '#555' }}
        >
          Events
        </button>
        <button
          onClick={() => setActiveTab('dungeon')}
          style={{ ...btnStyle, borderColor: activeTab === 'dungeon' ? '#ff6b35' : '#555' }}
        >
          Dungeon End
        </button>
      </div>

      {activeTab === 'events' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          <button onClick={triggerReview} disabled={loading} style={btnStyle}>
            Run Narrative Review
          </button>
          <EventIdInput onSubmit={(id) => triggerEvent(id)} disabled={loading} />
        </div>
      )}

      {activeTab === 'dungeon' && (
        <DungeonEndPanel
          estateName={estateName}
          estate={currentEstate}
          disabled={loading}
          onRun={(label, fn) => runAction(label, fn)}
        />
      )}

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

/* -------------------------------------------------------------------
 *  Dungeon End Panel
 * ------------------------------------------------------------------- */

function DungeonEndPanel({
  estateName,
  estate,
  disabled,
  onRun,
}: {
  estateName: string;
  estate: any;
  disabled: boolean;
  onRun: (label: string, fn: () => Promise<any>) => void;
}) {
  const roster: string[] = estate.dungeon?.roster ?? [];
  const rosterCharacters = roster
    .map((id: string) => estate.characters[id])
    .filter(Boolean);

  const [totalLoot, setTotalLoot] = useState('2500');
  const [quirks, setQuirks] = useState<QuirkEntry[]>(
    rosterCharacters.map((c: any) => ({ characterId: c.identifier, gained: '', lost: '' }))
  );

  if (!estate.dungeon) {
    return <div style={{ color: '#888' }}>No active dungeon.</div>;
  }

  const buildContext = (): string => {
    const lines: string[] = [];
    for (const q of quirks) {
      const char = rosterCharacters.find((c: any) => c.identifier === q.characterId);
      if (!char) continue;
      const parts: string[] = [];
      if (q.gained.trim()) parts.push(`Gained: ${q.gained.trim()}`);
      if (q.lost.trim()) parts.push(`Lost: ${q.lost.trim()}`);
      if (parts.length) lines.push(`${char.title}: ${parts.join('. ')}`);
    }
    if (!lines.length) return '';
    return `New quirks from this expedition:\n${lines.join('\n')}`;
  };

  const handleRun = () => {
    const context = buildContext();
    const loot = parseInt(totalLoot) || 0;

    onRun('Dungeon End', async () => {
      const setupRes = await fetch(`http://localhost:3000/estates/${estateName}/events/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: 'gameplay__return',
          characterIds: roster,
          context: context || undefined,
        }),
      });
      const setupData = await setupRes.json();

      return {
        setup: setupData,
        context,
        totalLoot: loot,
        region: estate.dungeon.region,
      };
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
      {/* Dungeon info */}
      <div style={{ color: '#888', fontSize: 11 }}>
        Region: {estate.dungeon.region} — Roster: {roster.length} characters
      </div>

      {/* Loot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ color: '#aaa', minWidth: 70 }}>Total Loot:</label>
        <input
          type="number"
          value={totalLoot}
          onChange={e => setTotalLoot(e.target.value)}
          disabled={disabled}
          style={inputStyle}
        />
      </div>

      {/* Quirks per roster character */}
      <div style={{ maxHeight: 200, overflow: 'auto' }}>
        {rosterCharacters.map((char: any) => {
          const q = quirks.find(q => q.characterId === char.identifier);
          return (
            <div key={char.identifier} style={{ marginBottom: 8 }}>
              <div style={{ color: '#ff6b35', fontSize: 11, marginBottom: 2 }}>
                {char.title} — {char.name}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  placeholder="Gained (comma sep)"
                  value={q?.gained || ''}
                  onChange={e =>
                    setQuirks(prev =>
                      prev.map(p =>
                        p.characterId === char.identifier ? { ...p, gained: e.target.value } : p
                      )
                    )
                  }
                  disabled={disabled}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  placeholder="Lost (comma sep)"
                  value={q?.lost || ''}
                  onChange={e =>
                    setQuirks(prev =>
                      prev.map(p =>
                        p.characterId === char.identifier ? { ...p, lost: e.target.value } : p
                      )
                    )
                  }
                  disabled={disabled}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Context preview */}
      {buildContext() && (
        <pre style={{ background: '#0a0a0a', padding: 6, borderRadius: 3, fontSize: 10, color: '#888' }}>
          {buildContext()}
        </pre>
      )}

      <button onClick={handleRun} disabled={disabled} style={btnStyle}>
        Run Dungeon End
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------
 *  Event ID Input
 * ------------------------------------------------------------------- */

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
        style={inputStyle}
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

/* -------------------------------------------------------------------
 *  Shared styles
 * ------------------------------------------------------------------- */

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

const inputStyle: React.CSSProperties = {
  background: '#0a0a0a',
  border: '1px solid #444',
  borderRadius: 3,
  padding: '4px 8px',
  color: '#ccc',
  fontFamily: 'monospace',
  fontSize: 12,
};