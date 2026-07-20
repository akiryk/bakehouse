/**
 * The one knob the sequencer reads. 1 = strict serial (predictable order,
 * no stampede); 2-3 = mild parallelism, faster on healthy networks. Tune
 * from measured results (docs/perf-harness.md), not by guessing.
 */
export interface ImageSequencerConfig {
  imageConcurrency: number;
}

export const imageSequencer: ImageSequencerConfig = {
  imageConcurrency: 3,
};
