import JSON5 from 'json5';
import { parseSelector } from '../../domain/selector/parser.ts';

type JsonObject = Record<string, unknown>;

interface RuleCandidate {
  group?: JsonObject;
  path: string;
  rule: JsonObject;
}

export interface RuleDiagnosticDetails {
  matchedSelectors: string[];
  rejectedSelectors: string[];
  rulePath?: string;
}

export type RuleDiagnostic =
  | { status: 'empty' }
  | { status: 'invalid'; message: string }
  | {
      status: 'not-matched';
      message: string;
      details: RuleDiagnosticDetails;
      notes: string[];
    }
  | {
      status: 'matched';
      message: string;
      targetNode: RawNode;
      details: RuleDiagnosticDetails;
      notes: string[];
    };

const isObject = (value: unknown): value is JsonObject =>
  typeof value == 'object' && value != null && !Array.isArray(value);

const toStringArray = (
  value: unknown,
  field: string,
): { values?: string[]; error?: string } => {
  if (value == null) return { values: [] };
  if (typeof value == 'string') return { values: [value] };
  if (Array.isArray(value) && value.every((item) => typeof item == 'string')) {
    return { values: value };
  }
  return { error: `${field} 必须是字符串或字符串数组` };
};

const hasOwn = (value: JsonObject, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

const inheritedValue = (
  rule: JsonObject,
  group: JsonObject | undefined,
  key: string,
) => (hasOwn(rule, key) ? rule[key] : group?.[key]);

const normalizeActivityId = (appId: string, activityId: string) =>
  activityId.startsWith('.') ? appId + activityId : activityId;

type ActivityDiagnostic =
  | { status: 'valid' }
  | { status: 'invalid' | 'mismatch'; message: string };

const matchActivity = (
  snapshot: Snapshot,
  rule: JsonObject,
  group?: JsonObject,
): ActivityDiagnostic => {
  const activityResult = toStringArray(
    inheritedValue(rule, group, 'activityIds'),
    'activityIds',
  );
  if (activityResult.error) {
    return { status: 'invalid', message: activityResult.error };
  }
  const excludeResult = toStringArray(
    inheritedValue(rule, group, 'excludeActivityIds'),
    'excludeActivityIds',
  );
  if (excludeResult.error) {
    return { status: 'invalid', message: excludeResult.error };
  }

  if (
    excludeResult.values?.some((value) =>
      snapshot.activityId.startsWith(
        normalizeActivityId(snapshot.appId, value),
      ),
    )
  ) {
    return {
      status: 'mismatch',
      message: `当前界面 ${snapshot.activityId} 被 excludeActivityIds 排除`,
    };
  }
  if (
    activityResult.values?.length &&
    !activityResult.values.some((value) =>
      snapshot.activityId.startsWith(
        normalizeActivityId(snapshot.appId, value),
      ),
    )
  ) {
    return {
      status: 'mismatch',
      message: `当前界面 ${snapshot.activityId} 未命中 activityIds`,
    };
  }
  return { status: 'valid' };
};

const runtimeFieldLabels: Record<string, string> = {
  preKeys: '前置规则执行状态',
  actionCdKey: '共享冷却状态',
  actionMaximumKey: '共享执行次数',
  actionMaximum: '执行次数上限',
  actionCd: '执行冷却时间',
  matchDelay: '匹配延迟',
  actionDelay: '操作延迟',
  forcedTime: '强制匹配时段',
  priorityTime: '优先匹配时段',
  priorityActionMaximum: '优先执行次数',
  versionCode: '版本代码条件',
  versionName: '版本名称条件',
  versionCodes: '版本代码条件',
  versionNames: '版本名称条件',
  excludeVersionCodes: '版本代码排除条件',
  excludeVersionNames: '版本名称排除条件',
};

const getRuntimeNotes = (rule: JsonObject, group?: JsonObject): string[] => {
  const notes: string[] = [];
  for (const [key, label] of Object.entries(runtimeFieldLabels)) {
    if (inheritedValue(rule, group, key) != null) {
      notes.push(`${label}（${key}）依赖运行时状态，本次未验证`);
    }
  }
  if (group?.enable === false) {
    notes.push('规则组默认禁用，实际是否启用取决于客户端配置');
  }
  if (rule.enable === false) {
    notes.push('规则默认禁用，实际是否启用取决于客户端配置');
  }
  return notes;
};

const normalizeRule = (value: unknown): JsonObject | undefined => {
  if (typeof value == 'string') return { matches: value };
  return isObject(value) ? value : undefined;
};

const collectGroups = (
  value: unknown,
  basePath: string,
): { candidates?: RuleCandidate[]; error?: string } => {
  const groups = Array.isArray(value) ? value : [value];
  const candidates: RuleCandidate[] = [];
  for (const [groupIndex, groupValue] of groups.entries()) {
    if (!isObject(groupValue)) {
      return { error: `${basePath}[${groupIndex}] 必须是对象` };
    }
    const rulesValue = groupValue.rules;
    if (rulesValue == null) {
      return { error: `${basePath}[${groupIndex}].rules 缺失` };
    }
    const rules = Array.isArray(rulesValue) ? rulesValue : [rulesValue];
    for (const [ruleIndex, ruleValue] of rules.entries()) {
      const rule = normalizeRule(ruleValue);
      if (!rule) {
        return {
          error: `${basePath}[${groupIndex}].rules[${ruleIndex}] 必须是对象或字符串`,
        };
      }
      candidates.push({
        group: groupValue,
        path: `${basePath}[${groupIndex}].rules[${ruleIndex}]`,
        rule,
      });
    }
  }
  return { candidates };
};

const collectCandidates = (
  input: JsonObject,
  snapshot: Snapshot,
): { candidates?: RuleCandidate[]; error?: string; mismatch?: string } => {
  if (input.apps != null) {
    if (!Array.isArray(input.apps)) return { error: 'apps 必须是数组' };
    const appIndex = input.apps.findIndex(
      (app) => isObject(app) && app.id == snapshot.appId,
    );
    if (appIndex < 0) {
      return { mismatch: `apps 中没有当前应用 ${snapshot.appId}` };
    }
    const app = input.apps[appIndex];
    if (!isObject(app)) return { error: `apps[${appIndex}] 必须是对象` };
    return collectGroups(app.groups, `apps[${appIndex}].groups`);
  }

  if (typeof input.id == 'string' && input.groups != null) {
    if (input.id != snapshot.appId) {
      return {
        mismatch: `规则应用 ${input.id} 与当前应用 ${snapshot.appId} 不一致`,
      };
    }
    return collectGroups(input.groups, 'groups');
  }

  if (input.groups != null) return collectGroups(input.groups, 'groups');
  if (input.rules != null) return collectGroups(input, 'group');
  return { candidates: [{ path: 'rule', rule: input }] };
};

const querySelectors = (
  values: string[],
  field: string,
  rootNode: RawNode,
): { results?: RawNode[][]; error?: string } => {
  const results: RawNode[][] = [];
  for (const [index, source] of values.entries()) {
    try {
      results.push(parseSelector(source).querySelfOrSelectorAll(rootNode));
    } catch (error) {
      return {
        error: `${field}[${index}] 选择器非法：${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }
  return { results };
};

const evaluateCandidate = (
  candidate: RuleCandidate,
  snapshot: Snapshot,
  rootNode: RawNode,
): RuleDiagnostic => {
  const notes = getRuntimeNotes(candidate.rule, candidate.group);
  const activityDiagnostic = matchActivity(
    snapshot,
    candidate.rule,
    candidate.group,
  );
  if (activityDiagnostic.status == 'invalid') {
    return { status: 'invalid', message: activityDiagnostic.message };
  }
  if (activityDiagnostic.status == 'mismatch') {
    return {
      status: 'not-matched',
      message: activityDiagnostic.message,
      details: {
        matchedSelectors: [],
        rejectedSelectors: [],
        rulePath: candidate.path,
      },
      notes,
    };
  }

  const selectorFields = [
    'matches',
    'anyMatches',
    'excludeMatches',
    'excludeAllMatches',
  ] as const;
  const selectorValues = {} as Record<
    (typeof selectorFields)[number],
    string[]
  >;
  for (const field of selectorFields) {
    const result = toStringArray(candidate.rule[field], field);
    if (result.error) return { status: 'invalid', message: result.error };
    selectorValues[field] = result.values ?? [];
  }
  if (!selectorValues.matches.length && !selectorValues.anyMatches.length) {
    return {
      status: 'invalid',
      message: `${candidate.path} 的 matches 和 anyMatches 至少需要一个`,
    };
  }

  const queryResults = {} as Record<
    (typeof selectorFields)[number],
    RawNode[][]
  >;
  for (const field of selectorFields) {
    const result = querySelectors(selectorValues[field], field, rootNode);
    if (result.error) return { status: 'invalid', message: result.error };
    queryResults[field] = result.results ?? [];
  }

  const matchedSelectors: string[] = [];
  const rejectedSelectors: string[] = [];
  queryResults.matches.forEach((nodes, index) =>
    (nodes.length ? matchedSelectors : rejectedSelectors).push(
      `matches[${index}]`,
    ),
  );
  queryResults.anyMatches.forEach((nodes, index) =>
    (nodes.length ? matchedSelectors : rejectedSelectors).push(
      `anyMatches[${index}]`,
    ),
  );
  const details = {
    matchedSelectors,
    rejectedSelectors,
    rulePath: candidate.path,
  };

  const missingMatch = queryResults.matches.findIndex((nodes) => !nodes.length);
  if (missingMatch >= 0) {
    return {
      status: 'not-matched',
      message: `matches[${missingMatch}] 没有匹配节点`,
      details,
      notes,
    };
  }
  if (
    queryResults.anyMatches.length &&
    queryResults.anyMatches.every((nodes) => !nodes.length)
  ) {
    return {
      status: 'not-matched',
      message: 'anyMatches 中没有选择器匹配节点',
      details,
      notes,
    };
  }
  const excludeIndex = queryResults.excludeMatches.findIndex(
    (nodes) => nodes.length,
  );
  if (excludeIndex >= 0) {
    return {
      status: 'not-matched',
      message: `excludeMatches[${excludeIndex}] 命中排除节点`,
      details,
      notes,
    };
  }
  if (
    queryResults.excludeAllMatches.length &&
    queryResults.excludeAllMatches.every((nodes) => nodes.length)
  ) {
    return {
      status: 'not-matched',
      message: 'excludeAllMatches 的所有选择器均命中',
      details,
      notes,
    };
  }

  const targetNode = queryResults.matches.length
    ? queryResults.matches.at(-1)![0]
    : queryResults.anyMatches.find((nodes) => nodes.length)?.[0];
  if (!targetNode) {
    return {
      status: 'not-matched',
      message: '没有找到规则目标节点',
      details,
      notes,
    };
  }
  return {
    status: 'matched',
    message: notes.length
      ? '静态条件匹配，仍有运行时条件未验证'
      : '静态条件匹配',
    targetNode,
    details,
    notes,
  };
};

export const evaluateRuleText = (
  source: string,
  snapshot: Snapshot,
  rootNode: RawNode,
): RuleDiagnostic => {
  if (!source.trim()) return { status: 'empty' };
  let input: unknown;
  try {
    input = JSON5.parse(source);
  } catch (error) {
    return {
      status: 'invalid',
      message: `JSON5 格式错误：${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!isObject(input)) {
    return { status: 'invalid', message: '请输入规则、规则组、应用或订阅对象' };
  }
  const collected = collectCandidates(input, snapshot);
  if (collected.error) return { status: 'invalid', message: collected.error };
  if (collected.mismatch) {
    return {
      status: 'not-matched',
      message: collected.mismatch,
      details: { matchedSelectors: [], rejectedSelectors: [] },
      notes: [],
    };
  }
  const diagnostics = (collected.candidates ?? []).map((candidate) =>
    evaluateCandidate(candidate, snapshot, rootNode),
  );
  const matched = diagnostics.find((result) => result.status == 'matched');
  if (matched) return matched;
  const invalid = diagnostics.find((result) => result.status == 'invalid');
  if (invalid) return invalid;
  return (
    diagnostics[0] ?? {
      status: 'invalid',
      message: '没有可诊断的规则',
    }
  );
};
