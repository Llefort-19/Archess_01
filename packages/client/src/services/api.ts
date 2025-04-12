import type { PresetId } from '@archess/shared';

// Type matching the simplified preset info sent by the server API
export interface AvailablePresetInfo {
  id: PresetId;
  name: string;
  description: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

/** Fetches the list of available game presets from the server. */
export async function fetchAvailablePresets(): Promise<AvailablePresetInfo[]> {
  try {
    console.log(`Fetching presets from ${API_BASE_URL}/presets...`);
    const response = await fetch(`${API_BASE_URL}/presets`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: AvailablePresetInfo[] = await response.json();
    console.log('Received presets:', data);
    return data;
  } catch (error) {
    console.error('Error fetching available presets:', error);
    // Return empty array or re-throw depending on desired error handling
    return []; 
  }
} 