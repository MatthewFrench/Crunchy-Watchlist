export type AudioLocale = string;

export type AudioLocaleFilter = 'any' | AudioLocale;

const ANY_AUDIO_LOCALE_FILTER: AudioLocaleFilter = 'any';

export function isAnyAudioLocaleFilterValue(value: string): value is 'any' {
  return value.trim().toLowerCase() === ANY_AUDIO_LOCALE_FILTER;
}

export function normalizeAudioLocaleFilter(value: string | null | undefined): AudioLocaleFilter {
  if (typeof value !== 'string') {
    return ANY_AUDIO_LOCALE_FILTER;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return ANY_AUDIO_LOCALE_FILTER;
  }

  if (isAnyAudioLocaleFilterValue(normalizedValue)) {
    return ANY_AUDIO_LOCALE_FILTER;
  }

  return normalizedValue;
}
