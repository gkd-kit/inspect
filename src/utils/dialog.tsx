import { NCheckbox, NInput } from 'naive-ui';
import { dialog, message } from './discrete';
import { settingsStorage } from './storage';

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
            class: `gkd_code`,
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

const NoticeCheckbox = defineComponent(() => {
  return () => {
    return (
      <NCheckbox
        checked={settingsStorage.ignoreUploadWarn}
        onUpdateChecked={(value) => {
          settingsStorage.ignoreUploadWarn = value;
        }}
        focusable={false}
      >
        不再提醒
      </NCheckbox>
    );
  };
});

export const waitShareAgree = async () => {
  if (settingsStorage.ignoreUploadWarn) return;
  return new Promise((resolve, reject) => {
    dialog.warning({
      title: '生成分享链接须知',
      content() {
        return (
          <div>
            <div>所有快照上传分享链接均为公开链接，任何人均可访问。</div>
            <div>请确保快照不包含隐私信息，请勿分享任何敏感信息。</div>
            <NoticeCheckbox class="mt-10px" />
          </div>
        );
      },
      closable: false,
      closeOnEsc: false,
      maskClosable: false,
      positiveText: '继续上传',
      negativeText: '取消分享',
      onPositiveClick: resolve,
      onNegativeClick: reject,
    });
  });
};
