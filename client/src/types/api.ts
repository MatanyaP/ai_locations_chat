export interface LocationData {
  timestamp: string;
  latitude: number;
  longitude: number;
  altitude: number;
  horizontal_accuracy_meters: number;
  vertical_accuracy_meters: number;
  speed_mps: number;
  bearing_degrees: number;
  provider: string;
  person?: string;
}

export interface Coordinate {
  lat: number;
  lng: number;
  person?: string;
}

export interface LocationResponse {
  person?: string;
  persons?: string[];
  time_period?: string;
  locations: LocationData[];
  summary: string;
  coordinates?: Coordinate[];
  person_colors?: Record<string, string>;
}

