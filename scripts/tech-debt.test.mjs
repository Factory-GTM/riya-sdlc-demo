import { describe, expect, it } from 'vitest';
import { findDebtMarkers, formatReport, shouldScan } from './tech-debt.mjs';

// Built from parts so this test file does not trip the scanner itself.
const TODO = 'TO' + 'DO';
const FIXME = 'FIX' + 'ME';
const HACK = 'HA' + 'CK';

describe('findDebtMarkers', () => {
  it('accepts markers that link to a GitHub issue or tracker key', () => {
    const source = [`// ${TODO}(#12): cache forecasts`, `/* ${FIXME}(LAYOVER-7): handle DST */`].join('\n');
    expect(findDebtMarkers(source, 'src/a.ts')).toEqual([
      { file: 'src/a.ts', line: 1, marker: TODO, ref: '#12', text: `// ${TODO}(#12): cache forecasts` },
      { file: 'src/a.ts', line: 2, marker: FIXME, ref: 'LAYOVER-7', text: `/* ${FIXME}(LAYOVER-7): handle DST */` },
    ]);
  });

  it('flags markers without a valid issue reference', () => {
    const source = [`// ${TODO}: cache forecasts`, `// ${HACK}(riya): temporary`, `// ${TODO}(): empty`].join('\n');
    const markers = findDebtMarkers(source, 'src/a.ts');
    expect(markers.map((marker) => [marker.line, marker.marker, marker.ref])).toEqual([
      [1, TODO, null],
      [2, HACK, null],
      [3, TODO, null],
    ]);
  });

  it('finds markers in CSS, HTML, YAML and JSDoc comments', () => {
    const source = [
      `.card { color: red; } /* ${TODO}: theme */`,
      `<!-- ${TODO}(#3): add a footer -->`,
      `# ${FIXME}: pin the action`,
      ` * ${TODO}: document params`,
    ].join('\n');
    expect(findDebtMarkers(source, 'x').map((marker) => [marker.line, marker.ref])).toEqual([
      [1, null],
      [2, '#3'],
      [3, null],
      [4, null],
    ]);
  });

  it('ignores marker words outside comments and inside other words', () => {
    const source = [`const label = '${TODO} list';`, `// ${TODO}S are tracked elsewhere`, '// Mastodon'].join('\n');
    expect(findDebtMarkers(source, 'src/a.ts')).toEqual([]);
  });

  it('ignores comments that only mention a marker in prose', () => {
    const source = `// Every ${TODO} needs an issue, e.g. ${TODO}(#1).`;
    expect(findDebtMarkers(source, 'src/a.ts')).toEqual([]);
  });
});

describe('shouldScan', () => {
  it('scans code, style, markup and CI files only', () => {
    expect(shouldScan('src/main.ts')).toBe(true);
    expect(shouldScan('src/styles.css')).toBe(true);
    expect(shouldScan('.github/workflows/ci.yml')).toBe(true);
    expect(shouldScan('README.md')).toBe(false);
    expect(shouldScan('src/data/airports.json')).toBe(false);
  });
});

describe('formatReport', () => {
  it('summarises tracked and untracked markers', () => {
    const markers = findDebtMarkers([`// ${TODO}(#1): a`, `// ${FIXME}: b`].join('\n'), 'src/a.ts');
    const report = formatReport(markers);
    expect(report).toContain('Tech debt markers: 2 (1 tracked, 1 untracked)');
    expect(report).toContain(`src/a.ts:1  ${TODO}(#1)`);
    expect(report).toContain(`src/a.ts:2  ${FIXME}  // ${FIXME}: b`);
  });
});
