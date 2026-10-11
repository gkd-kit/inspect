import assert from 'node:assert/strict';
import test from 'node:test';
import type { RawNode } from '../../entities/snapshot/types.ts';
import { parseSelector } from '../../entities/selector/parser.ts';
import { getFastQueryEvidence } from './selector_diagnostics.ts';

const node = (
  id: number,
  attrs: Partial<RawNode['attr']> = {},
  parent?: RawNode,
): RawNode => {
  const result: RawNode = {
    id,
    pid: parent?.id ?? -1,
    parent,
    children: [],
    attr: {
      name: 'TextView',
      isClickable: false,
      childCount: 0,
      index: 0,
      depth: parent ? parent.attr.depth + 1 : 0,
      left: 0,
      top: 0,
      right: 1,
      bottom: 1,
      width: 1,
      height: 1,
      ...attrs,
    },
  };
  if (parent) {
    result.attr.index = parent.children.length;
    parent.children.push(result);
    parent.attr.childCount = parent.children.length;
  }
  return result;
};
const evidence = (source: string, root: RawNode) => {
  const selector = parseSelector(source);
  return getFastQueryEvidence(
    selector,
    selector.querySelfOrSelectorAllWithTrace(root),
  );
};

test('distinguishes missing engine filters from missing snapshot evidence', () => {
  const root = node(0, { text: '预约' });
  root.quickFind = true;
  assert.equal(evidence('[depth=0]', root).status, 'unsupported');
  // Only the first filter supplies the engine candidate filters.
  assert.equal(evidence('[depth=0][text="预约"]', root).status, 'unsupported');
  root.quickFind = false;
  assert.equal(evidence('[text="预约"]', root).status, 'unknown');
});

test('id and vid require id evidence; text requires text evidence', () => {
  for (const field of ['id', 'vid', 'text'] as const) {
    const root = node(0, { [field]: 'value' });
    root[field === 'text' ? 'idQf' : 'textQf'] = true;
    assert.equal(evidence(`[${field}="value"]`, root).status, 'unknown');
    root[field === 'text' ? 'textQf' : 'idQf'] = true;
    assert.equal(
      evidence(`[${field}="value"]`, root).label,
      `${field} 快查有依据`,
    );
    root.idQf = root.textQf = false;
    root.quickFind = true;
    assert.equal(evidence(`[${field}="value"]`, root).status, 'supported');
  }
});

test('text comparison delegates equality, prefix, suffix and inclusion to the engine', () => {
  const root = node(0, { text: '预约成功' });
  root.textQf = true;
  for (const source of [
    '[text="预约成功"]',
    '[text^="预约"]',
    '[text$="成功"]',
    '[text*="约成"]',
  ]) {
    assert.equal(evidence(source, root).status, 'supported', source);
  }
});

test('@ return target cannot substitute for the starting candidate', () => {
  const root = node(0, { text: '预约' });
  const child = node(1, { text: '预约' }, root);
  root.textQf = true;
  const source = '@[parent=null] >n [text="预约"]';
  const selector = parseSelector(source);
  const matches = selector.querySelfOrSelectorAllWithTrace(root);
  assert.equal(matches[0].target, root);
  assert.equal(matches[0].units[0].queryNode, child);
  assert.equal(getFastQueryEvidence(selector, matches).status, 'unknown');
  root.textQf = false;
  child.textQf = true;
  assert.equal(evidence(source, root).status, 'supported');
});

test('failed OR branch filters are not paired with a successful branch marker', () => {
  const root = node(0, { text: '预约', id: 'other' });
  root.idQf = true;
  const source = '([id="missing"]) || ([text="预约"])';
  assert.equal(evidence(source, root).status, 'unknown');
  root.textQf = true;
  assert.equal(evidence(source, root).label, 'text 快查有依据');
});

test('a branch filter does not imply the whole OR expression has candidate filters', () => {
  const root = node(0, { text: '预约' });
  root.textQf = true;
  assert.equal(
    evidence('([text="预约"]) || ([depth=0])', root).status,
    'unsupported',
  );
});
