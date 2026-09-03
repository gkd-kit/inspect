import type { RawNode } from '@/entities/snapshot/types';
import type { QueryResult } from '@gkd-kit/selector';
import type { ResolvedSelector } from './parser';

export interface SelectorTrackData {
  nodes: RawNode[];
  queryResult: QueryResult<RawNode>;
  selector: ResolvedSelector;
}
