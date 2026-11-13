#!/usr/bin/env node
// Tech debt tracker: every TODO/FIXME/HACK/XXX comment must link to an issue,
// e.g. `TODO(#42): ...` or `FIXME(LAYOVER-7): ...`. Prints the inventory of
// tracked markers and exits 1 when any marker has no issue reference.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MARKERS = ['TODO', 'FIXME', 'HACK', 'XXX'];
export const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.css', '.html', '.yml', '.yaml']);

// Assembled from parts so this file never contains a comment opener followed by a marker.
const COMMENT_OPENER = ['//', '/\\*', '<!-' + '-', '^\\s*\\*', '^\\s*#'].join('|');
// A marker counts only when it starts a comment, so prose that mentions one is not flagged.
const MARKER_PATTERN = new RegExp(`(?:${COMMENT_OPENER})\\s*(${MARKERS.join('|')})\\b(?:\\(([^)]*)\\))?`, 'g');
const ISSUE_REF = /^(#\d+|[A-Z][A-Z0-9]*-\d+)$/;

/** Finds debt markers in comments and reports whether each links to an issue. */
export function findDebtMarkers(source, file) {
  const found = [];
  source.split(/\r?\n/).forEach((text, index) => {
    for (const match of text.matchAll(MARKER_PATTERN)) {
      const ref = match[2]?.trim() ?? null;
      found.push({
        file,
        line: index + 1,
        marker: match[1],
        ref: ref && ISSUE_REF.test(ref) ? ref : null,
        text: text.trim(),
      });
    }
  });
  return found;
}

export function shouldScan(file) {
  return SCANNED_EXTENSIONS.has(extname(file));
}

function listRepoFiles() {
  const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    encoding: 'utf8',
  });
  return output.split('\0').filter(Boolean);
}

function readIfPresent(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

export function formatReport(markers) {
  const tracked = markers.filter((marker) => marker.ref);
  const untracked = markers.filter((marker) => !marker.ref);
  const lines = [`Tech debt markers: ${markers.length} (${tracked.length} tracked, ${untracked.length} untracked)`];
  if (tracked.length > 0) {
    lines.push('', 'Tracked:');
    for (const marker of tracked) lines.push(`  ${marker.file}:${marker.line}  ${marker.marker}(${marker.ref})  ${marker.text}`);
  }
  if (untracked.length > 0) {
    lines.push('', 'Untracked (add an issue reference, e.g. TODO(#123): ...):');
    for (const marker of untracked) lines.push(`  ${marker.file}:${marker.line}  ${marker.marker}  ${marker.text}`);
  }
  return lines.join('\n');
}

function main(args) {
  const files = (args.length > 0 ? args : listRepoFiles()).filter(shouldScan);
  const markers = files.flatMap((file) => {
    const source = readIfPresent(file);
    return source === null ? [] : findDebtMarkers(source, file);
  });
  console.log(formatReport(markers));
  return markers.some((marker) => !marker.ref) ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
