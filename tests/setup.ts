// Vitest global setup. Extend with jest-dom matchers etc. as tests grow.
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
