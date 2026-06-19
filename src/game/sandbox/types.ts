/** A vector shape the Sandbox can create, move, resize, and recolour. */
export type ShapeKind =
  | 'rect'
  | 'roundRect'
  | 'circle'
  | 'triangle'
  | 'star'
  | 'pentagon'
  | 'hexagon'
  | 'arrow'
  | 'heart'
  | 'speech'
  | 'line'
  | 'path'; // freehand

export interface Pt {
  x: number;
  y: number;
}

export interface SceneShape {
  id: string;
  kind: ShapeKind;
  /** Bounding box in CSS pixels. For `line`, the segment runs (x,y)→(x+w,y+h). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Absolute points for freehand `path`. */
  points?: Pt[];
  stroke: string;
  strokeWidth: number;
  fill: string | null;
}

export type SandboxMode = 'create' | 'fill';
/** A create-mode tool: a shape kind, freehand (`path`), `line`, or `select`. */
export type SandboxTool = ShapeKind | 'select';

export interface SandboxChange {
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  /** Distinct stroke+fill colours present in the scene (for achievements). */
  usedColors: string[];
}

export interface SandboxCallbacks {
  onChange?: (c: SandboxChange) => void;
  /** Fires once when the first shape/drawing is committed. */
  onFirstShape?: () => void;
}
