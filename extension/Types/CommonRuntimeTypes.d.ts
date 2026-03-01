type UnknownFn = (...args: unknown[]) => unknown;
type LooseRecord = {
  [key: string]: unknown;
  panel?: LooseRecord;
  episode_metadata?: LooseRecord;
  series_metadata?: LooseRecord;
};
type CwBoundaryValue = LooseRecord[string];
type AnyFunctionRecord = Record<string, UnknownFn>;
