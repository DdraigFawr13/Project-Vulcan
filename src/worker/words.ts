// Small words the worker's views share.

/** "1 log", "3 logs"; `many` for a plural that is not the word and an s. */
export const plural = (n: number, one: string, many = `${one}s`): string =>
  `${n} ${n === 1 ? one : many}`;
