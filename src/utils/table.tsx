import type { TableBaseColumn } from 'naive-ui/es/data-table/src/interface';
import { shallowReactive } from 'vue';
import type { Snapshot } from './types';
import dayjs from 'dayjs';
import { useAutoWrapWidthColumn } from './size';

export const renderDveice = (row: Snapshot) => {
  if (!row.device) return ``;
  return `${row.device.manufacturer} Android${row.device.release}`;
};
export const useSnapshotColumns = () => {
  const ctimeCol = shallowReactive<TableBaseColumn<Snapshot>>({
    key: `id`,
    title: `创建时间`,
    fixed: 'left',
    width: `130px`,
    sortOrder: false,
    sorter(rowA, rowB) {
      return rowA.id - rowB.id;
    },
    render(row) {
      return dayjs(row.id).format('MM-DD HH:mm:ss');
    },
  });

  const deviceCol = useAutoWrapWidthColumn<Snapshot>({
    key: `versionRelease`,
    title: `设备`,
    filterMultiple: true,
    minWidth: 100,
    filter(value, row) {
      return renderDveice(row).includes(value.toString());
    },
    render(row) {
      return renderDveice(row);
    },
  });
  const appNameCol = useAutoWrapWidthColumn<Snapshot>({
    key: `appName`,
    minWidth: 100,
    title: `Name`,
    filterMultiple: true,
    filter(value, row) {
      return value.toString() == row.appName;
    },
    render(row) {
      return row.appName;
    },
  });
  const appIdCol = useAutoWrapWidthColumn<Snapshot>({
    key: `appId`,
    title: `appId`,
    minWidth: 100,
    render(row) {
      return row.appId;
    },
  });
  const activityIdCol = shallowReactive<TableBaseColumn<Snapshot>>({
    key: `activityId`,
    title: `activityId`,
    className: `whitespace-nowrap`,
    filterMultiple: true,
    filter(value, row) {
      return value.toString() == row.activityId;
    },
    render(row) {
      return <span class="whitespace-nowrap">{row.activityId}</span>;
    },
  });
  return {
    ctimeCol,
    deviceCol,
    appNameCol,
    appIdCol,
    activityIdCol,
  };
};
