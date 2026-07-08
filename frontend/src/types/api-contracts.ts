export interface ApiValidationIssue {
  field: string;
  issue: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  error: string;
  message: string;
  errors?: ApiValidationIssue[];
  timestamp: string;
}
