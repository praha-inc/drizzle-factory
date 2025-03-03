import { describe, it, expect } from 'vitest';

import { createSequencer } from './create-sequencer';

describe('createSequencer', () => {
  it('should start from 1', () => {
    const sequencer = createSequencer();

    expect(sequencer()).toBe(1);
  });

  it('should increment by 1', () => {
    const sequencer = createSequencer();

    expect(sequencer()).toBe(1);
    expect(sequencer()).toBe(2);
    expect(sequencer()).toBe(3);
  });

  it('should be independent', () => {
    const sequencer1 = createSequencer();
    const sequencer2 = createSequencer();

    expect(sequencer1()).toBe(1);
    expect(sequencer2()).toBe(1);
    expect(sequencer1()).toBe(2);
    expect(sequencer2()).toBe(2);
  });
});
