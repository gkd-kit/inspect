export const obj2form = (...objs: Record<string, unknown>[]) => {
  const fd = new FormData();
  objs.forEach((obj) => {
    for (const k in obj) {
      const v = obj[k];
      if (v === undefined) continue;
      if (v instanceof Blob) {
        fd.append(k, v, v.name);
      } else {
        fd.append(k, String(v));
      }
    }
  });
  return fd;
};

export function obj2usp(...objs: Record<string, unknown>[]) {
  const usp = new URLSearchParams();
  objs.forEach((obj) => {
    for (const k in obj) {
      const v = obj[k];
      if (v === undefined) continue;
      usp.append(k, String(v));
    }
  });
  return usp;
}
