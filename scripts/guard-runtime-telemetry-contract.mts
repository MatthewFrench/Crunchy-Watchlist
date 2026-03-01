import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const curatedLoaderLoadCyclePath = path.join(repoRoot, 'extension', 'src', 'Runtime', 'CuratedLoaderLoadCycle.ts');
const historyRepositoryPreloadPath = path.join(repoRoot, 'extension', 'src', 'Data', 'HistoryRepositoryPreload.ts');

const requiredCuratedLoadTimingKeys = [
  'force',
  'totalEntries',
  'priorityEntryCount',
  'deferredEntryCount',
  'tokenDurationMs',
  'rowsDurationMs',
  'priorityMetadataDurationMs',
  'totalDurationMs',
  'requestCountTotal',
  'requestCounts',
] as const;

const requiredRequestCountKeys = ['authToken', 'watchlist', 'ratings', 'watchHistory', 'other'] as const;
const requiredWatchHistoryPreloadStartKeys = [
  'preferredAudioLanguage',
  'attemptLocale',
  'curatedDataRevision',
  'localeAttemptCount',
  'localeRevisionAttemptCount',
  'candidates',
  'force',
  'isDefaultPreferredAudio',
] as const;
const requiredWatchHistoryPreloadKeys = [
  'preferredAudioLanguage',
  'attemptLocale',
  'curatedDataRevision',
  'localeAttemptCount',
  'localeRevisionAttemptCount',
  'pages',
  'fetchedRows',
  'mappedSeries',
  'mappedSeriesByAudioLocale',
  'mappedProgressSeries',
  'mappedProgressSeriesByAudioLocale',
  'matchedCandidates',
  'candidates',
  'noMatchPageStreak',
] as const;
const requiredWatchHistoryPreloadFailedKeys = [
  'preferredAudioLanguage',
  'attemptLocale',
  'curatedDataRevision',
  'localeAttemptCount',
  'localeRevisionAttemptCount',
  'message',
] as const;

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasObjectKey(source: string, key: string): boolean {
  const explicitKeyPattern = new RegExp(`\\b${escapeRegexLiteral(key)}\\s*:`);
  if (explicitKeyPattern.test(source)) {
    return true;
  }

  const shorthandKeyPattern = new RegExp(`\\b${escapeRegexLiteral(key)}\\b\\s*(?:,|\\})`);
  return shorthandKeyPattern.test(source);
}

function findMatchingBrace(source: string, openBraceIndex: number): number {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplateLiteral = false;
  let isEscaped = false;

  for (let index = openBraceIndex; index < source.length; index += 1) {
    const char = source[index];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (char === '\\') {
      isEscaped = true;
      continue;
    }

    if (inSingleQuote) {
      if (char === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      if (char === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (inTemplateLiteral) {
      if (char === '`') {
        inTemplateLiteral = false;
      }
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      continue;
    }

    if (char === '`') {
      inTemplateLiteral = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function extractCuratedLoadTimingPayload(source: string): string {
  return extractRuntimeEventPayload(source, 'curated-load-timing');
}

function extractRuntimeEventPayload(source: string, eventName: string): string {
  const eventCall = `runtimeEvent('${eventName}'`;
  const callStart = source.indexOf(eventCall);
  if (callStart < 0) {
    throw new Error(`Missing runtimeEvent('${eventName}', ...) call`);
  }

  const payloadStart = source.indexOf('{', callStart);
  if (payloadStart < 0) {
    throw new Error(`Missing payload object for runtime event '${eventName}'`);
  }

  const payloadEnd = findMatchingBrace(source, payloadStart);
  if (payloadEnd < 0) {
    throw new Error(`Unable to parse payload object for runtime event '${eventName}'`);
  }

  return source.slice(payloadStart, payloadEnd + 1);
}

function extractNestedObject(source: string, key: string): string {
  const keyPattern = new RegExp(`\\b${escapeRegexLiteral(key)}\\s*:\\s*\\{`);
  const match = keyPattern.exec(source);
  if (!match || typeof match.index !== 'number') {
    throw new Error(`Missing nested object for key "${key}"`);
  }

  const nestedStart = source.indexOf('{', match.index);
  if (nestedStart < 0) {
    throw new Error(`Missing opening brace for nested object "${key}"`);
  }
  const nestedEnd = findMatchingBrace(source, nestedStart);
  if (nestedEnd < 0) {
    throw new Error(`Unable to parse nested object "${key}"`);
  }

  return source.slice(nestedStart, nestedEnd + 1);
}

function assertPayloadKeys(payload: string, label: string, requiredKeys: readonly string[]): string[] {
  return requiredKeys.filter((key) => !hasObjectKey(payload, key)).map((key) => `${label}: ${key}`);
}

async function run(): Promise<void> {
  const curatedLoaderSource = await fs.readFile(curatedLoaderLoadCyclePath, 'utf8');
  const historyPreloadSource = await fs.readFile(historyRepositoryPreloadPath, 'utf8');
  const curatedLoadTimingPayload = extractCuratedLoadTimingPayload(curatedLoaderSource);
  const watchHistoryPreloadStartPayload = extractRuntimeEventPayload(
    historyPreloadSource,
    'watch-history-preload-start',
  );
  const watchHistoryPreloadPayload = extractRuntimeEventPayload(historyPreloadSource, 'watch-history-preload');
  const watchHistoryPreloadFailedPayload = extractRuntimeEventPayload(
    historyPreloadSource,
    'watch-history-preload-failed',
  );

  const missingKeys: string[] = [];
  missingKeys.push(
    ...assertPayloadKeys(curatedLoadTimingPayload, 'curated-load-timing', requiredCuratedLoadTimingKeys),
  );

  const requestCountsPayload = extractNestedObject(curatedLoadTimingPayload, 'requestCounts');
  missingKeys.push(
    ...assertPayloadKeys(requestCountsPayload, 'curated-load-timing.requestCounts', requiredRequestCountKeys),
  );

  missingKeys.push(
    ...assertPayloadKeys(
      watchHistoryPreloadStartPayload,
      'watch-history-preload-start',
      requiredWatchHistoryPreloadStartKeys,
    ),
  );
  missingKeys.push(
    ...assertPayloadKeys(watchHistoryPreloadPayload, 'watch-history-preload', requiredWatchHistoryPreloadKeys),
  );
  missingKeys.push(
    ...assertPayloadKeys(
      watchHistoryPreloadFailedPayload,
      'watch-history-preload-failed',
      requiredWatchHistoryPreloadFailedKeys,
    ),
  );

  if (missingKeys.length > 0) {
    console.error('[CW] Runtime telemetry contract guard failed.');
    console.error('[CW] Missing required telemetry payload keys:');
    missingKeys.forEach((key) => {
      console.error(`- ${key}`);
    });
    process.exitCode = 1;
    return;
  }

  console.log('[CW] Runtime telemetry contract guard passed.');
}

await run();
