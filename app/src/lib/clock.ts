/** Source of the current time in epoch milliseconds; replaced by a fake clock in tests. */
export type Clock = () => number;

export const systemClock: Clock = () => Date.now();
