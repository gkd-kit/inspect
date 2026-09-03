import type { TreeOption } from 'naive-ui';
import { CRASH_TREE_KEY, getCrashEntries, isCrashPath } from './crash_preview';
import {
  getLogDirectoryEntries,
  getSubscriptionDirectoryEntries,
  isLogDirectoryPath,
  isSubscriptionDirectoryPath,
  LOG_TREE_KEY,
  SUBSCRIPTION_TREE_KEY,
} from './directory_preview';
import type { LogArchive } from './log';

export type LogTreeOption = TreeOption & {
  path?: string;
  isFile?: boolean;
};

export const buildLogTreeData = (archive?: LogArchive): LogTreeOption[] => {
  const roots: LogTreeOption[] = [];
  const nodes = new Map<string, LogTreeOption>();
  const entries = archive?.entries || [];
  const crashEntries = getCrashEntries(entries);
  const logEntries = getLogDirectoryEntries(entries);
  const subscriptionEntries = getSubscriptionDirectoryEntries(entries);
  for (const entry of entries) {
    if (
      isCrashPath(entry.path) ||
      isLogDirectoryPath(entry.path) ||
      isSubscriptionDirectoryPath(entry.path)
    ) {
      continue;
    }
    const parts = entry.path.split(`/`).filter(Boolean);
    let parentChildren = roots;
    let currentPath = ``;
    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let node = nodes.get(currentPath);
      if (!node) {
        const isFile = index == parts.length - 1;
        node = {
          key: currentPath,
          label: part,
          path: isFile ? entry.path : undefined,
          isFile,
          children: isFile ? undefined : [],
        };
        nodes.set(currentPath, node);
        parentChildren.push(node);
      }
      parentChildren = (node.children || []) as LogTreeOption[];
    });
  }
  if (crashEntries.length) {
    roots.push({
      key: CRASH_TREE_KEY,
      label: `crash (${crashEntries.length})`,
      isFile: true,
    });
  }
  if (logEntries.length) {
    roots.push({
      key: LOG_TREE_KEY,
      label: `log (${logEntries.length})`,
      isFile: true,
    });
  }
  if (subscriptionEntries.length) {
    roots.push({
      key: SUBSCRIPTION_TREE_KEY,
      label: `subscription (${subscriptionEntries.length})`,
      isFile: true,
    });
  }
  roots.sort((a, b) =>
    String(a.label || ``).localeCompare(String(b.label || ``), `zh-CN`),
  );
  return roots;
};
