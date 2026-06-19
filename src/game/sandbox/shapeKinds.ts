import type { SandboxTool } from './types';

export interface ToolMeta {
  tool: SandboxTool;
  emoji: string;
  label: string;
}

/** Create-mode tools shown in the rail and the gesture shape-wheel. */
export const CREATE_TOOLS: ToolMeta[] = [
  { tool: 'select', emoji: '👆', label: 'Select' },
  { tool: 'path', emoji: '✏️', label: 'Draw' },
  { tool: 'line', emoji: '╱', label: 'Line' },
  { tool: 'rect', emoji: '▭', label: 'Rectangle' },
  { tool: 'roundRect', emoji: '▢', label: 'Rounded' },
  { tool: 'circle', emoji: '◯', label: 'Circle' },
  { tool: 'triangle', emoji: '△', label: 'Triangle' },
  { tool: 'star', emoji: '★', label: 'Star' },
  { tool: 'pentagon', emoji: '⬠', label: 'Pentagon' },
  { tool: 'hexagon', emoji: '⬡', label: 'Hexagon' },
  { tool: 'arrow', emoji: '➜', label: 'Arrow' },
  { tool: 'heart', emoji: '♥', label: 'Heart' },
  { tool: 'speech', emoji: '💬', label: 'Speech' },
];

/** Quick-fill colour presets for Fill mode. */
export const FILL_PRESETS = [
  '#1a1410',
  '#ffffff',
  '#7cb9ff',
  '#ff6eb5',
  '#5de8b8',
  '#ffc844',
  '#c084fc',
  '#ff5c5c',
  '#4ade80',
  '#ffa64d',
];
