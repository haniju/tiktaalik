import React, { useEffect, useState, useRef } from 'react';
import { Image as KonvaImageNode, Rect, Group, Text } from 'react-konva';
import { ImageLayer } from '../types';
import { loadImage } from '../utils/imageStorage';

interface KonvaImageProps {
  layer: ImageLayer;
}

const WARN_IMAGE_LOAD_FAILED = '[KonvaImage] Image manquante pour clé:';

export const KonvaImage = React.memo(function KonvaImage({ layer }: KonvaImageProps): JSX.Element {
  const [htmlImage, setHtmlImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setStatus('loading');
    setHtmlImage(null);

    loadImage(layer.imageStorageKey).then(dataUrl => {
      if (!mountedRef.current) return;
      if (!dataUrl) {
        console.warn(WARN_IMAGE_LOAD_FAILED, layer.imageStorageKey);
        setStatus('error');
        return;
      }

      const img = new window.Image();
      img.onload = () => {
        if (mountedRef.current) {
          setHtmlImage(img);
          setStatus('ready');
        }
      };
      img.onerror = () => {
        if (mountedRef.current) {
          console.warn(WARN_IMAGE_LOAD_FAILED, layer.imageStorageKey);
          setStatus('error');
        }
      };
      img.src = dataUrl;
    });

    return () => {
      mountedRef.current = false;
    };
  }, [layer.imageStorageKey]);

  const rotation = layer.rotation ?? 0;

  // Placeholder gris pendant le chargement
  if (status === 'loading') {
    return (
      <Group x={layer.x} y={layer.y} rotation={rotation} opacity={layer.opacity}>
        <Rect width={layer.width} height={layer.height} fill="#d0d0d0" listening={false} />
      </Group>
    );
  }

  // Erreur — image manquante
  if (status === 'error') {
    return (
      <Group x={layer.x} y={layer.y} rotation={rotation} opacity={layer.opacity}>
        <Rect width={layer.width} height={layer.height} fill="#ffcccc" stroke="#cc0000" strokeWidth={2} listening={false} />
        <Text
          text="Image manquante"
          width={layer.width}
          height={layer.height}
          align="center"
          verticalAlign="middle"
          fontSize={14}
          fill="#cc0000"
          listening={false}
        />
      </Group>
    );
  }

  // Image chargée
  return (
    <Group x={layer.x} y={layer.y} rotation={rotation} opacity={layer.opacity}>
      <KonvaImageNode
        image={htmlImage!}
        width={layer.width}
        height={layer.height}
        listening={false}
      />
    </Group>
  );
});
