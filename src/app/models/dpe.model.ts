export interface DpeProperty {
  id: string;
  latitude: number;
  longitude: number;
  address: string;
  energyClass: string; // A, B, C, D, E, F, G
  gesClass: string; // A, B, C, D, E, F, G
  year: number;
  city: string;
  postalCode?: string;
  ep_conso_5_usages?: number; // Energy consumption value
  periode_construction?: string | null; // Construction period for different markers
  type_batiment?: string; // Type locale (Maison, Appartement, etc.)
}
