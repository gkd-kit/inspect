import { NInput } from 'naive-ui';
import { dialog, message } from './discrete';

export const showTextDLg = ({ title = `批量分享链接`, content = '' }) => {
  dialog.success({
    title,
    style: {
      width: `800px`,
    },
    content() {
      return (
        <NInput
          type="textarea"
          autosize={{
            minRows: 8,
            maxRows: 16,
          }}
          inputProps={{
            style: `white-space: nowrap;`,
            class:`gkd_code`
          }}
          value={content}
        />
      );
    },
    positiveText: `复制`,
    onPositiveClick() {
      navigator.clipboard
        .writeText(content)
        .then(() => {
          message.success(`复制成功`);
        })
        .catch(() => {
          message.success(`复制失败`);
        });
      return false;
    },
  });
};
