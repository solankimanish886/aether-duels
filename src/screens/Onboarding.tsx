import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUI } from '@/state/ui';
import { useProfile } from '@/state/profile';
import { Button } from '@/components/Button';
import './Onboarding.css';

interface Slide {
  emoji: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    emoji: '⚔️',
    title: 'Sixty seconds. One winner.',
    body: 'You and a rival get the same prompt and race to draw it. Then the world votes on who nailed it.',
  },
  {
    emoji: '🖐️',
    title: 'Draw with your hands',
    body: 'Turn on your camera and paint in the air: pinch to draw, open your hand to pick a tool, make a fist to lock it in.',
  },
  {
    emoji: '🏆',
    title: 'Climb the ranks',
    body: 'Win duels, earn XP, unlock colors and titles, and chase achievements. No account needed — just a name.',
  },
];

export function Onboarding() {
  const go = useUI((s) => s.go);
  const { setName, completeOnboarding } = useProfile();
  const [step, setStep] = useState(0);
  const [name, setLocalName] = useState('');
  const isNameGate = step === SLIDES.length;

  const finish = () => {
    setName(name.trim() || 'Anonymous');
    completeOnboarding();
    go('menu');
  };

  return (
    <div className="onboard">
      <button className="onboard-skip" onClick={() => setStep(SLIDES.length)}>
        Skip →
      </button>

      <div className="onboard-stage">
        <AnimatePresence mode="wait">
          {!isNameGate ? (
            <motion.div
              key={step}
              className="onboard-slide"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="onboard-emoji">{SLIDES[step].emoji}</div>
              <h1 className="display onboard-title">{SLIDES[step].title}</h1>
              <p className="onboard-body">{SLIDES[step].body}</p>
            </motion.div>
          ) : (
            <motion.div
              key="namegate"
              className="onboard-slide"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="onboard-emoji">✨</div>
              <h1 className="display onboard-title">What should we call you?</h1>
              <input
                className="onboard-input"
                value={name}
                maxLength={18}
                autoFocus
                placeholder="Your name"
                onChange={(e) => setLocalName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && finish()}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="onboard-controls">
        {!isNameGate && (
          <div className="onboard-dots">
            {SLIDES.map((_, i) => (
              <span key={i} className={`onboard-dot ${i === step ? 'is-active' : ''}`} />
            ))}
          </div>
        )}
        {isNameGate ? (
          <Button variant="primary" size="lg" onClick={finish}>
            Enter the Arena
          </Button>
        ) : (
          <Button variant="primary" size="lg" onClick={() => setStep((s) => s + 1)}>
            {step === SLIDES.length - 1 ? 'Almost there' : 'Next'}
          </Button>
        )}
      </div>
    </div>
  );
}
