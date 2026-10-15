const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value == `object` && value != null && !Array.isArray(value);
};

export const getAppNameMapFromValue = (value: unknown) => {
  if (!isObject(value) || !Array.isArray(value.apps)) return {};
  const entries: Array<[string, string]> = [];
  value.apps.forEach((app) => {
    if (!isObject(app)) return;
    if (typeof app.id != `string` || typeof app.name != `string`) return;
    entries.push([app.id, app.name]);
  });
  return Object.fromEntries(entries);
};
