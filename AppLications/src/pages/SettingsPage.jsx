import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const Toggle = ({ settingKey, defaultOn = false, checked, onChange, id }) => {
  const saved = localStorage.getItem(`setting_${settingKey}`);
  const initial = saved !== null ? saved === 'true' : defaultOn;
  const [localOn, setLocalOn] = React.useState(initial);

  const isControlled = checked !== undefined;
  const on = isControlled ? checked : localOn;

  const handleToggle = (e) => {
    if (isControlled) {
      if (onChange) onChange(!on, e);
    } else {
      const next = !on;
      setLocalOn(next);
      localStorage.setItem(`setting_${settingKey}`, String(next));
    }
  };

  return (
    <button
      id={id}
      onClick={handleToggle}
      className={`relative w-11 h-6 rounded-full transition-colors duration-300 cursor-pointer flex-shrink-0
        ${on ? 'bg-[#4d9e6a]' : 'bg-[var(--text-muted)]/40'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300
          ${on ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
};

const SettingRow = ({ label, description, children }) => (
  <div className="flex items-center justify-between bg-[var(--card-bg-alt)] rounded-2xl px-4 py-3 border border-[var(--card-border)]/10">
    <div>
      <p className="text-sm font-semibold text-[var(--text-color)]">{label}</p>
      {description && <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>}
    </div>
    {children}
  </div>
);

const SettingsPage = ({
  onBack,
  isDarkMode,
  onToggleDarkMode,
  animationsEnabled,
  onToggleAnimations
}) => {
  const pageRef = useRef(null);
  const contentRef = useRef(null);

  // Enter animation: slide in from the right
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(pageRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.3, ease: 'power2.out' }
    );
    tl.fromTo(contentRef.current,
      { x: 80, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' },
      '-=0.1'
    );
  }, { scope: pageRef });

  const handleBack = () => {
    const tl = gsap.timeline({ onComplete: onBack });
    tl.to(contentRef.current, { x: 80, opacity: 0, duration: 0.3, ease: 'power2.in' });
    tl.to(pageRef.current, { opacity: 0, duration: 0.2, ease: 'power2.in' }, '-=0.15');
  };

  return (
    <div
      ref={pageRef}
      className="fixed inset-0 z-40 flex items-center justify-center"
    >
      {/* Blurred background */}
      <div className="absolute inset-0 bg-[var(--bg-color)]/85 backdrop-blur-md" />

      {/* Page Content */}
      <div
        ref={contentRef}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)] 
            hover:text-[var(--text-color)] transition-colors duration-200 cursor-pointer group"
        >
          <span className="inline-block transition-transform duration-200 group-hover:-translate-x-1">←</span>
          Back
        </button>

        {/* Card */}
        <div
          className="bg-[var(--card-bg)] border-2 border-[var(--card-border)] rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[75vh] no-scrollbar"
          style={{ boxShadow: '0 24px 64px rgba(0,0,0,var(--shadow-opacity))' }}
        >
          <h1 className="text-2xl font-black text-[var(--text-color)] tracking-wider uppercase mb-8">Settings</h1>

          <div className="space-y-6">
            {/* Appearance */}
            <section>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Appearance</p>
              <div className="space-y-3">
                <SettingRow label="Dark Mode" description="Use dark background theme">
                  <Toggle
                    id="dark-mode-toggle"
                    settingKey="darkMode"
                    checked={isDarkMode}
                    onChange={onToggleDarkMode}
                  />
                </SettingRow>
                <SettingRow label="Animations" description="Enable UI animations">
                  <Toggle
                    id="animations-toggle"
                    settingKey="animations"
                    checked={animationsEnabled}
                    onChange={onToggleAnimations}
                  />
                </SettingRow>
              </div>
            </section>

            {/* Character */}
            <section>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Character</p>
              <div className="space-y-3">
                <SettingRow label="Show Character" description="Display character on home screen">
                  <Toggle settingKey="showCharacter" defaultOn />
                </SettingRow>
                <SettingRow label="Drop Shadow" description="Character drop shadow effect">
                  <Toggle settingKey="charShadow" defaultOn />
                </SettingRow>
              </div>
            </section>

            {/* App */}
            <section>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">App</p>
              <div className="space-y-3">
                <SettingRow label="Start on Boot" description="Launch app when system starts">
                  <Toggle settingKey="startBoot" />
                </SettingRow>
                <SettingRow label="Remember Window" description="Restore window position on launch">
                  <Toggle settingKey="rememberWindow" defaultOn />
                </SettingRow>
              </div>
            </section>
          </div>

          <p className="text-center text-xs text-[var(--text-muted)] mt-8 font-mono">v1.0.0</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
