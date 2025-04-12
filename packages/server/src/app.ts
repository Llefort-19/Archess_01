import express, { Request, Response } from 'express'
import cors from 'cors'
import path from 'path'
import { presetService } from './services/PresetService'
import dotenv from 'dotenv'

// Load environment variables for client URL
// Note: dotenv.config() should ideally be called once at the entry point (index.ts)
// but we need CLIENT_URL here for CORS config.
// Consider passing clientUrl as a config option if this feels awkward.
dotenv.config({ path: path.resolve(__dirname, '../../.env') })
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'

const app = express()

// Configure CORS
app.use(cors({ origin: clientUrl }))

// --- API Endpoints --- 
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).send('Server healthy')
})

app.get('/api/presets', (_req: Request, res: Response) => {
  const presets = presetService.listAvailablePresets();
  res.status(200).json(presets);
});

// Export the configured app
export { app } 