import type { TableBaseColumn } from 'naive-ui/es/data-table/src/interface';
import { shallowReactive, withDirectives } from 'vue';
import { rect } from './directives';

export const useAutoWrapWidthColumn = <T,>(data: TableBaseColumn<T>) => {
  const currentCol = shallowReactive<TableBaseColumn<T>>({
    ...data,
    render(rowData, rowIndex) {
      return withDirectives(
        <span class="whitespace-nowrap">
          {data.render?.(rowData, rowIndex)}
        </span>,
        [
          [
            rect,
            (size: DOMRect) => {
              currentCol.width = Math.max(
                Math.ceil(size.width + 16), // 16 是 n-data-table-td 的 左右内边距
                (currentCol.width as number) || 0,
              );
            },
          ],
        ],
      );
    },
  });
  return currentCol;
};
