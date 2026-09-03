export type VirtualTextLine = {
  key: number;
  number: number;
  text: string;
};

export const getVirtualTextLines = (value: string): VirtualTextLine[] => {
  return value.split(/\r\n|\n|\r/).map((text, index) => ({
    key: index,
    number: index + 1,
    text,
  }));
};
