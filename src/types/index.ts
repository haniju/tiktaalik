export type DrawingTool = 'airbrush' | 'pen' | 'marker';
export type Tool = DrawingTool | 'eraser' | 'text' | null;
export type CanvasMode = 'draw' | 'select' | 'move'; // mode actif du canvas

// Contexte sauvegardé avant activation du mode pan (move)
export interface PreviousMode {
  canvasMode: CanvasMode;
  activeTool: Tool;
}

export interface ToolState {
  activeTool: Tool;          // null quand mode move/select
  canvasMode: CanvasMode;
  previousMode: PreviousMode | null; // mémoire du mode avant pan
  toolColors: Record<DrawingTool, string>;
  toolWidths: Record<DrawingTool, number>;
  toolOpacities: Record<DrawingTool, number>;
  toolSmoothings: Record<DrawingTool, number>;
  airbrushEdgeOpacity: number;
  eraserSize: number;             // rayon de la gomme en px monde (champ standalone, pas dans toolWidths)
  bezierSmoothing: boolean;       // lissage Bézier cubique temps réel
  movingAverageSmoothing: boolean; // lissage moyenne glissante temps réel
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
  groupIds?: string[];
  smoothingMode?: 'bezier' | 'movingAverage'; // algo de lissage utilisé (tension=0 si présent)
}

export interface AirbrushStroke {
  id: string;
  tool: 'airbrush';
  color: string;
  radius: number;
  centerOpacity: number;
  edgeOpacity: number;
  points: Array<{ x: number; y: number }>;
  groupIds?: string[];
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
  rotation?: number;
  groupIds?: string[];
}

// TextBox dans la pile unifiée — discriminant tool: 'text'
export type TextLayer = TextBox & { tool: 'text' };

export interface ImageLayer {
  id: string;
  tool: 'image';
  imageStorageKey: string; // clé localStorage séparée ("img_{id}")
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity: number;        // 0–1, défaut 1
  groupIds?: string[];
}

// Pile unifiée — ordre chronologique = z-index réel
export type DrawLayer = Stroke | AirbrushStroke | TextLayer | ImageLayer;

export type GridStyle = 'dots' | 'lines' | 'checkerboard';

export interface GridSettings {
  style: GridStyle;
  spacing: number;   // px entre chaque point/ligne/carreau
  opacity: number;   // 0–1
  color: string;     // couleur principale (défaut #e63946 = rouge)
}

export const DEFAULT_GRID_SETTINGS: GridSettings = {
  style: 'dots',
  spacing: 20,
  opacity: 0.3,
  color: '#e63946',
};

export type CanvasUnit = 'px' | 'cm';

export interface CanvasConfig {
  canvasWidth: number;      // toujours en px
  canvasHeight: number;     // toujours en px
  worldMultiplier: number;  // 1–5 (zone monde = multiplier × canevas)
  displayUnit: CanvasUnit;  // préférence d'affichage uniquement
}

export const PX_PER_CM = 37.795275591; // 96 DPI

export const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  canvasWidth: 794,
  canvasHeight: 1123,
  worldMultiplier: 3,
  displayUnit: 'px',
};

export interface Drawing {
  id: string;
  name: string;
  layers: DrawLayer[];
  background: string; // couleur de fond du canvas (propre à chaque dessin)
  showGrid?: boolean; // affichage de la grille de pixels canvas
  gridSettings?: GridSettings; // paramètres avancés de la grille
  canvasConfig?: CanvasConfig; // dimensions du canevas et zone monde
  imageKeys?: string[]; // toutes les clés image allouées (pour nettoyage orphelins)
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
  // Champs legacy pour migration des anciens dessins sauvegardés
  strokes?: Stroke[];
  airbrushStrokes?: AirbrushStroke[];
  textBoxes?: TextBox[];   // legacy — migré vers layers au chargement
}
