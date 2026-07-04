import React, { useRef, useState, useEffect } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

// Helper to generate a stable, realistic machine code saved in localStorage
const getMachineCode = () => {
  let code = localStorage.getItem('sys_machine_code');
  if (!code) {
    const chars = '0123456789ABCDEF';
    let part1 = '';
    let part2 = '';
    for (let i = 0; i < 4; i++) part1 += chars[Math.floor(Math.random() * 16)];
    for (let i = 0; i < 4; i++) part2 += chars[Math.floor(Math.random() * 16)];
    code = `DESKTOP-MC${part1}-${part2}`;
    localStorage.setItem('sys_machine_code', code);
  }
  return code;
};

// Helper to detect system info
const detectSystemInfo = () => {
  const info = {
    os: 'Windows 11 x64',
    cpu: `${navigator.hardwareConcurrency || 8} Cores`,
    ram: `${navigator.deviceMemory || 16} GB Est.`,
    resolution: `${window.screen.width} x ${window.screen.height}`,
    gpu: 'Intel Iris Xe Graphics',
    browser: 'Tauri Webview / Chrome Runtime',
  };

  // Detect basic OS from User Agent
  const ua = navigator.userAgent;
  if (ua.indexOf('Macintosh') !== -1) info.os = 'macOS (Darwin)';
  else if (ua.indexOf('Linux') !== -1) info.os = 'Linux Kernel';
  else if (ua.indexOf('Android') !== -1) info.os = 'Android OS';
  else if (ua.indexOf('iPhone') !== -1) info.os = 'iOS Mobile';

  // Extract GPU using WebGL context
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_VENDOR_ID);
        // Clean up common renderer strings to look cleaner
        if (renderer) {
          if (renderer.includes('NVIDIA')) {
            info.gpu = renderer.match(/NVIDIA[^\)]+/)?.[0] || 'NVIDIA GeForce RTX';
          } else if (renderer.includes('AMD') || renderer.includes('Radeon')) {
            info.gpu = renderer.match(/(AMD|Radeon)[^\)]+/)?.[0] || 'AMD Radeon Graphics';
          } else if (renderer.includes('Intel')) {
            info.gpu = renderer.match(/Intel[^\)]+/)?.[0] || 'Intel UHD Graphics';
          } else if (renderer.includes('Apple')) {
            info.gpu = 'Apple Silicon GPU';
          } else {
            info.gpu = renderer.split('/')[0].replace('ANGLE (', '');
          }
        }
      }
    }
  } catch (e) {
    info.gpu = 'Standard Display Adapter';
  }

  return info;
};

const SystemInfoCard = ({ className = '', style = {} }) => {
  const [sysInfo, setSysInfo] = useState({ os: 'Detecting...', cpu: '', ram: '', resolution: '', gpu: '', browser: '' });
  const [machineCode, setMachineCode] = useState('');
  const [status, setStatus] = useState('ONLINE');
  const cardRef = useRef(null);

  useEffect(() => {
    setSysInfo(detectSystemInfo());
    setMachineCode(getMachineCode());

    // Periodically fluctuate status slightly for retro immersion
    const interval = setInterval(() => {
      setStatus(prev => prev === 'ONLINE' ? 'SYS_OK' : 'ONLINE');
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // GSAP Entrance animations
  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    // Card boundary expand
    tl.fromTo(cardRef.current,
      { y: 30, opacity: 0, scale: 0.98 },
      { y: 0, opacity: 1, scale: 1, duration: 0.6 }
    );

    // Stagger each info-row slide in
    const rows = cardRef.current?.querySelectorAll('.info-row');
    if (rows && rows.length > 0) {
      tl.fromTo(rows,
        { x: -15, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.4, stagger: 0.05 },
        '-=0.3'
      );
    }

    // Ping dot pulsing
    gsap.to('.status-led', {
      opacity: 0.3,
      duration: 0.6,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    });
  }, { scope: cardRef });

  return (
    <div
      ref={cardRef}
      className={className}
      style={{
        background: '#faf9f6',
        border: '2.5px solid #30302e',
        borderRadius: '24px',
        boxShadow: '0 8px 0 #30302e, 0 16px 40px rgba(48,48,46,0.12)',
        padding: '20px 24px',
        userSelect: 'none',
        fontFamily: "'Outfit', 'Segoe UI', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        ...style,
      }}
    >
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Pulsing Status LED */}
          <div
            className="status-led animate-pulse"
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#4d9e6a',
              boxShadow: '0 0 8px #4d9e6a',
            }}
          />
          <h2 style={{ fontSize: '15px', fontWeight: '900', color: '#30302e', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
            System Terminal diagnostics
          </h2>
        </div>
        <span style={{
          fontSize: '10px',
          fontWeight: '800',
          color: '#faf9f6',
          background: '#30302e',
          padding: '3px 8px',
          borderRadius: '6px',
          letterSpacing: '0.5px'
        }}>
          {status}
        </span>
      </div>

      {/* Grid container for system elements */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
        background: '#ede9e3',
        padding: '16px',
        borderRadius: '16px',
        border: '1.5px solid #30302e',
      }}>
        {/* Machine ID */}
        <div className="info-row" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '9px', fontWeight: '700', color: '#87867f', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Machine Code</span>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#30302e', fontFamily: 'monospace' }}>{machineCode}</span>
        </div>

        {/* Operating System */}
        <div className="info-row" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '9px', fontWeight: '700', color: '#87867f', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Operating System</span>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#30302e' }}>{sysInfo.os}</span>
        </div>

        {/* CPU Cores */}
        <div className="info-row" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '9px', fontWeight: '700', color: '#87867f', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CPU Cores</span>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#30302e' }}>{sysInfo.cpu}</span>
        </div>

        {/* RAM Limit */}
        <div className="info-row" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '9px', fontWeight: '700', color: '#87867f', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Memory Allocation</span>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#30302e' }}>{sysInfo.ram}</span>
        </div>

        {/* Display Resolution */}
        <div className="info-row" style={{ display: 'flex', flexDirection: 'column', gap: '2px', gridColumn: 'span 2' }}>
          <span style={{ fontSize: '9px', fontWeight: '700', color: '#87867f', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Resolution</span>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#30302e' }}>{sysInfo.resolution}</span>
        </div>

        {/* Graphics Engine */}
        <div className="info-row" style={{ display: 'flex', flexDirection: 'column', gap: '2px', gridColumn: 'span 2', borderTop: '1px solid #dcd7cd', paddingTop: '8px', marginTop: '4px' }}>
          <span style={{ fontSize: '9px', fontWeight: '700', color: '#87867f', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Graphics Processing Unit</span>
          <span style={{ fontSize: '12px', fontWeight: '800', color: '#30302e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sysInfo.gpu}</span>
        </div>
      </div>

      {/* Footer tagline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: '#87867f', fontWeight: '600' }}>
        <span>HOST NODE PORT: 4000</span>
        <span style={{ fontFamily: 'monospace' }}>SECURE LOCALHOST CONNECTION</span>
      </div>
    </div>
  );
};

export default SystemInfoCard;
