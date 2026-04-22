import { useState, useEffect } from 'react';
import { Drawing } from './types';
import { HomeScreen } from './components/HomeScreen';
import { SketchScreen } from './components/SketchScreen';

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

type Screen = 'home' | 'sketch';

export default function App() {
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
  const [screen, setScreen] = useState<Screen>('home');
  const [currentDrawing, setCurrentDrawing] = useState<Drawing | null>(null);

  if (screen === 'sketch' && currentDrawing) {
    return (
      <SketchScreen
        drawing={currentDrawing}
        onBack={() => setScreen('home')}
      />
    );
  }

  return (
    <HomeScreen
      onOpen={drawing => { setCurrentDrawing(drawing); setScreen('sketch'); }}
      onNew={drawing => { setCurrentDrawing(drawing); setScreen('sketch'); }}
    />
  );
}
