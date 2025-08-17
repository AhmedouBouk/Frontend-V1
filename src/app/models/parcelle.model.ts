export interface ParcelleProperty {
  id: string;
  latitude: number;
  longitude: number;
  number: string;
  surface: number;
  address: string;
  city: string;
  postalCode?: string;
  type_local?: string; // Type locale (Maison, Appartement, etc.)
}
