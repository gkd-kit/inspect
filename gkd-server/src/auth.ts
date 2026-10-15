import { ApiError } from "./errors";

export const assertAuthorization = (
  request: Request,
  token: string | undefined,
): void => {
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    request.headers.get("authorization") !== `Bearer ${token}`
  ) {
    throw new ApiError("Unauthorized");
  }
};
