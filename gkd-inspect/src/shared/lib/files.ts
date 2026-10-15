export const getDragEventFiles = (event: DragEvent): File[] => {
  const files: File[] = [];
  if (event.dataTransfer?.items) {
    for (const item of event.dataTransfer.items) {
      if (item.kind !== 'file') continue;
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  } else {
    files.push(...Array.from(event.dataTransfer?.files || []));
  }
  return files;
};
