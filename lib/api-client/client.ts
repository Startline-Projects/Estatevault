"use client";

import { authedFetch } from "@/lib/api/authedFetch";

export type ApiOk<T> = { data: T; error?: undefined };
export type ApiErr = { data?: undefined; error: string };
export type ApiResult<T> = ApiOk<T> | ApiErr;

async function parseJson<T>(res: Response): Promise<ApiResult<T>> {
  const json = await res.json();
  if (!res.ok) return { error: (json as { error?: string }).error ?? "Request failed" };
  return { data: json as T };
}

export async function get<T>(url: string, params?: Record<string, string | undefined>): Promise<ApiResult<T>> {
  return parseJson<T>(await authedFetch(url + buildQs(params)));
}

export async function post<T>(url: string, body?: unknown): Promise<ApiResult<T>> {
  return parseJson<T>(await authedFetch(url, jsonInit("POST", body)));
}

export async function put<T>(url: string, body?: unknown): Promise<ApiResult<T>> {
  return parseJson<T>(await authedFetch(url, jsonInit("PUT", body)));
}

export async function patch<T>(url: string, body?: unknown): Promise<ApiResult<T>> {
  return parseJson<T>(await authedFetch(url, jsonInit("PATCH", body)));
}

export async function del<T>(url: string): Promise<ApiResult<T>> {
  return parseJson<T>(await authedFetch(url, { method: "DELETE" }));
}

export async function publicGet<T>(url: string, params?: Record<string, string | undefined>): Promise<ApiResult<T>> {
  return parseJson<T>(await fetch(url + buildQs(params)));
}

export async function publicPost<T>(url: string, body?: unknown): Promise<ApiResult<T>> {
  return parseJson<T>(await fetch(url, jsonInit("POST", body)));
}

export async function postForm<T>(url: string, formData: FormData): Promise<ApiResult<T>> {
  return parseJson<T>(await fetch(url, { method: "POST", body: formData }));
}

export async function getRaw(url: string, params?: Record<string, string | undefined>): Promise<Response> {
  return authedFetch(url + buildQs(params));
}

function jsonInit(method: string, body?: unknown): RequestInit {
  if (body === undefined) return { method };
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function buildQs(params?: Record<string, string | undefined>): string {
  if (!params) return "";
  const entries = Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined);
  return entries.length ? "?" + new URLSearchParams(entries).toString() : "";
}
