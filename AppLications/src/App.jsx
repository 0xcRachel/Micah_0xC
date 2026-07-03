import React, { useState, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import IntroOverlay from './components/IntroOverlay';
import Background from './components/Background';
import Character from './components/Character';
import './App.css';

gsap.registerPlugin(useGSAP);


const App = () => {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [isIntroFinished, setIsIntroFinished] = useState(false);
  const [characterImg, setCharacterImg] = useState(""); // User can set their character image path here

  useGSAP(() => {
    gsap.set(contentRef.current, { filter: 'blur(16px)' });
  }, { scope: containerRef });

  const handleCovered = () => {
    gsap.set(contentRef.current, { filter: 'blur(0px)' });
  };

  return (
    <div ref={containerRef} className="min-h-screen relative overflow-hidden select-none">
      <IntroOverlay
        onCovered={handleCovered}
        onComplete={() => setIsIntroFinished(true)}
      />
      <Background />
      
      {/* Container for Character Component */}
      <div className="absolute bottom-0 right-0 w-[50vw] h-[85vh] pointer-events-none z-10">
        <Character characterImage={characterImg} />
      </div>

      <div
        ref={contentRef}
        className="relative z-10 w-full min-h-screen p-8 md:p-12 lg:p-16 flex flex-col justify-between"
      >
      </div>
    </div>
  );
};

export default App;
