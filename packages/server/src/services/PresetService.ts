import fs from 'fs'
import path from 'path'
// Import pathToFileURL from the 'url' module
import { pathToFileURL } from 'url';
import type { GamePreset, PresetId } from '@archess/shared'

// Load presets from the compiled output directory
const presetsDir = './dist/config/presets'

// In-memory cache for loaded presets
const loadedPresets: Map<PresetId, GamePreset> = new Map()
const availablePresetsList: { id: PresetId; name: string; description: string }[] = []

class PresetService {
    constructor() {
        this.loadPresets()
    }

    private async loadPresets(): Promise<void> {
        try {
            // Resolve the absolute path to the presets directory *once*
            const absolutePresetsDir = path.resolve(__dirname, '../..', presetsDir); 
            // Verify directory exists before reading
            if (!fs.existsSync(absolutePresetsDir)) {
                console.error(`[PresetService] Presets directory not found: ${absolutePresetsDir}`);
                return;
            }

            const presetFiles = fs.readdirSync(absolutePresetsDir)
              .filter((file: string) => (file.endsWith('.json') || file.endsWith('.js')) && !file.endsWith('.d.ts'));

            for (const file of presetFiles) {
              // Construct absolute path to the file
              const absoluteFilePath = path.join(absolutePresetsDir, file);
              try {
                let rawPresetData: unknown;
                if (file.endsWith('.js')) {
                   // Convert absolute path to file URL for dynamic import
                   const fileUrl = pathToFileURL(absoluteFilePath).href;
                   const importedModule: { default?: unknown } | unknown = await import(fileUrl);
                   if (typeof importedModule === 'object' && importedModule !== null && 'default' in importedModule) {
                       rawPresetData = importedModule.default;
                   } else {
                       rawPresetData = importedModule;
                   }
                } else {
                   // Read JSON using absolute path
                   rawPresetData = JSON.parse(fs.readFileSync(absoluteFilePath, 'utf-8'));
                }
                
                if (this.validatePreset(rawPresetData)) { 
                    loadedPresets.set(rawPresetData.id, rawPresetData)
                    availablePresetsList.push({
                        id: rawPresetData.id,
                        name: rawPresetData.name,
                        description: rawPresetData.description ?? 'No description available.'
                    });
                    console.log(`[PresetService] Loaded preset: ${rawPresetData.name} (${rawPresetData.id})`)
                } else {
                    console.warn(`[PresetService] Invalid or incomplete preset data in file: ${file}`)
                }
              } catch (importError) {
                console.error(`[PresetService] Error importing or parsing preset file ${absoluteFilePath}:`, importError)
              }
            }
        } catch (readDirError) {
            // Use absolute path in error message
            console.error(`[PresetService] Error reading presets directory ${path.resolve(__dirname, '../..', presetsDir)}:`, readDirError)
        }
    }

    private validatePreset(preset: unknown): preset is GamePreset {
        if (typeof preset !== 'object' || preset === null) return false;
        
        const p = preset as Partial<GamePreset>;
        
        return typeof p.id === 'string' &&
               typeof p.name === 'string' &&
               typeof p.description === 'string' &&
               typeof p.board === 'object' &&
               typeof p.units === 'object' &&
               Array.isArray(p.winConditions) &&
               typeof p.arenaWidth === 'number' &&
               typeof p.arenaHeight === 'number'
    }

    getAllPresets(): GamePreset[] {
        return Array.from(loadedPresets.values())
    }

    getPresetById(id: PresetId): GamePreset | undefined {
        return loadedPresets.get(id)
    }

    listAvailablePresets(): { id: PresetId; name: string; description: string }[] {
        // The list is populated during the initial load in the constructor.
        // The warning check is no longer necessary here.
        // if (!availablePresetsList.length && !loadedPresets.size) {
        //    console.warn('Attempted to list presets before loading. Call loadAllPresets() first.')
        // }
        return [...availablePresetsList]; // Return a copy of the populated list
    }
}

// Export a singleton instance
export const presetService = new PresetService() 