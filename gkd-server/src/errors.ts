export type ErrorResponse = {
  error: true;
  message: string;
};

export class ApiError extends Error {
  readonly headers: Headers;

  constructor(message: string, headers?: HeadersInit) {
    super(message);
    this.name = "ApiError";
    this.headers = new Headers(headers);
  }
}
