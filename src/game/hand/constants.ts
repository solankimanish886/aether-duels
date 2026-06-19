export const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
// Served same-origin from public/mediapipe/wasm (copied out of the installed
// @mediapipe/tasks-vision package by scripts/copy-mediapipe.mjs). This guarantees the
// WASM binary matches the JS glue version — a mismatch silently breaks detection.
export const WASM_BASE = `${import.meta.env.BASE_URL}mediapipe/wasm`;

/** Gesture-recognition tuning (defaults; pinch thresholds are calibratable). */
export const DEFAULT_PINCH_ENTER = 0.33; // pinch closes → pen down
export const DEFAULT_PINCH_EXIT = 0.45; // pinch opens → pen up (gap avoids flicker)
export const HYST_FRAMES = 3; // frames a new gesture must persist before committing
export const PEN_UP_GRACE_MS = 140; // bridge brief tracking dropouts so strokes don't split
export const DWELL_TOOLBAR_MS = 600; // hover a toolbar button this long to activate it
export const HELD_FIST_MS = 900; // hold a fist this long to confirm/seal (e.g. clear canvas)
export const HELD_DONE_MS = 900; // hold an open high-five this long to finish/confirm drawing
export const ACTION_COOLDOWN_MS = 500; // min gap between edge-triggered tap gestures (undo/redo)

export interface HandCalibration {
  pinchEnter: number;
  pinchExit: number;
}

export const DEFAULT_CALIBRATION: HandCalibration = {
  pinchEnter: DEFAULT_PINCH_ENTER,
  pinchExit: DEFAULT_PINCH_EXIT,
};
