/** Failure body from the Spring API (09 WBS §1-4). `code` drives copy and branching; `message` is the default Korean copy. */
export type ApiErrorBody = {
  code: string;
  message: string;
  detail?: Record<string, unknown>;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail?: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.detail = body.detail;
  }

  static async from(res: Response): Promise<ApiError> {
    try {
      const body = (await res.json()) as ApiErrorBody;
      return new ApiError(res.status, body);
    } catch {
      return new ApiError(res.status, { code: 'UNKNOWN', message: '잠시 후 다시 시도해 주세요' });
    }
  }
}
