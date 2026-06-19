export interface Achievement {
  id: string;
  icon: string;
  name: string;
  desc: string;
}

/** Achievement catalog, ported from the legacy game. */
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'firstStrokes', icon: '🎨', name: 'First Strokes', desc: 'Create your first artwork in the Sandbox.' },
  { id: 'palette', icon: '🌈', name: "Painter's Palette", desc: 'Use every colour in the Sandbox.' },
  { id: 'firstBlood', icon: '⚔️', name: 'First Blood', desc: 'Win your first multiplayer round.' },
  { id: 'sweep', icon: '🧹', name: 'Clean Sweep', desc: 'Win a match without dropping a round.' },
  { id: 'underdog', icon: '🐺', name: 'Underdog', desc: 'Beat a player two levels above you.' },
  { id: 'airMaster', icon: '✋', name: 'Air Master', desc: 'Win a round using hand-tracking mode.' },
  { id: 'elementalist', icon: '🜂', name: 'Elementalist', desc: 'Win an Elemental Showdown.' },
];

export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
