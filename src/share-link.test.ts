import { describe, expect, it, vi } from 'vitest';
import { copyText, parseQuery, shareUrl, toQuery, type LayoverInputs } from './share-link.ts';

const codes = ['ORD', 'LHR'];
const inputs: LayoverInputs = { airport: 'ORD', arrival: '2026-11-13T12:00', hours: 5, minutes: 30, international: true };
const query = 'airport=ORD&arrival=2026-11-13T12%3A00&hours=5&minutes=30&international=1';

describe('toQuery', () => {
  it('encodes every input', () => {
    expect(toQuery(inputs)).toBe(query);
  });

  it('writes international as 0 for domestic arrivals', () => {
    expect(toQuery({ ...inputs, international: false })).toContain('international=0');
  });
});

describe('parseQuery', () => {
  it('reads back what toQuery wrote', () => {
    expect(parseQuery(`?${query}`, codes)).toEqual(inputs);
    expect(parseQuery(toQuery({ ...inputs, international: false, hours: 0, minutes: 0 }), codes)).toEqual({
      ...inputs,
      international: false,
      hours: 0,
      minutes: 0,
    });
  });

  it('accepts an unencoded colon in the arrival time', () => {
    expect(parseQuery('?airport=LHR&arrival=2026-11-13T07:45&hours=23&minutes=55&international=0', codes)).toEqual({
      airport: 'LHR',
      arrival: '2026-11-13T07:45',
      hours: 23,
      minutes: 55,
      international: false,
    });
  });

  it('returns null for an empty query', () => {
    expect(parseQuery('', codes)).toBeNull();
    expect(parseQuery('?', codes)).toBeNull();
  });

  it.each(['airport', 'arrival', 'hours', 'minutes', 'international'])('returns null when %s is missing', (name) => {
    const params = new URLSearchParams(query);
    params.delete(name);
    expect(parseQuery(params.toString(), codes)).toBeNull();
  });

  it.each([
    ['airport', 'XYZ'],
    ['airport', 'ord'],
    ['arrival', 'tomorrow'],
    ['arrival', '2026-11-13'],
    ['arrival', '2026-02-30T12:00'],
    ['arrival', '2026-11-13T25:00'],
    ['arrival', '2026-11-13T12:00:00'],
    ['hours', '24'],
    ['hours', '-1'],
    ['hours', '2.5'],
    ['hours', 'five'],
    ['hours', ''],
    ['minutes', '60'],
    ['minutes', '7'],
    ['minutes', '1e1'],
    ['international', 'yes'],
    ['international', 'true'],
  ])('returns null when %s is %j', (name, value) => {
    const params = new URLSearchParams(query);
    params.set(name, value);
    expect(parseQuery(params.toString(), codes)).toBeNull();
  });

  it('ignores unrelated parameters', () => {
    expect(parseQuery(`?${query}&utm_source=chat`, codes)).toEqual(inputs);
  });
});

describe('shareUrl', () => {
  it('replaces the query and drops the hash, keeping the path', () => {
    expect(shareUrl('https://example.com/layover/?airport=LHR#result', inputs)).toBe(`https://example.com/layover/?${query}`);
  });
});

describe('copyText', () => {
  it('returns true when the clipboard write succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await copyText('https://example.com/?a=1', writeText)).toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://example.com/?a=1');
  });

  it('returns false when the clipboard write fails', async () => {
    expect(await copyText('x', vi.fn().mockRejectedValue(new Error('denied')))).toBe(false);
  });

  it('returns false when there is no clipboard', async () => {
    expect(await copyText('x', undefined)).toBe(false);
  });
});
