const WASM_GC_ERROR_PATTERN =
  /WebAssembly\.Module\(\):.*invalid array type definition.*experimental-wasm-gc/i;
const WASM_GC_DIALOG_ID = 'gkd-wasm-gc-error-dialog';

type ErrorContainer = {
  error?: unknown;
  message?: unknown;
  reason?: unknown;
};

const getErrorMessage = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  if (!value || typeof value !== 'object') return String(value);

  const container = value as ErrorContainer;
  if (container.error !== undefined) return getErrorMessage(container.error);
  if (container.reason !== undefined) return getErrorMessage(container.reason);
  if (typeof container.message === 'string') return container.message;
  return String(value);
};

export const isWasmGcCompatibilityError = (value: unknown): boolean => {
  return WASM_GC_ERROR_PATTERN.test(getErrorMessage(value));
};

const applyStyles = (
  element: HTMLElement,
  styles: Partial<CSSStyleDeclaration>,
) => {
  Object.assign(element.style, styles);
};

const createText = (text: string) => {
  const element = document.createElement('div');
  element.textContent = text;
  return element;
};

const showWasmGcCompatibilityDialog = (error: unknown) => {
  if (document.getElementById(WASM_GC_DIALOG_ID)) return;

  const overlay = document.createElement('div');
  overlay.id = WASM_GC_DIALOG_ID;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', `${WASM_GC_DIALOG_ID}-title`);
  applyStyles(overlay, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    boxSizing: 'border-box',
    background: 'rgba(15, 23, 42, 0.62)',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
  });

  const panel = document.createElement('div');
  applyStyles(panel, {
    width: 'min(520px, 100%)',
    padding: '24px',
    boxSizing: 'border-box',
    borderRadius: '12px',
    background: '#ffffff',
    color: '#1f2937',
    boxShadow: '0 18px 48px rgba(15, 23, 42, 0.3)',
  });

  const title = createText('浏览器版本过低');
  title.id = `${WASM_GC_DIALOG_ID}-title`;
  applyStyles(title, {
    marginBottom: '12px',
    color: '#d03050',
    fontSize: '22px',
    fontWeight: '600',
    lineHeight: '1.4',
  });

  const description = createText(
    '当前浏览器不支持 WebAssembly GC，应用无法完成初始化。',
  );
  applyStyles(description, {
    marginBottom: '14px',
    fontSize: '15px',
    lineHeight: '1.7',
  });

  const solution = createText(
    '请升级到最新版 Chrome 或 Edge；也可使用 Firefox 120+ 或 Safari 18.2+。如果当前页面位于应用内置浏览器或旧版 WebView，请复制页面地址并在新版系统浏览器中打开。升级后重新加载本页面。',
  );
  applyStyles(solution, {
    marginBottom: '16px',
    fontSize: '14px',
    lineHeight: '1.7',
  });

  const details = createText(`错误信息：${getErrorMessage(error)}`);
  applyStyles(details, {
    maxHeight: '120px',
    marginBottom: '20px',
    padding: '10px 12px',
    overflow: 'auto',
    borderRadius: '6px',
    background: '#f3f4f6',
    color: '#4b5563',
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: '12px',
    lineHeight: '1.6',
    overflowWrap: 'anywhere',
  });

  const actions = document.createElement('div');
  applyStyles(actions, {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: '10px',
  });

  const downloadLink = document.createElement('a');
  downloadLink.href = 'https://www.microsoft.com/edge/download';
  downloadLink.target = '_blank';
  downloadLink.rel = 'noopener noreferrer';
  downloadLink.textContent = '下载新版浏览器';
  applyStyles(downloadLink, {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '36px',
    padding: '0 14px',
    border: '1px solid #d0d5dd',
    borderRadius: '6px',
    boxSizing: 'border-box',
    color: '#344054',
    fontSize: '14px',
    textDecoration: 'none',
  });

  const reloadButton = document.createElement('button');
  reloadButton.type = 'button';
  reloadButton.textContent = '重新加载';
  applyStyles(reloadButton, {
    minHeight: '36px',
    padding: '0 16px',
    border: '0',
    borderRadius: '6px',
    background: '#18a058',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '14px',
  });
  reloadButton.addEventListener('click', () => location.reload());

  actions.append(downloadLink, reloadButton);
  panel.append(title, description, solution, details, actions);
  overlay.append(panel);
  document.body.append(overlay);
  reloadButton.focus();
};

export const reportGlobalError = (error: unknown, source = '全局'): boolean => {
  console.error(`[${source}错误]`, error);
  if (!isWasmGcCompatibilityError(error)) return false;

  if (document.body) {
    showWasmGcCompatibilityDialog(error);
  } else {
    window.addEventListener(
      'DOMContentLoaded',
      () => showWasmGcCompatibilityDialog(error),
      { once: true },
    );
  }
  return true;
};

let globalErrorHandlersInstalled = false;

export const installGlobalErrorHandlers = () => {
  if (globalErrorHandlersInstalled) return;
  globalErrorHandlersInstalled = true;

  window.addEventListener('error', (event) => {
    reportGlobalError(event.error ?? event.message, '未捕获');
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportGlobalError(event.reason, '未处理的 Promise');
  });
};
