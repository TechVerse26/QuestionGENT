import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { Packer } from 'docx';
import { paginate } from '../src/preview/paginate.js';
import { buildDocxDocument } from '../src/export/docxExport.js';
import { buildSamplePaper } from '../src/constants/samplePaper.js';

test('paginate: fills pages, keeps glued atoms together, splits oversized chains', () => {
  assert.deepEqual(paginate([50, 50, 50, 50, 50], [false, false, false, false, false], 200), [[0, 1, 2, 3], [4]]);
  // atom 3 is glued to atom 4: both move to the next page together
  assert.deepEqual(paginate([100, 60, 30, 30, 40], [false, false, false, true, false], 200), [[0, 1, 2], [3, 4]]);
  // a chain taller than a page is split between atoms instead of being dropped
  assert.deepEqual(paginate([50, 50, 50, 50, 50, 300, 20], [false, false, false, false, true, false, false], 200), [[0, 1, 2, 3], [4], [5], [6]]);
  assert.deepEqual(paginate([], [], 200), [[]]);
});

test('docx export builds a valid file with Bengali text, tab stops and page-number fields', async () => {
  const { paper, items } = buildSamplePaper();
  const keys = Object.fromEntries(Object.values(items).filter((q) => q.type === 'mcq').map((q) => [q.id, { correct: [q.body.options[1].id], explanation: null }]));
  for (const mode of ['paper', 'key']) {
    const buf = await Packer.toBuffer(await buildDocxDocument({ paper, items, keys, mode }));
    const zip = await JSZip.loadAsync(buf);
    const doc = await zip.file('word/document.xml').async('string');
    assert.ok(doc.includes('ক-বিভাগ'), 'section heading present');
    assert.ok(doc.includes('w:szCs'), 'complex-script font size set for Bengali');
    assert.ok(doc.includes('w:val="right"'), 'right tab stop for marks');
    const footer = Object.keys(zip.files).find((n) => /^word\/footer\d*\.xml$/.test(n));
    assert.ok(footer, 'footer part exists');
    const f = await zip.file(footer).async('string');
    assert.ok(f.includes('PAGE') && f.includes('NUMPAGES'), 'page number fields');
  }
});
