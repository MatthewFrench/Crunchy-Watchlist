type AnyFn = (...args: unknown[]) => unknown;
type LooseRecord = {
  [key: string]: unknown;
  panel?: LooseRecord;
  episode_metadata?: LooseRecord;
  series_metadata?: LooseRecord;
};
type AnyFunctionRecord = Record<string, AnyFn>;
