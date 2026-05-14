/**
 * SurveyBuilder API client.
 * Wraps all REST endpoints. Every call sends Authorization: Bearer when `token` is set.
 * The Survey API expects a platform/third-party bearer (see SURVEY_API_BEARER_TOKEN), not the app JWT.
 */

export interface Survey {
  survey_id: string;
  title: string;
  survey_json: object;
  created_at: string;
  updated_at: string;
}

export interface SurveyMeta {
  survey_id: string;
  title: string;
  created_at: string;
  num_deploys: number;
}

export interface Deploy {
  deploy_id: string;
  survey_id: string;
  deploy_json: object;
  status: "active" | "stopped" | "closed";
  created_at: string;
  updated_at: string;
}

export interface DeployMeta {
  deploy_id: string;
  survey_id: string;
  title: string;
  version: number;
  status: string;
  created_at: string;
  num_answers: number;
}

export interface DeployLink {
  link_id: string;
  url: string;
}

export interface OpenDeploy {
  open: true;
  url: string;
}

export interface Answer {
  answer_id: string;
  deploy_id: string;
  link_id: string | null;
  answer_json: object;
  created_at: string;
}

// ---------------------------------------------------------------------------

export class SurveyApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "SurveyApiError";
  }
}

export function createSurveyApiClient(baseUrl: string, token?: string) {
  async function request<T>(method: string, path: string, body?: object): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const detail = await res.json().catch(() => ({ detail: res.statusText }));
      throw new SurveyApiError(res.status, detail.detail ?? res.statusText);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  }

  const get = <T>(path: string, body?: object) => request<T>("GET", path, body);
  const post = <T>(path: string, body: object) => request<T>("POST", path, body);
  const put = <T>(path: string, body?: object) => request<T>("PUT", path, body);
  const del = <T>(path: string) => request<T>("DELETE", path);

  return {
    // --- Surveys ---
    getSurveys: () => get<Survey[]>("/surveys"),
    getSurvey: (id: string) => get<Survey>(`/surveys/${id}`),
    getSurveyMeta: (id: string) => get<SurveyMeta>(`/surveys/${id}/metadata`),
    createSurvey: (title: string, survey_json: object) =>
      post<{ survey_id: string }>("/surveys", { title, survey_json }),
    updateSurvey: (id: string, title: string, survey_json: object) =>
      put<{ updated: boolean }>(`/surveys/${id}`, { title, survey_json }),
    deleteSurvey: (id: string) => del<{ deleted: boolean }>(`/surveys/${id}`),

    // --- Deploys ---
    getDeploys: (surveyId: string) => get<Deploy[]>(`/surveys/${surveyId}/deploys`),
    getDeploy: (id: string) => get<Deploy>(`/deploys/${id}`),
    getDeployMeta: (id: string) => get<DeployMeta>(`/deploys/${id}/metadata`),
    createDeploy: (surveyId: string) => post<{ deploy_id: string }>(`/surveys/${surveyId}/deploys`, {}),
    stopDeploy: (id: string) => put<{ updated: boolean }>(`/deploys/${id}/stop`),
    resumeDeploy: (id: string) => put<{ updated: boolean }>(`/deploys/${id}/resume`),
    closeDeploy: (id: string) => put<{ updated: boolean }>(`/deploys/${id}/close`),
    deleteDeploy: (id: string) => del<{ deleted: boolean }>(`/deploys/${id}`),

    // --- Links ---
    getLinks: (deployId: string) => get<DeployLink[] | OpenDeploy>(`/deploys/${deployId}/links`),
    createLinks: (deployId: string, count: number) =>
      post<DeployLink[]>(`/deploys/${deployId}/links/${count}`, {}),
    deleteLink: (deployId: string, linkId: string) =>
      del<{ deleted: boolean }>(`/deploys/${deployId}/links/${linkId}`),

    // --- Answers (Bearer required) ---
    getAnswers: (deployId: string) => get<Answer[]>(`/deploys/${deployId}/answers`),
    submitAnswer: (deployId: string, answer_json: object) =>
      post<{ answer_id: string }>(`/deploys/${deployId}/answers`, { answer_json }),
    submitAnswerLink: (deployId: string, linkId: string, answer_json: object) =>
      post<{ answer_id: string }>(`/deploys/${deployId}/answers/${linkId}`, { answer_json }),
    deleteAnswer: (id: string) => del<{ deleted: boolean }>(`/answers/${id}`),
  };
}

export type SurveyApiClient = ReturnType<typeof createSurveyApiClient>;
