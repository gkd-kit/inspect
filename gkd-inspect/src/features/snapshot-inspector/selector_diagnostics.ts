import { FastQuery, type SelectorMatch } from '@gkd-kit/selector';
import type { RawNode } from '@/entities/snapshot/types';
import type { ResolvedSelector } from '../../entities/selector/parser.ts';
import type { FastQueryEvidence } from './search_types';

export const getFastQueryEvidence = (
  selector: ResolvedSelector,
  results: SelectorMatch<RawNode>[],
): FastQueryEvidence => {
  if (selector.value.fastQueryList.length === 0) {
    return {
      status: 'unsupported',
      label: '无整体快查条件',
      reason:
        '选择器整体没有可用于候选节点查询的快查条件；内部关系遍历是否可优化需单独判断。',
    };
  }

  for (const result of results) {
    for (const unit of result.units) {
      const node = unit.queryNode;
      for (const query of unit.fastQueryList) {
        const field =
          query instanceof FastQuery.Id
            ? 'id'
            : query instanceof FastQuery.Vid
              ? 'vid'
              : query instanceof FastQuery.Text
                ? 'text'
                : undefined;
        if (!field) continue;
        const marked =
          node.quickFind || (field === 'text' ? node.textQf : node.idQf);
        const value = node.attr[field];
        if (!marked || typeof value !== 'string' || !query.accepts(value))
          continue;
        return {
          status: 'supported',
          label: `${field} 快查有依据`,
          reason: `成功匹配分支的候选节点 ${node.id} 的 ${field} 命中该分支快查条件，且快照带有对应快查标记；这不代表客户端运行时实际采用了快查。`,
        };
      }
    }
  }

  return {
    status: 'unknown',
    label: '快查待确认',
    reason:
      '选择器包含快查条件，但成功匹配分支的候选节点缺少对应快照证据；无法确认客户端运行时是否采用快查。',
  };
};
