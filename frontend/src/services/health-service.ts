import { request } from "./api-transport";

export interface HealthResponse {
  status: string;
  service: string;
}

export async function checkHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("health", {
    method: "GET",
  });
}
