export type Sequencer = {
  (): number;
  reset: () => void;
};

export const createSequencer = (): Sequencer => {
  let index = 1;
  const sequencer: Sequencer = () => index++;
  sequencer.reset = () => index = 1;
  return sequencer;
};
