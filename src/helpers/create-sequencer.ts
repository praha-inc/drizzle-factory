export type Sequencer = {
  (): number;
  current: () => number;
  reset: () => void;
};

export const createSequencer = (): Sequencer => {
  let index = 1;
  const sequencer: Sequencer = () => index++;
  sequencer.current = () => index;
  sequencer.reset = () => index = 1;
  return sequencer;
};
