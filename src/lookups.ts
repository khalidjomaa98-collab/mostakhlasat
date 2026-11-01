import { sb, q } from './supabase';

export type Lookups = {
  companies: any[]; agencies: any[]; sites: any[]; stations: any[];
  company: Record<number, any>; agency: Record<number, any>; site: Record<number, any>; station: Record<string, any>;
};
let cache: Promise<Lookups> | null = null;

export function lookups(force = false): Promise<Lookups> {
  if (!cache || force) {
    cache = Promise.all([
      q(sb.from('companies').select('*').order('sort')),
      q(sb.from('agencies').select('*').order('sort')),
      q(sb.from('sites').select('*').order('name')),
      q(sb.from('stations').select('*').order('sort')),
    ]).then(([companies, agencies, sites, stations]: any[]) => ({
      companies, agencies, sites, stations,
      company: Object.fromEntries(companies.map((x: any) => [x.id, x])),
      agency: Object.fromEntries(agencies.map((x: any) => [x.id, x])),
      site: Object.fromEntries(sites.map((x: any) => [x.id, x])),
      station: Object.fromEntries(stations.map((x: any) => [x.code, x])),
    }));
    cache.catch(() => { cache = null; });
  }
  return cache;
}
