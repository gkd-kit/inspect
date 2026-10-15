import type { RawNode } from '@/entities/snapshot/types';
import type { SelectorMatch } from '@gkd-kit/selector';
import type { ResolvedSelector } from './parser';

export interface SelectorTrackData {
  nodes: RawNode[];
  queryResult: SelectorMatch<RawNode>;
  selector: ResolvedSelector;
}
