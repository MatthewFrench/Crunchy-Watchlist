export function getElementDataAttribute(element: Element, datasetKey: string, attributeName: string): string {
  const datasetValue = (element as Element & { dataset?: DOMStringMap }).dataset?.[datasetKey];
  if (typeof datasetValue === 'string') {
    return datasetValue;
  }

  if (typeof element.getAttribute !== 'function') {
    return '';
  }

  return element.getAttribute(attributeName) || '';
}

export function setElementDataAttribute(
  element: Element,
  datasetKey: string,
  attributeName: string,
  value: string,
): void {
  const dataset = (element as Element & { dataset?: DOMStringMap }).dataset;
  if (dataset && typeof dataset === 'object') {
    if (dataset[datasetKey] === value) {
      return;
    }
    dataset[datasetKey] = value;
    return;
  }

  if (typeof element.setAttribute === 'function') {
    if (typeof element.getAttribute === 'function' && (element.getAttribute(attributeName) || '') === value) {
      return;
    }
    element.setAttribute(attributeName, value);
  }
}

export function toggleClassNameToken(className: string, token: string, enabled: boolean): string {
  const classTokens = className
    .split(' ')
    .map((item) => item.trim())
    .filter(Boolean);
  const hasToken = classTokens.includes(token);
  if (enabled && !hasToken) {
    classTokens.push(token);
  }
  if (!enabled && hasToken) {
    return classTokens.filter((item) => item !== token).join(' ');
  }

  return classTokens.join(' ');
}
