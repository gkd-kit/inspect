import dayjs from 'dayjs';
import { NEllipsis } from 'naive-ui';
import type { TableBaseColumn } from 'naive-ui/es/data-table/src/interface';
import { shallowReactive } from 'vue';
import { getDevice } from './node';
import { copy } from './others';
import { useAutoWrapWidthColumn } from './size';
import { importTimeStorage } from './storage';
import type { Snapshot } from './types';

export const renderDveice = (row: Snapshot) => {
  return `${getDevice(row).manufacturer} Android${
    getDevice(row).release || `13`
  }`;
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
  const mtimeCol = shallowReactive<TableBaseColumn<Snapshot>>({
    key: `mtime`,
    title: `导入时间`,
    width: `130px`,
    sortOrder: false,
    sorter(rowA, rowB) {
      return (
        (importTimeStorage[rowA.id] || rowA.id) -
        (importTimeStorage[rowB.id] || rowB.id)
      );
    },
    render(row) {
      return dayjs(importTimeStorage[row.id] || row.id).format(
        'MM-DD HH:mm:ss',
      );
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
    title: `应用名称`,
    filterMultiple: true,
    filter(value, row) {
      return value.toString() == row.appName;
    },
    cellProps(row) {
      return {
        onClick() {
          copy(row.appName);
        },
      };
    },
    render(row) {
      return row.appName;
    },
  });
  const appIdCol = useAutoWrapWidthColumn<Snapshot>({
    key: `appId`,
    title: `应用ID`,
    minWidth: 100,
    cellProps(row) {
      return {
        onClick() {
          copy(row.appId);
        },
      };
    },
    render(row) {
      return row.appId;
    },
  });
  const appVersionCodeCol = useAutoWrapWidthColumn<Snapshot>({
    key: `appVersionCode`,
    title: `版本代码`,
    minWidth: 150,
    render(row) {
      return row.appVersionCode;
    },
  });
  const appVersionNameCol = useAutoWrapWidthColumn<Snapshot>({
    key: `appVersionName`,
    title: `版本号`,
    minWidth: 150,
    render(row) {
      return <NEllipsis>{row.appVersionName}</NEllipsis>;
    },
  });

  const activityIdCol = shallowReactive<TableBaseColumn<Snapshot>>({
    key: `activityId`,
    title: `界面ID`,
    filterMultiple: true,
    filter(value, row) {
      return value.toString() == row.activityId;
    },
    cellProps(row) {
      return {
        onClick() {
          copy(row.activityId);
        },
      };
    },
    render(row) {
      return (
        <div class="whitespace-nowrap text-left direction-rtl">
          <NEllipsis>{row.activityId}</NEllipsis>
        </div>
      );
    },
  });

  const reseColWidth = () => {
    deviceCol.width = void 0;
    appNameCol.width = void 0;
    appIdCol.width = void 0;
    appVersionCodeCol.width = void 0;
    appVersionNameCol.width = void 0;
  };
  return {
    ctimeCol,
    mtimeCol,
    deviceCol,
    appNameCol,
    appIdCol,
    appVersionCodeCol,
    appVersionNameCol,
    activityIdCol,
    reseColWidth,
  };
};
