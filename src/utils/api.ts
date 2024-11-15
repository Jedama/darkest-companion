// src/utils/api.ts
import type { Estate } from '../../shared/types/types.ts';

const API_URL = 'http://localhost:3000';

class ApiError extends Error {
  constructor(
    public status: number,
    public message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(response.status, data.error || 'Unknown error');
  }
  return response.json();
}

export async function fetchEstates(): Promise<string[]> {
  try {
    const response = await fetch(`${API_URL}/estates`);
    return handleResponse<string[]>(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to connect to server');
  }
}

export async function loadEstate(estateName: string): Promise<Estate> {
  try {
    const response = await fetch(`${API_URL}/estates/${estateName}`);
    return handleResponse<Estate>(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to connect to server');
  }
}

export async function createEstate(estateName: string): Promise<Estate> {
  try {
    const response = await fetch(`${API_URL}/estates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ estateName }),
    });
    return handleResponse<Estate>(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to connect to server');
  }
}

export async function deleteEstate(estateName: string): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/estates/${estateName}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new ApiError(response.status, data.error || 'Unknown error');
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to connect to server');
  }
}