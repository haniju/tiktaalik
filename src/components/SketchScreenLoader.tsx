import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Drawing } from '../types';
import { dbGetDrawing } from '../utils/db';
import { SketchScreen } from './SketchScreen';

export function SketchScreenLoader() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { navigate('/', { replace: true }); return; }
    dbGetDrawing(id).then(d => {
      if (!d) { navigate('/', { replace: true }); return; }
      setDrawing(d);
      setLoading(false);
    });
  }, [id, navigate]);

  if (loading || !drawing) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'system-ui' }}>
        Chargement…
      </div>
    );
  }

  return <SketchScreen key={drawing.id} drawing={drawing} onBack={() => navigate('/')} />;
}
