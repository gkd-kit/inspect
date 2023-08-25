import { NInput } from 'naive-ui';
import { dialog, message } from './discrete';
import store from './store';

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

export const showNetworkError = () => {
  const onClose = () => {
    store.networkErrorDlgVisible = false;
  };
  const d = dialog.error({
    title: `访问其它域名资源失败`,
    content() {
      return (
        <div>
          <div>访问其它域名资源需要以下条件</div>

          <div>
            1. 安装脚本管理器, 如{` `}
            <a
              href="https://violentmonkey.github.io/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Violentmonkey
            </a>
            {` `}或{` `}
            <a
              href="https://www.tampermonkey.net/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Tampermonkey
            </a>
          </div>
          <div>
            2. 安装油猴脚本{` `}
            <a
              href="https://github.com/gkd-kit/network-extension"
              target="_blank"
              rel="noopener noreferrer"
            >
              network-extension
            </a>
          </div>
          <div>3. 在当前网站启用上述油猴脚本的API注入功能</div>
          <div>
            4. 如果是分享链接则需要在当前浏览器登录{` `}
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com
            </a>
          </div>
        </div>
      );
    },
    onClose,
  });
  d.onEsc = onClose;
  d.onMaskClick = onClose;
  return d;
};

export const showGithubError = () => {
  const onClose = () => {
    store.githubErrorDlgVisible = false;
  };
  const d = dialog.error({
    title: `生成分享链接失败`,
    content() {
      return (
        <div>
          <div>生成分享链接需要以下条件</div>
          <div>
            在当前浏览器登录{` `}
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com
            </a>
          </div>
        </div>
      );
    },
    onClose,
  });
  d.onEsc = onClose;
  d.onMaskClick = onClose;
  return d;
};
