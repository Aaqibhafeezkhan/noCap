import type { FlowBeat, FlowMap } from '../../types';
import type { RhymeStyles } from '../colors';
import type { FlowLayout, SyllableRect } from '../layout';
import type { BarMarker } from '../markers';

export interface LayerState {
  density: boolean;
  markers: boolean;
  energy: boolean;
  onsets: boolean;
}

export const DEFAULT_LAYERS: LayerState = { density: true, markers: true, energy: false, onsets: false };

/** Inclusive range of bar numbers. */
export interface BarRange {
  start: number;
  end: number;
}

export interface RenderState {
  flowmap: FlowMap;
  layout: FlowLayout;
  rows: SyllableRect[][];
  styles: RhymeStyles;
  markers: Map<number, BarMarker[]>;
  beatsByBar: Map<number, FlowBeat[]>;
  maxDensity: number;
  activeRhyme: string | null;
  layers: LayerState;
  selection: BarRange | null;
  loop: boolean;
}

export interface HoverState {
  rowIndex: number | null;
  rect: SyllableRect | null;
  onPlayButton: boolean;
}

export const NO_HOVER: HoverState = { rowIndex: null, rect: null, onPlayButton: false };

export interface RowRange {
  first: number;
  last: number;
}
