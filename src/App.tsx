import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { HomeScreen } from './components/HomeScreen';
import { SketchScreenLoader } from './components/SketchScreenLoader';
import { migrateFromLocalStorage, isMigrationDone } from './utils/db';

const SLIDER_CSS = `
.app-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 44px;
  background: transparent;
  margin: 0;
  cursor: pointer;
}
.app-slider::-webkit-slider-runnable-track {
  height: 1px;
  background: #ccc;
  border-radius: 0;
}
.app-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #444;
  border: none;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  margin-top: -9px;
}
.app-slider::-moz-range-track {
  height: 1px;
  background: #ccc;
  border-radius: 0;
  border: none;
}
.app-slider::-moz-range-progress {
  height: 2px;
  background: #118ab2;
  border-radius: 0;
}
.app-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #444;
  border: none;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.3); }
}
`;

export default function App() {
  const [ready, setReady] = useState(isMigrationDone());

  // Migration localStorage → IndexedDB (one-shot au premier lancement)
  useEffect(() => {
    if (ready) return;
    migrateFromLocalStorage().then(() => setReady(true));
  }, [ready]);

  // Injecter le CSS des sliders une seule fois
  useEffect(() => {
    const id = 'app-slider-css';
    if (!document.getElementById(id)) {
      const el = document.createElement('style');
      el.id = id;
      el.textContent = SLIDER_CSS;
      document.head.appendChild(el);
    }
  }, []);

  if (!ready) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'system-ui' }}>
        Migration en cours…
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/sketch/:id" element={<SketchScreenLoader />} />
      </Routes>
    </HashRouter>
  );
}
