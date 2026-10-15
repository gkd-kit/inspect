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
const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

export const isZipBf = (bf: ArrayBuffer) => startWith(bf, zipHeader);
export const isZipBlob = async (blob: Blob) => blobStartWith(blob, zipHeader);
