export type DrawingTool = 'airbrush' | 'pen' | 'marker';
export type Tool = DrawingTool | 'eraser' | 'text' | null;
export type CanvasMode = 'draw' | 'select' | 'move'; // mode actif du canvas

export interface ToolState {
  activeTool: Tool;          // null quand mode move/select
  canvasMode: CanvasMode;
  toolColors: Record<DrawingTool, string>;
  toolWidths: Record<DrawingTool, number>;
  toolOpacities: Record<DrawingTool, number>;
  airbrushEdgeOpacity: number;
}

// Alias pour compatibilité avec le code existant
export type TopbarMode = CanvasMode | null;

export interface Stroke {
  id: string;
  tool: 'pen' | 'marker';
  color: string;
  width: number;
  points: number[];
  opacity: number;
}

export interface AirbrushStroke {
  id: string;
  tool: 'airbrush';
  color: string;
  radius: number;
  centerOpacity: number;
  edgeOpacity: number;
  points: Array<{ x: number; y: number }>;
}

export interface TextBox {
  id: string;
  x: number;
  y: number;
  width: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: string;
  textDecoration: string;
  align: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  color: string;
  background: string;
  opacity: number;
  padding: number;
}

// TextBox dans la pile unifiée — discriminant tool: 'text'
export type TextLayer = TextBox & { tool: 'text' };

// Pile unifiée — ordre chronologique = z-index réel
export type DrawLayer = Stroke | AirbrushStroke | TextLayer;

export interface Drawing {
  id: string;
  name: string;
  layers: DrawLayer[];
  background: string; // couleur de fond du canvas (propre à chaque dessin)
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
  // Champs legacy pour migration des anciens dessins sauvegardés
  strokes?: Stroke[];
  airbrushStrokes?: AirbrushStroke[];
  textBoxes?: TextBox[];   // legacy — migré vers layers au chargement
}
