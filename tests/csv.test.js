import { describe, it, expect } from 'vitest';
import { parseCsv } from '../frontend/src/lib/csv.js';

describe('parseCsv', () => {
  it('parses a simple header + rows', () => {
    const rows = parseCsv('name,phone\nAlice,9999999999\nBob,8888888888');
    expect(rows).toEqual([
      { name: 'Alice', phone: '9999999999' },
      { name: 'Bob', phone: '8888888888' }
    ]);
  });

  it('handles quoted fields containing commas', () => {
    const rows = parseCsv('teamName,note\n"Smith, Jones",""');
    expect(rows).toEqual([{ teamName: 'Smith, Jones', note: '' }]);
  });

  it('handles escaped quotes inside a quoted field', () => {
    const rows = parseCsv('teamName\n"The ""A"" Team"');
    expect(rows).toEqual([{ teamName: 'The "A" Team' }]);
  });

  it('skips blank lines', () => {
    const rows = parseCsv('name\nAlice\n\nBob\n');
    expect(rows).toHaveLength(2);
  });

  it('returns an empty array for empty input', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('   \n  ')).toEqual([]);
  });

  it('pads missing trailing fields with empty strings', () => {
    const rows = parseCsv('name,phone,email\nAlice,9999999999');
    expect(rows).toEqual([{ name: 'Alice', phone: '9999999999', email: '' }]);
  });
});
