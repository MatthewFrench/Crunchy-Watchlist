export type CuratedGridStyleRecord = Record<string, string>;

export function setCuratedGridStyleValue(style: CuratedGridStyleRecord, propertyName: string, value: string): boolean {
  if (style[propertyName] === value) {
    return false;
  }
  style[propertyName] = value;
  return true;
}

export function clearCuratedGridStyleValue(style: CuratedGridStyleRecord, propertyName: string): boolean {
  if (style[propertyName] === '') {
    return false;
  }
  style[propertyName] = '';
  return true;
}
