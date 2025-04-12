import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import http from 'http'
import { app } from '../app' // Corrected import path

let server: http.Server

describe('Server API Endpoints', () => {
  // Start the server before running tests
  beforeAll(() => {
    server = http.createServer(app).listen() // Listen on a random available port
  })

  // Close the server after tests are done (using Promise)
  afterAll(() => {
    return new Promise<void>((resolve, reject) => {
      if (server && server.listening) {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve(); // Already closed or not started
      }
    });
  });

  it('GET /health should return 200 OK', async () => {
    // Get the actual port the server is listening on
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Server address is not available')
    }
    const port = address.port

    // Use supertest to make a request to the running test server
    const response = await request(`http://localhost:${port}`).get('/health')

    expect(response.status).toBe(200)
    expect(response.text).toBe('Server healthy')
  })

  // Add more tests for other endpoints (e.g., /api/presets) later
}) 