import { useState } from 'react';
import { Drawing } from './types';
import { GalleryScreen } from './components/GalleryScreen';
import { SketchScreen } from './components/SketchScreen';

type Screen = 'gallery' | 'sketch';

export default function App() {
  const [screen, setScreen] = useState<Screen>('gallery');
  const [currentDrawing, setCurrentDrawing] = useState<Drawing | null>(null);

  if (screen === 'sketch' && currentDrawing) {
    return (
      <SketchScreen
        drawing={currentDrawing}
        onBack={() => setScreen('gallery')}
      />
    );
  }

  return (
    <GalleryScreen
      onOpen={drawing => { setCurrentDrawing(drawing); setScreen('sketch'); }}
      onNew={drawing => { setCurrentDrawing(drawing); setScreen('sketch'); }}
    />
  );
}
