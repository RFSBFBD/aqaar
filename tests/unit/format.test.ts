import { describe, it, expect } from 'vitest';
import { formatMinorUnits, majorInputToMinorString, minorStringToMajorInput } from '@/lib/format';

describe('Minor-unit string formatting & parsing (no floats)', () => {
  it('formats BigInt minor-unit strings accurately', () => {
    expect(formatMinorUnits('85000000')).toBe('850,000.00');
    expect(formatMinorUnits('10005')).toBe('100.05');
    expect(formatMinorUnits('0')).toBe('0.00');
    expect(formatMinorUnits('9007199254740993123')).toBe('90,071,992,547,409,931.23');
  });

  it('parses major-unit user input into exact minor-unit strings without float loss', () => {
    expect(majorInputToMinorString('850000')).toBe('85000000');
    expect(majorInputToMinorString('100.5')).toBe('10050');
    expect(majorInputToMinorString('1,250.09')).toBe('125009');
    expect(() => majorInputToMinorString('10.123')).toThrow();
    expect(() => majorInputToMinorString('-50')).toThrow();
    expect(() => majorInputToMinorString('abc')).toThrow();
    expect(minorStringToMajorInput('85000000')).toBe('850000');
    expect(minorStringToMajorInput('85000050')).toBe('850000.50');
  });
});
