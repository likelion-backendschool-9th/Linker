import { ApiError } from '@/lib/api/api-error';

/** Why a sheet's save failed, shown in the sheet. `message` is the server's Korean copy (09 WBS §1-4). */
export function saveErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.message) return error.message;
  return '저장하지 못했어요. 다시 시도해 주세요.';
}
