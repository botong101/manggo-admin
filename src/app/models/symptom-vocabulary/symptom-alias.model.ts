export interface SymptomAlias {
  id: number;
  alias: string;
  canonical: number;
  canonical_key: string;
  source: string;
}

export interface SymptomAliasPayload {
  alias: string;
  canonical: number;
  source?: string;
}