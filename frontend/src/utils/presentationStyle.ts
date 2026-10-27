/**
 * Passive, bounded author formatting. Keep this policy aligned with
 * internal/utils/textutil/presentation_style.go and its shared test vectors.
 * Source CSS rules, resource URLs and positioning/visibility controls are excluded.
 */
type Bounds = Record<string, readonly [number, number]>;
type Cleaner = (value: string) => string | null;

const dimensions = /^(\d+(?:\.\d+)?|\.\d+)(px|em|rem|%)?$/;
const hexColor = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/;
const namedColors = new Set([
  'transparent',
  'currentcolor',
  'black',
  'silver',
  'gray',
  'grey',
  'white',
  'maroon',
  'red',
  'purple',
  'fuchsia',
  'green',
  'lime',
  'olive',
  'yellow',
  'navy',
  'blue',
  'teal',
  'aqua',
]);
const borderStyles = new Set(['none', 'solid', 'dashed', 'dotted', 'double']);

function numberText(value: number): string {
  const text = String(value);
  if (!text.includes('e')) return text;
  const [mantissa, exponent] = text.split('e');
  const digits = mantissa.replace('.', '');
  const point =
    (mantissa.includes('.') ? mantissa.indexOf('.') : mantissa.length) + Number(exponent);
  if (point <= 0) return `0.${'0'.repeat(-point)}${digits}`;
  if (point >= digits.length) return digits + '0'.repeat(point - digits.length);
  return `${digits.slice(0, point)}.${digits.slice(point)}`;
}

function length(value: string, bounds: Bounds, allowZero = false): string | null {
  const match = dimensions.exec(value);
  if (!match) return null;
  const number = Number(match[1]);
  const unit = match[2] || '';
  if (!Number.isFinite(number)) return null;
  if (number === 0 && unit === '' && allowZero) return '0';
  const range = bounds[unit];
  if (!range || number < range[0] || number > range[1]) return null;
  return numberText(number) + unit;
}

function color(value: string): string | null {
  if (hexColor.test(value) || namedColors.has(value)) return value;
  const match = /^(rgb|rgba)\(([^()]*)\)$/.exec(value);
  if (!match) return null;
  const parts = match[2].split(',');
  if (parts.length !== (match[1] === 'rgba' ? 4 : 3)) return null;
  const output: string[] = [];
  for (const [index, item] of parts.entries()) {
    const part = item.trim();
    if (index < 3) {
      if (!/^\d+$/.test(part)) return null;
      const number = Number(part);
      if (!Number.isSafeInteger(number) || number < 0 || number > 255) return null;
      output.push(String(number));
    } else {
      const alpha = length(part, { '': [0, 1] });
      if (alpha === null) return null;
      output.push(alpha);
    }
  }
  return `${match[1]}(${output.join(',')})`;
}

function parts(value: string): string[] | null {
  let depth = 0;
  let start = 0;
  const result: string[] = [];
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === '(' && ++depth > 1) return null;
    if (char === ')' && --depth < 0) return null;
    if (char === ' ' && depth === 0) {
      if (index > start) result.push(value.slice(start, index));
      start = index + 1;
    }
  }
  if (depth !== 0) return null;
  if (start < value.length) result.push(value.slice(start));
  return result;
}

function list(value: string, max: number, clean: Cleaner): string | null {
  const items = parts(value);
  if (!items?.length || items.length > max) return null;
  const result = items.map(clean);
  return result.some((item) => item === null) ? null : result.join(' ');
}

function member(value: string, allowed: string[]): string | null {
  return allowed.includes(value) ? value : null;
}

function cleanValue(property: string, value: string): string | null {
  switch (property) {
    case 'color':
    case 'background-color':
      return color(value);
    case 'font-size':
      return length(value, { px: [8, 48], em: [0.5, 3], rem: [0.5, 3], '%': [50, 300] });
    case 'font-weight':
      if (['normal', 'bold', 'bolder', 'lighter'].includes(value)) return value;
      if (/^\d+$/.test(value) && Number(value) >= 100 && Number(value) <= 900)
        return String(Number(value));
      return null;
    case 'font-style':
      return member(value, ['normal', 'italic', 'oblique']);
    case 'display':
      return member(value, ['block', 'inline', 'inline-block']);
    case 'width':
      return value === 'auto'
        ? value
        : length(value, { px: [0, 720], em: [0, 4], rem: [0, 4], '%': [0, 100] }, true);
    case 'height':
      return value === 'auto' ? value : null;
    case 'line-height':
      return value === 'normal'
        ? value
        : length(value, { '': [1, 3], px: [12, 96], em: [1, 3], rem: [1, 3], '%': [100, 300] });
    case 'letter-spacing':
      return value === 'normal'
        ? value
        : length(value, { px: [0, 8], em: [0, 0.5], rem: [0, 0.5] }, true);
    case 'text-align':
      return member(value, ['left', 'right', 'center', 'justify', 'start', 'end']);
    case 'text-decoration':
      return list(value, 3, (part) =>
        member(part, ['none', 'underline', 'line-through', 'overline'])
      );
    case 'text-indent':
      return length(value, { px: [0, 48], em: [0, 3], rem: [0, 3] }, true);
    case 'margin':
    case 'margin-top':
    case 'margin-right':
    case 'margin-bottom':
    case 'margin-left':
    case 'padding':
    case 'padding-top':
    case 'padding-right':
    case 'padding-bottom':
    case 'padding-left':
      return list(value, ['margin', 'padding'].includes(property) ? 4 : 1, (part) => {
        if (property.startsWith('margin') && part === 'auto') return part;
        return length(part, { px: [0, 64], em: [0, 4], rem: [0, 4] }, true);
      });
    case 'border':
    case 'border-top':
    case 'border-right':
    case 'border-bottom':
    case 'border-left': {
      const items = parts(value);
      if (!items?.length || items.length > 3) return null;
      const seen = new Set<string>();
      const output: string[] = [];
      for (const item of items) {
        let kind = '';
        let result = length(item, { px: [0, 4] }, true);
        if (result !== null) kind = 'width';
        else if (borderStyles.has(item)) {
          kind = 'style';
          result = item;
        } else {
          result = color(item);
          if (result !== null) kind = 'color';
        }
        if (!kind || seen.has(kind) || result === null) return null;
        seen.add(kind);
        output.push(result);
      }
      return output.join(' ');
    }
    case 'border-width':
      return list(value, 4, (part) => length(part, { px: [0, 4] }, true));
    case 'border-style':
      return list(value, 4, (part) => (borderStyles.has(part) ? part : null));
    case 'border-color':
      return list(value, 4, color);
    case 'border-radius':
      return list(value, 4, (part) =>
        length(part, { px: [0, 32], em: [0, 2], rem: [0, 2], '%': [0, 50] }, true)
      );
    case 'vertical-align':
      return member(value, [
        'baseline',
        'middle',
        'top',
        'bottom',
        'text-top',
        'text-bottom',
        'sub',
        'super',
      ]);
    default:
      return null;
  }
}

export function sanitizePresentationStyle(input: string): string {
  const hasControlCharacters = Array.from(input).some((character) => {
    const code = character.charCodeAt(0);
    return code === 127 || (code < 32 && ![9, 10, 12, 13].includes(code));
  });
  if (
    /[\\{}<>@]/.test(input) ||
    hasControlCharacters ||
    input.includes('/*') ||
    input.includes('*/')
  )
    return '';
  const declarations = new Map<string, string>();
  for (const part of input.split(';')) {
    const separator = part.indexOf(':');
    if (separator < 0) continue;
    let property = part.slice(0, separator).trim().toLowerCase();
    const value = part
      .slice(separator + 1)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (!value || value.includes('!') || /(?:url|var|expression)\(/.test(value)) continue;
    if (property === 'background') property = 'background-color';
    const clean = cleanValue(property, value);
    if (clean === null) continue;
    declarations.delete(property);
    declarations.set(property, clean);
  }
  return Array.from(declarations, ([property, value]) => `${property}:${value}`).join(';');
}
