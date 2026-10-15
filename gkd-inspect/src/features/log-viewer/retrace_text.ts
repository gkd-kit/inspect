export type RetraceTextBlock = {
  start: number;
  end: number;
  text: string;
  mapIds: readonly string[];
};

type TextLine = {
  start: number;
  contentEnd: number;
  value: string;
};

const mapIdPattern = `[a-f\\d]{64}`;
const stackFrameWithMapIdRegex = new RegExp(
  `^[\\t ]*at[\\t ]+[^\\r\\n]*r8-map-id-${mapIdPattern}(?=[:)\\s]|$)`,
  `im`,
);
const stackFrameRegex = /^[\t ]*at[\t ]+\S+/;
const nestedExceptionRegex = /^[\t ]*(?:Caused by:|Suppressed:)[\t ]*\S/;
const elidedFramesRegex = /^[\t ]*\.\.\.[\t ]+\d+[\t ]+more[\t ]*$/;
const MAX_EXCEPTION_MESSAGE_CONTINUATION_LINES = 32;
const MAX_EXCEPTION_MESSAGE_CONTINUATION_SIZE = 64 * 1024;

const getTextLines = function* (text: string): Generator<TextLine> {
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code != 10 && code != 13) continue;
    const contentEnd = index;
    if (code == 13 && text.charCodeAt(index + 1) == 10) index++;
    yield {
      start,
      contentEnd,
      value: text.slice(start, contentEnd),
    };
    start = index + 1;
  }
  if (start < text.length) {
    yield {
      start,
      contentEnd: text.length,
      value: text.slice(start),
    };
  }
};

const isStackLine = (line: string) => {
  return (
    stackFrameRegex.test(line) ||
    nestedExceptionRegex.test(line) ||
    elidedFramesRegex.test(line)
  );
};

const isExceptionMessageContinuation = (line: string) => {
  const value = line.trim();
  if (!value) return false;
  return !/^\d{2}:\d{2}:\d{2}\.\d{3}(?:\s|$)/.test(value);
};

const isExceptionHeader = (line: string) => {
  let value = line.trim();
  if (!value) return false;
  if (/^\d{2}:\d{2}:\d{2}\.\d{3}(?:\s|$)/.test(value)) return false;
  if (/^Exception in thread\s+"[^"]+"\s+\S/.test(value)) return true;
  value = value.replace(/^\[\d+\]:\s*/, ``);
  if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+\s*:/.test(value)) {
    return true;
  }
  if (
    /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:Exception|Error|Throwable)(?:\s*[:(]|\s*$)/.test(
      value,
    )
  ) {
    return true;
  }
  return /^[A-Za-z_$][\w$]*\s*\([^\r\n]*\)\s*$/.test(value);
};

export const getR8MapIds = (text: string) => {
  const ids = new Set<string>();
  const regex = new RegExp(`r8-map-id-(${mapIdPattern})(?=[:)\\s]|$)`, `gi`);
  for (const match of text.matchAll(regex)) {
    const id = match[1];
    if (id) ids.add(id.toLowerCase());
  }
  return [...ids];
};

export const hasRetraceableStack = (text: string) => {
  return stackFrameWithMapIdRegex.test(text);
};

export const collectRetraceTextBlocks = (text: string): RetraceTextBlock[] => {
  if (!hasRetraceableStack(text)) return [];
  const blocks: RetraceTextBlock[] = [];
  let blockStart = -1;
  let blockEnd = -1;
  let hasStackFrame = false;
  let messageContinuationLines = 0;
  let messageContinuationSize = 0;
  let mapIds = new Set<string>();

  const finishBlock = () => {
    if (
      blockStart >= 0 &&
      blockEnd >= blockStart &&
      hasStackFrame &&
      mapIds.size
    ) {
      blocks.push({
        start: blockStart,
        end: blockEnd,
        text: text.slice(blockStart, blockEnd),
        mapIds: [...mapIds],
      });
    }
    blockStart = -1;
    blockEnd = -1;
    hasStackFrame = false;
    messageContinuationLines = 0;
    messageContinuationSize = 0;
    mapIds = new Set();
  };

  for (const line of getTextLines(text)) {
    if (blockStart >= 0 && isStackLine(line.value)) {
      blockEnd = line.contentEnd;
      if (stackFrameRegex.test(line.value)) hasStackFrame = true;
      if (stackFrameWithMapIdRegex.test(line.value)) {
        for (const mapId of getR8MapIds(line.value)) mapIds.add(mapId);
      }
      continue;
    }
    if (
      blockStart >= 0 &&
      !hasStackFrame &&
      isExceptionMessageContinuation(line.value) &&
      !isExceptionHeader(line.value) &&
      messageContinuationLines < MAX_EXCEPTION_MESSAGE_CONTINUATION_LINES &&
      messageContinuationSize + line.value.length <=
        MAX_EXCEPTION_MESSAGE_CONTINUATION_SIZE
    ) {
      blockEnd = line.contentEnd;
      messageContinuationLines++;
      messageContinuationSize += line.value.length;
      continue;
    }
    if (blockStart >= 0) finishBlock();
    if (isExceptionHeader(line.value)) {
      blockStart = line.start;
      blockEnd = line.contentEnd;
    }
  }
  finishBlock();
  return blocks;
};

const isMatchingMapId = (ids: readonly string[], mapId: string) => {
  const normalizedMapId = mapId.toLowerCase();
  return ids.length > 0 && ids.every((id) => id == normalizedMapId);
};

export const retraceCrashText = (
  text: string,
  mapId: string,
  retrace: (stackTrace: string) => string,
) => {
  if (!hasRetraceableStack(text)) return text;
  const mapIds = getR8MapIds(text);
  return isMatchingMapId(mapIds, mapId) ? retrace(text) : text;
};

export const retraceLogText = (
  text: string,
  mapId: string,
  retrace: (stackTrace: string) => string,
) => {
  const blocks = collectRetraceTextBlocks(text);
  if (!blocks.length) return text;
  let result = ``;
  let offset = 0;
  for (const block of blocks) {
    result += text.slice(offset, block.start);
    result += isMatchingMapId(block.mapIds, mapId)
      ? retrace(block.text)
      : block.text;
    offset = block.end;
  }
  return result + text.slice(offset);
};
