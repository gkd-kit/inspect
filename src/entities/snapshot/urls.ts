const importUrlPatterns = [
  /^https:\/\/f\.gkd\.li\/(\d+)$/,
  /^https:\/\/github\.com\/gkd-kit\/inspect\/files\/(\d+)\/file\.zip$/,
  /^https:\/\/github\.com\/user-attachments\/files\/(\d+)\/file\.zip$/,
  /^https:\/\/i\.gkd\.li\/i\/(\d+)$/,
  /^https:\/\/i\.gkd\.li\/import\/(\d+)$/,
];

export const getImportId = (url: string) => {
  if (typeof url !== 'string') return;
  if (url.startsWith(location.origin)) {
    const importId = +new URL(url).pathname.substring(1);
    if (Number.isSafeInteger(importId) && importId > 0) return importId;
  }
  for (const pattern of importUrlPatterns) {
    const id = url.match(pattern)?.[1];
    if (id) return +id;
  }
};

const legacyImageUrlPattern =
  /^https:\/\/github\.com\/gkd-kit\/inspect\/assets\/[0-9]+\/([0-9a-z-]+)$/;
const imageUrlPattern =
  /^https:\/\/github\.com\/user-attachments\/assets\/([0-9a-z-]+)$/;

export const getImageId = (url: string) =>
  url.match(legacyImageUrlPattern)?.[1] || url.match(imageUrlPattern)?.[1];

export const getImportUrl = (importId: number | string) =>
  location.origin + `/i/${importId}`;

export const getImagUrl = (imageId: number | string) =>
  `https://e.gkd.li/${imageId}`;

export const getImportFileUrl = (importId: number | string) =>
  `https://github.com/user-attachments/files/${importId}/file.zip`;

export const getImageFileUrl = (imageId: number | string) =>
  `https://github.com/user-attachments/assets/${imageId}`;
