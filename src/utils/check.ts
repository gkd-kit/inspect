export const toValidURL = (url: string | URL, base?: string | URL) => {
  try {
    return new URL(url, base);
  } catch {}
};
