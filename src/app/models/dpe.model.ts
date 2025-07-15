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
}
