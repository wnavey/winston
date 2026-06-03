// @ts-nocheck
// Research Appendix — 12713 Cinchring Ln, Austin TX 78727

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  NoeticDocument,
  CoverPage,
  NoeticPage,
  MarkdownBody,
} from '../index';

const md = fs.readFileSync(
  path.resolve(import.meta.dirname, '12713-cinchring-appendix.md'),
  'utf-8',
);

// Strip the H1 + lead-in; body starts at first "# Part " heading.
const body = md.replace(/^# Research Appendix[\s\S]*?(?=^# Part )/m, '');

const MAX_LINES_PER_CHUNK = 230;
const STUB_THRESHOLD = 80;

function splitByHeading(text, maxLevel) {
  const headerRe =
    maxLevel === 1
      ? /^# (?!#)/
      : maxLevel === 2
        ? /^#{1,2} (?!#)/
        : /^#{1,3} (?!#)/;
  const lines = text.split('\n');
  const chunks = [];
  let current = [];
  const flush = () => {
    if (current.length > 0) {
      chunks.push(current.join('\n').trim());
      current = [];
    }
  };
  for (const line of lines) {
    if (headerRe.test(line) && current.length > 0) flush();
    current.push(line);
  }
  flush();
  return chunks.filter((c) => c.length > 0);
}

const lines = (s) => s.split('\n').length;

function mergePass(input) {
  let changed = false;
  const out = [];
  for (let idx = 0; idx < input.length; idx++) {
    const chunk = input[idx];
    if (lines(chunk) < STUB_THRESHOLD) {
      if (out.length > 0 && lines(out[out.length - 1]) + lines(chunk) + 1 <= MAX_LINES_PER_CHUNK) {
        out[out.length - 1] = out[out.length - 1] + '\n\n' + chunk;
        changed = true;
        continue;
      }
      const next = input[idx + 1];
      if (next && lines(chunk) + lines(next) + 1 <= MAX_LINES_PER_CHUNK) {
        input[idx + 1] = chunk + '\n\n' + next;
        changed = true;
        continue;
      }
    }
    out.push(chunk);
  }
  return { out, changed };
}

function coalescePass(input) {
  const out = [];
  for (const chunk of input) {
    if (out.length > 0 && lines(out[out.length - 1]) + lines(chunk) + 1 <= MAX_LINES_PER_CHUNK) {
      out[out.length - 1] = out[out.length - 1] + '\n\n' + chunk;
      continue;
    }
    out.push(chunk);
  }
  return out;
}

function chunkSections(text) {
  const primary = splitByHeading(text, 1);
  const atomic = [];
  for (const section of primary) {
    if (lines(section) <= MAX_LINES_PER_CHUNK) {
      atomic.push(section);
      continue;
    }
    const secondary = splitByHeading(section, 2);
    for (const sub of secondary) {
      if (lines(sub) <= MAX_LINES_PER_CHUNK) {
        atomic.push(sub);
        continue;
      }
      const tertiary = splitByHeading(sub, 3);
      if (tertiary.length === 1) atomic.push(sub);
      else atomic.push(...tertiary);
    }
  }
  let current = atomic;
  for (let pass = 0; pass < 10; pass++) {
    const result = mergePass([...current]);
    current = result.out;
    if (!result.changed) break;
  }
  return coalescePass(current);
}

function stripBoundaryHRs(text) {
  let out = text.trim();
  while (/(\n|^)-{3,}\s*$/.test(out)) out = out.replace(/(\n|^)-{3,}\s*$/, '').trimEnd();
  while (/^\s*-{3,}\s*\n/.test(out)) out = out.replace(/^\s*-{3,}\s*\n/, '').trimStart();
  return out;
}

const sections = chunkSections(body).map(stripBoundaryHRs);

function Report() {
  return (
    <NoeticDocument title="Research Appendix — 12713 Cinchring Ln">
      <CoverPage
        title="Research Appendix"
        subtitle="Supporting research for 12713 Cinchring Ln, Austin, TX 78727"
        date="June 3, 2026"
        metadata={[
          { label: 'Property', value: '12713 Cinchring Ln, Austin, TX 78727' },
          { label: 'Project', value: 'Demolish existing single-family residence; construct duplex (2 units)' },
          { label: 'Compiled', value: 'June 3, 2026' },
          { label: 'Contents', value: 'Topical research + discipline assessments + synthesis' },
          { label: 'Prepared by', value: 'Noetic' },
        ]}
        tocItems={[
          'Part I — Topical Research (Property Records, Zoning, Restrictive Covenants, Programs, Neighborhood Plan, Environmental, Transportation, Web Follow-ups)',
          'Part II — Discipline Assessments (Zoning, Site, Stormwater, Floodplain, Environmental, Trees, Transportation, Water, Fire, Parkland)',
          'Part III — Synthesis (Issue Matrix + Recovery Log)',
        ]}
      />

      {sections.map((section, i) => (
        <NoeticPage key={i}>
          <MarkdownBody markdown={section} />
        </NoeticPage>
      ))}
    </NoeticDocument>
  );
}

export default <Report />;
