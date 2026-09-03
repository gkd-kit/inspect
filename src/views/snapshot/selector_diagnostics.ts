import { FastQuery, type QueryResult } from '@gkd-kit/selector';
import type { ResolvedSelector } from '../../domain/selector/parser.ts';

import type { FastQueryEvidence } from './search_types';

const getQueryContextNode = (
  result: QueryResult<RawNode>,
): RawNode | undefined => result.context.toArray().at(-1);

export const getFastQueryEvidence = (
  selector: ResolvedSelector,
  results: QueryResult<RawNode>[],
): FastQueryEvidence => {
  if (selector.fastQueryList.length == 0) {
    return {
      status: 'unsupported',
      label: '未启用快查',
      reason: '选择器没有可转换为 id、vid 或 text 快查条件的表达式。',
    };
  }

  for (const result of results) {
    const node = getQueryContextNode(result);
    if (!node) continue;
    if (
      (node.quickFind || node.idQf) &&
      node.attr.id &&
      selector.fastQueryList.some(
        (query) =>
          query instanceof FastQuery.Id && query.acceptText(node.attr.id!),
      )
    ) {
      return {
        status: 'supported',
        label: 'id 快查可用',
        reason: `目标节点的 id「${node.attr.id}」命中选择器快查条件。`,
      };
    }
    if (
      (node.quickFind || node.idQf) &&
      node.attr.vid &&
      selector.fastQueryList.some(
        (query) =>
          query instanceof FastQuery.Vid && query.acceptText(node.attr.vid!),
      )
    ) {
      return {
        status: 'supported',
        label: 'vid 快查可用',
        reason: `目标节点的 vid「${node.attr.vid}」命中选择器快查条件。`,
      };
    }
    if (
      (node.quickFind || node.textQf) &&
      node.attr.text &&
      selector.fastQueryList.some(
        (query) =>
          query instanceof FastQuery.Text && query.acceptText(node.attr.text!),
      )
    ) {
      return {
        status: 'supported',
        label: 'text 快查可用',
        reason: '目标节点的 text 命中选择器快查条件。',
      };
    }
  }

  return {
    status: 'unknown',
    label: '快查待确认',
    reason:
      '选择器包含快查条件，但当前匹配目标没有对应的 quickFind 标记；仅凭快照无法确认客户端运行时是否会采用快查。',
  };
};
