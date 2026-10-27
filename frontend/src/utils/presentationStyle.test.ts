import { describe, expect, it } from 'vitest';
import { sanitizePresentationStyle } from './presentationStyle';
import cases from '../../../internal/utils/textutil/testdata/presentation_styles.json';

describe('shared source-presentation policy', () => {
  it.each(cases)('agrees with the backend policy for $input', ({ input, expected }) => {
    expect(sanitizePresentationStyle(input)).toBe(expected);
    expect(sanitizePresentationStyle(expected)).toBe(expected);
  });
});
