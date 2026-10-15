const minimumColumnWidth = 64;
const cellHorizontalPadding = 16;
const sorterWidth = 19;

type GetSqliteColumnWidthOptions = {
  title: string;
  values: string[];
  sortable: boolean;
  measureText: (text: string) => number;
};

const getMultilineTextWidth = (
  text: string,
  measureText: (text: string) => number,
) => {
  return Math.max(...text.split(/\r\n|\r|\n/).map(measureText));
};

export const getSqliteColumnWidth = ({
  title,
  values,
  sortable,
  measureText,
}: GetSqliteColumnWidthOptions) => {
  const titleWidth =
    measureText(title) + cellHorizontalPadding + (sortable ? sorterWidth : 0);
  const contentWidth = Math.max(
    0,
    ...values.map(
      (value) =>
        getMultilineTextWidth(value, measureText) + cellHorizontalPadding,
    ),
  );
  return Math.ceil(Math.max(minimumColumnWidth, titleWidth, contentWidth));
};

export const getSqliteMeasuredColumnWidth = (
  currentWidth: number,
  contentWidth: number,
) => {
  return Math.ceil(
    Math.max(currentWidth, contentWidth + cellHorizontalPadding),
  );
};

export const getSqliteTableWidth = (columnWidths: number[]) => {
  return columnWidths.reduce((total, width) => total + width, 0);
};
