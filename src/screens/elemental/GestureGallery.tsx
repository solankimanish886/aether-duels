import { ELEMENT_BEATS, ELEMENT_LIST, ELEMENTS, type ElementKey } from '@/game/elemental';
import { GestureCard } from './GestureCard';

interface GestureGalleryProps {
  /** Currently recognized element to highlight (e.g. live from the tracker). */
  activeKey?: ElementKey | null;
  /** Elements the player has already practiced (tutorial). */
  doneKeys?: ElementKey[];
  /** Make cards tappable. */
  onPick?: (key: ElementKey) => void;
  /** Show each element's "beats X, Y" line. */
  showBeats?: boolean;
}

/** The five elements and their summoning gestures, as a responsive grid. */
export function GestureGallery({ activeKey, doneKeys, onPick, showBeats }: GestureGalleryProps) {
  return (
    <div className="ggallery">
      {ELEMENT_LIST.map((el) => (
        <GestureCard
          key={el.key}
          el={el}
          active={activeKey === el.key}
          done={doneKeys?.includes(el.key)}
          onClick={onPick}
          beats={showBeats ? ELEMENT_BEATS[el.key].map((k) => ELEMENTS[k].label).join(' & ') : undefined}
        />
      ))}
    </div>
  );
}
