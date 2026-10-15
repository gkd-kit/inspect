export const getSafeHttpUrl = (value: unknown) => {
  if (typeof value != `string`) return;
  try {
    const url = new URL(value);
    if (url.protocol == `http:` || url.protocol == `https:`) return url.href;
  } catch {}
};
