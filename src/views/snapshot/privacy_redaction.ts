export interface RedactionRect extends RectX {}

export interface RedactionSelection {
  imageHeight: number;
  imageWidth: number;
  rectangles: RedactionRect[];
}

const normalizeRect = (rect: RedactionRect): RedactionRect => ({
  left: Math.min(rect.left, rect.right),
  top: Math.min(rect.top, rect.bottom),
  right: Math.max(rect.left, rect.right),
  bottom: Math.max(rect.top, rect.bottom),
});

export const intersectsRedactionRect = (
  nodeRect: RectX,
  redactionRect: RedactionRect,
) => {
  const rect = normalizeRect(redactionRect);
  return (
    nodeRect.left < rect.right &&
    nodeRect.right > rect.left &&
    nodeRect.top < rect.bottom &&
    nodeRect.bottom > rect.top
  );
};

export const scaleRedactionRectangles = (
  rectangles: RedactionRect[],
  scaleX: number,
  scaleY: number,
) =>
  rectangles.map((rect) => ({
    left: rect.left * scaleX,
    top: rect.top * scaleY,
    right: rect.right * scaleX,
    bottom: rect.bottom * scaleY,
  }));

const shouldRedactNode = (node: RawNode, rectangles: RedactionRect[]) =>
  rectangles.some((rect) => intersectsRedactionRect(node.attr, rect));

export const createRedactedSnapshotCopy = (
  source: Snapshot,
  id: number,
  rectangles: RedactionRect[],
): Snapshot => ({
  ...source,
  id,
  nodes: source.nodes.map((node) => {
    const redact = shouldRedactNode(node, rectangles);
    return {
      id: node.id,
      pid: node.pid,
      quickFind: node.quickFind,
      idQf: node.idQf,
      textQf: node.textQf,
      children: [],
      attr: {
        ...node.attr,
        text: redact && node.attr.text ? '***' : node.attr.text,
        textLen: redact && node.attr.text ? 3 : node.attr.textLen,
        desc: redact && node.attr.desc ? '***' : node.attr.desc,
        descLen: redact && node.attr.desc ? 3 : node.attr.descLen,
      },
    };
  }),
});

export const getAvailableSnapshotId = async (
  seed: number,
  hasItem: (id: number) => Promise<boolean>,
) => {
  let id = Math.max(1, Math.trunc(seed));
  while (await hasItem(id)) id += 1;
  return id;
};

const canvasToPng = (canvas: HTMLCanvasElement) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('无法生成脱敏图片'));
        return;
      }
      void blob.arrayBuffer().then(resolve, reject);
    }, 'image/png');
  });

export const renderRedactedScreenshot = async (
  source: ArrayBuffer,
  rectangles: RedactionRect[],
) => {
  const image = await createImageBitmap(new Blob([source]));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器不支持图片脱敏');
    context.drawImage(image, 0, 0);
    context.fillStyle = '#000';
    for (const rawRect of rectangles) {
      const rect = normalizeRect(rawRect);
      context.fillRect(
        rect.left,
        rect.top,
        rect.right - rect.left,
        rect.bottom - rect.top,
      );
    }
    return await canvasToPng(canvas);
  } finally {
    image.close();
  }
};
