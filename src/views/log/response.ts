export const readLimitedResponse = async (
  response: Response,
  sizeLimit: number,
) => {
  const reader = response.body?.getReader();
  if (!reader) {
    const data = await response.arrayBuffer();
    if (data.byteLength > sizeLimit) throw new Error(`响应内容超过大小限制`);
    return data;
  }

  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > sizeLimit) {
      await reader.cancel(`响应内容超过大小限制`);
      throw new Error(`响应内容超过大小限制`);
    }
    chunks.push(value);
  }
  const result = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
};
