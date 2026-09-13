import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const PHASE_LABEL = {
  start: 'Bắt đầu', lua: 'Kiểm tra Lua', keys: 'Vá keys',
  gids: 'Refresh GIDs', seed: 'Tải manifests', refresh: 'Refresh files',
  done: 'Hoàn tất',
};

/**
 * Modal tiến trình Fix Lua / Refresh Manifests.
 * Render qua portal lên document.body nên không bị kẹt bởi transform GSAP
 * hay overflow của tab cha — luôn phủ đúng viewport dù scroll ở đâu.
 */
const FixJobModal = ({ job, prog, result, jobKind, onClose }) => {
  const logRef = useRef(null);

  // Auto-scroll log xuống dòng mới nhất.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [prog.log]);

  if (!job) return null;
  const pct = prog.total > 0 ? Math.min(100, Math.round((prog.done / prog.total) * 100)) : 0;
  const running = prog.phase !== 'done' && !result;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { if (!running) onClose(); }}>
      <div style={{ width: 460, maxWidth: '92vw', maxHeight: '84vh', overflow: 'auto', background: 'var(--bg-color, #1b1e22)', border: '1px solid var(--border-color, #2a2d32)', borderRadius: 10, padding: 16 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <b style={{ fontSize: 14 }}>{jobKind === 'refresh' ? 'Refresh Manifests' : 'Fix Lua'} — {job.name} <span style={{ opacity: 0.6 }}>#{job.appid}</span></b>
          <button className="sm-btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={onClose}>
            {running ? 'Ẩn' : 'Đóng'}
          </button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
          {PHASE_LABEL[prog.phase] ?? prog.phase}
          {prog.total > 1 ? ` · ${prog.done}/${prog.total}` : ''}
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: 'var(--led-color, #1a9fff)', transition: 'width 0.2s' }} />
        </div>
        <div ref={logRef} className="mono" style={{ fontSize: 11.5, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 220, overflow: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '8px 10px' }}>
          {prog.log.length ? prog.log.join('\n') : '…'}
        </div>
        {result && result.__kind === 'refresh' && (
          <div style={{ fontSize: 12.5, marginTop: 10, lineHeight: 1.7 }}>
            <div>✓ Depots updated: {result.updated.length ? result.updated.map(u => `#${u.depot_id} (${String(u.old_gid).slice(-6)} → ${String(u.new_gid).slice(-6)})`).join(', ') : '— (đã current)'}</div>
            {result.files_written.length > 0 && (
              <div style={{ opacity: 0.75 }}>Files: {result.files_written.length}</div>
            )}
            {(result.warnings ?? []).map((w, i) => (
              <div key={i} style={{ color: '#ff9d5c' }}>⚠ {w}</div>
            ))}
          </div>
        )}
        {result && result.__kind !== 'refresh' && (
          <div style={{ fontSize: 12.5, marginTop: 10, lineHeight: 1.7 }}>
            <div>✓ Lua: {result.lua_created ? 'đã tạo mới' : 'đã có'}</div>
            <div>✓ Keys vá thêm: {result.fixed_keys.length ? result.fixed_keys.join(', ') : '—'}</div>
            <div>✓ GIDs refreshed: {result.refreshed_gids.length ? result.refreshed_gids.join(', ') : '—'}</div>
            <div>✓ Manifests seeded: {result.seeded.length ? result.seeded.join(', ') : '—'}</div>
            {result.missing_manifests.length > 0 && (
              <div style={{ color: '#ff9d5c' }}>⚠ Mirror thiếu: {result.missing_manifests.join(', ')}</div>
            )}
            {result.no_key_remaining.length > 0 && (
              <div style={{ color: '#ff9d5c' }}>⚠ Thiếu key: {result.no_key_remaining.join(', ')}</div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default FixJobModal;
