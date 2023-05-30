const eqU8 = (a: Uint8Array, b: Uint8Array) => {
  return a.length == b.length && a.every((v, i) => v == b[i]);
};
const startWith = (a: ArrayBuffer, b: Uint8Array) => {
  return eqU8(new Uint8Array(a.slice(0, b.length)), b);
};
const blobStartWith = async (a: Blob, b: Uint8Array) => {
  const bf = await a.slice(0, b.length).arrayBuffer();
  return eqU8(new Uint8Array(bf), b);
};
const pngHeader = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

export const isPngBf = (bf: ArrayBuffer) => startWith(bf, pngHeader);
export const isPngBlob = async (blob: Blob) => blobStartWith(blob, pngHeader);
export const isZipBf = (bf: ArrayBuffer) => startWith(bf, zipHeader);
export const isZipBlob = async (blob: Blob) => blobStartWith(blob, zipHeader);
