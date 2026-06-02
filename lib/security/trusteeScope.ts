// Shared interpretation of a trustee's access_scope so the list route and the
// download-url route enforce identical rules (M-9). A null/absent scope means
// full access (legacy trustees granted before scoping existed).

export interface TrusteeScope {
  categories?: string[];
  documents?: boolean;
  farewell?: boolean;
}

export interface ResolvedScope {
  allowAll: boolean;
  /** null = all categories; otherwise the explicit allow-list. */
  allowCategories: string[] | null;
  allowDocuments: boolean;
  allowFarewell: boolean;
}

export function resolveTrusteeScope(raw: unknown): ResolvedScope {
  const scope = (raw ?? null) as TrusteeScope | null;
  const allowAll = !scope;
  return {
    allowAll,
    allowCategories: allowAll ? null : scope!.categories ?? [],
    allowDocuments: allowAll ? true : !!scope!.documents,
    allowFarewell: allowAll ? true : !!scope!.farewell,
  };
}

export function categoryAllowed(scope: ResolvedScope, category: string): boolean {
  if (scope.allowCategories === null) return true;
  return scope.allowCategories.includes(category);
}
