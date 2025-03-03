export type Sequencer = () => number;

export const createSequencer = (): Sequencer => {
  let index = 1;
  return () => index++;
};
