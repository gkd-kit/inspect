import type { RawNode } from '@/entities/snapshot/types';
import type { QueryResult } from '@gkd-kit/selector';
import type { ResolvedSelector } from '@/entities/selector/parser';

export interface FastQueryEvidence {
  status: 'supported' | 'unsupported' | 'unknown';
  label: string;
  reason: string;
}

export interface SelectorSearchResult {
  gkd: true;
  key: number;
  selector: ResolvedSelector;
  nodes: RawNode[];
  results: QueryResult<RawNode>[];
  fastQueryEvidence?: FastQueryEvidence;
}

export interface StringSearchResult {
  gkd: false;
  key: number;
  selector: string;
  nodes: RawNode[];
}

export type SearchResult = SelectorSearchResult | StringSearchResult;
