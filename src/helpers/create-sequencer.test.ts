import { describe, it, expect } from 'vitest';

import { createSequencer } from './create-sequencer';

describe('createSequencer', () => {
  it('should start from 1', () => {
    const sequencer = createSequencer();

    expect(sequencer.current()).toBe(1);
    expect(sequencer()).toBe(1);
    expect(sequencer.current()).toBe(2);
  });

  it('should increment by 1', () => {
    const sequencer = createSequencer();

    expect(sequencer.current()).toBe(1);
    expect(sequencer()).toBe(1);
    expect(sequencer.current()).toBe(2);

    expect(sequencer()).toBe(2);
    expect(sequencer.current()).toBe(3);

    expect(sequencer()).toBe(3);
    expect(sequencer.current()).toBe(4);
  });

  it('should be independent', () => {
    const sequencer1 = createSequencer();
    const sequencer2 = createSequencer();

    expect(sequencer1.current()).toBe(1);
    expect(sequencer1()).toBe(1);
    expect(sequencer1.current()).toBe(2);

    expect(sequencer2.current()).toBe(1);
    expect(sequencer2()).toBe(1);
    expect(sequencer2.current()).toBe(2);

    expect(sequencer1()).toBe(2);
    expect(sequencer1.current()).toBe(3);

    expect(sequencer2()).toBe(2);
    expect(sequencer2.current()).toBe(3);
  });

  describe('reset', () => {
    it('should reset the sequencer', () => {
      const sequencer = createSequencer();

      expect(sequencer.current()).toBe(1);
      expect(sequencer()).toBe(1);
      expect(sequencer.current()).toBe(2);

      sequencer.reset();
      expect(sequencer.current()).toBe(1);
      expect(sequencer()).toBe(1);
      expect(sequencer.current()).toBe(2);
    });
  });

  it('should be independent', () => {
    const sequencer1 = createSequencer();
    const sequencer2 = createSequencer();

    expect(sequencer1.current()).toBe(1);
    expect(sequencer1()).toBe(1);
    expect(sequencer1.current()).toBe(2);

    expect(sequencer2.current()).toBe(1);
    expect(sequencer2()).toBe(1);
    expect(sequencer2.current()).toBe(2);

    sequencer1.reset();
    expect(sequencer1.current()).toBe(1);
    expect(sequencer1()).toBe(1);
    expect(sequencer1.current()).toBe(2);

    expect(sequencer2.current()).toBe(2);
    expect(sequencer2()).toBe(2);
    expect(sequencer2.current()).toBe(3);
  });
});
