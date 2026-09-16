import { ApiError } from "./api-error.js";

export function parsePositiveIntId(value: string, label = "Id") {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(`${label} is invalid`, 400);
  }

  return id;
}
