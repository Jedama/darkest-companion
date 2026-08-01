// src/utils/api.ts
//
// The single door between the frontend and the server.
//
// Rules of the house:
//   1. Nothing outside this file calls fetch().
//   2. Every endpoint returns the *payload*, never the { success, ... } envelope.
//      Callers should not know that envelope exists.
//   3. Every failure — HTTP error, network drop, timeout, malformed JSON —
//      arrives as an ApiError with a .message fit to show a player.
//
// When the server's response shapes get normalised later, this file absorbs
// the change and no component has to move.

import type { Estate } from '../../shared/types/types.ts';

const API_URL = import.meta.env?.VITE_API_URL ?? 'http://localhost:3000';

/** Plain CRUD should never hang for long. */
const DEFAULT_TIMEOUT_MS = 20_000;

/** Anything that waits on an LLM needs a much longer leash. */
export const LLM_TIMEOUT_MS = 5 * 60_000;

/* ------------------------------------------------------------------ *
 *  Errors
 * ------------------------------------------------------------------ */

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 for network/timeout failures that never got one. */
    readonly status: number,
    /** Coarse machine-readable tag: 'network', 'timeout', 'bad_response', or
     *  whatever the server put in its `error` field. */
    readonly code: string,
    /** Anything extra the server sent — e.g. consequences' `rawOutput`. */
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the request never reached the server, or never came back. */
  get isConnectionFailure(): boolean {
    return this.status === 0;
  }
}

/**
 * True when a promise rejected because *we* cancelled it (unmount, modal
 * close). Callers should return silently on these — they are not failures.
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * The server currently speaks three different error dialects:
 *
 *   { error: "Estate 'x' not found" }                     — most routes
 *   { error: "Estate Not Found", message: "..." }         — consequences
 *   { error: "JSON Parsing Error", message, rawOutput }   — consequences
 *
 * So `error` is sometimes the message and sometimes a category. Prefer
 * `message` when present, fall back to `error`, and keep `error` as the code
 * either way. This is the shim that lets us fix the server later without
 * touching any component.
 */
async function toApiError(response: Response): Promise<ApiError> {
  const text = await response.text().catch(() => '');

  let payload: Record<string, unknown> | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // Not JSON — an HTML error page or a proxy message. Fall through.
    }
  }

  const asString = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() !== '' ? value : null;

  const message =
    asString(payload?.message) ??
    asString(payload?.error) ??
    (text ? text.slice(0, 200) : null) ??
    `Request failed (${response.status} ${response.statusText}).`;

  const code = asString(payload?.error) ?? `http_${response.status}`;

  return new ApiError(message, response.status, code, payload?.rawOutput);
}

/* ------------------------------------------------------------------ *
 *  Request core
 * ------------------------------------------------------------------ */

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  /** Serialised as JSON. Omit for GET/DELETE. */
  body?: unknown;
  /** Caller's cancellation signal — unmount, modal close, retry. */
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  // One controller drives both the caller's cancellation and our timeout, so
  // fetch only ever sees a single signal.
  const controller = new AbortController();
  let timedOut = false;

  const forwardAbort = () => controller.abort();
  signal?.addEventListener('abort', forwardAbort);

  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new ApiError(
        `The server did not answer within ${Math.round(timeoutMs / 1000)} seconds.`,
        0,
        'timeout'
      );
    }
    // A genuine cancellation is rethrown untouched so callers can ignore it
    // via isAbortError().
    if (signal?.aborted) throw error;

    throw new ApiError('Could not reach the server. Is it running?', 0, 'network');
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }

  if (!response.ok) throw await toApiError(response);

  return readBody<T>(response);
}

async function readBody<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!text) return undefined as T;

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError(
      'The server sent a response that was not JSON.',
      response.status,
      'bad_response',
      text.slice(0, 500)
    );
  }

  // No route currently returns success:false with a 2xx, but the components
  // used to check for it, so keep the belt as well as the braces.
  const envelope = data as { success?: unknown; error?: unknown; message?: unknown };
  if (envelope && envelope.success === false) {
    const message =
      (typeof envelope.message === 'string' && envelope.message) ||
      (typeof envelope.error === 'string' && envelope.error) ||
      'The server reported a failure.';
    const code = typeof envelope.error === 'string' ? envelope.error : 'unknown';
    throw new ApiError(message, response.status, code, data);
  }

  return data as T;
}

/* ------------------------------------------------------------------ *
 *  Shared response types
 *
 *  These were previously declared by hand in StoryModal and again in
 *  CardComponent. They live here until we promote them to a proper
 *  shared/types/api.ts that the server imports too.
 * ------------------------------------------------------------------ */

/** TODO: narrow against the real event type in shared/types once available. */
export interface StoryEvent {
  identifier: string;
  title: string;
  [key: string]: unknown;
}

export type LocationRef = Record<string, unknown>;

export interface Bystander {
  characterId: string;
  connectionType: string;
}

export interface SetupResult {
  event: StoryEvent;
  chosenCharacterIds: string[];
  locations: LocationRef[];
  npcs: string[];
  bystanders: Bystander[];
  enemies: string[];
  keywords: string[];
  /** True when a queued follow-up pre-empted the random pull. */
  usedFollowUp: boolean;
}

export interface Story {
  title: string;
  body: string;
}

export interface ConsequenceChange {
  text: string;
  color: string;
  affinity?: number;
}

export interface ConsequenceCharacterDisplay {
  identifier: string;
  personalChanges: ConsequenceChange[];
  relationshipChanges: Record<string, ConsequenceChange[]>;
}

export interface ReviewResult {
  estate_log: unknown;
  narratives: unknown[];
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ *
 *  Estates
 * ------------------------------------------------------------------ */

export function fetchEstates(signal?: AbortSignal): Promise<string[]> {
  return request<string[]>('/estates', { signal });
}

export function loadEstate(estateName: string, signal?: AbortSignal): Promise<Estate> {
  return request<Estate>(`/estates/${encodeURIComponent(estateName)}`, { signal });
}

export function createEstate(estateName: string): Promise<Estate> {
  return request<Estate>('/estates', {
    method: 'POST',
    body: { estateName },
  });
}

export function deleteEstate(estateName: string): Promise<void> {
  return request<void>(`/estates/${encodeURIComponent(estateName)}`, {
    method: 'DELETE',
  });
}

/* ------------------------------------------------------------------ *
 *  Story flow
 * ------------------------------------------------------------------ */

export interface SetupEventParams {
  /** An event identifier, or null to let the server pull one at random.
   *  Passing a value here also suppresses queued follow-up events. */
  eventId?: string | null;
  characterIds?: string[];
  enemyIds?: string[];
}

export async function setupStoryEvent(
  estateName: string,
  params: SetupEventParams = {},
  signal?: AbortSignal
): Promise<SetupResult> {
  const data = await request<{ success: true; usedFollowUp: boolean } & SetupResult>(
    `/estates/${encodeURIComponent(estateName)}/events/setup`,
    {
      method: 'POST',
      body: {
        eventId: params.eventId ?? null,
        characterIds: params.characterIds ?? [],
        enemyIds: params.enemyIds ?? [],
      },
      signal,
    }
  );

  const { success: _success, ...result } = data;
  return result;
}

export interface StoryParams {
  event: StoryEvent;
  chosenCharacterIds: string[];
  locations: LocationRef[];
  npcIds: string[];
  enemyIds: string[];
  bystanders: Bystander[];
  keywords: string[];
  /** Extra situational context handed to the prompt. */
  context?: string;
  /** The player's free-text note from the activity log, if any. */
  description?: string | null;
}

/** Runs an LLM call — expect this to take tens of seconds. */
export async function generateStory(
  estateName: string,
  params: StoryParams,
  signal?: AbortSignal
): Promise<Story> {
  const data = await request<{ success: true; story: Story }>(
    `/estates/${encodeURIComponent(estateName)}/events/story`,
    {
      method: 'POST',
      body: { context: '', ...params },
      signal,
      timeoutMs: LLM_TIMEOUT_MS,
    }
  );
  return data.story;
}

/** Runs an LLM call, and persists the results to the estate on success. */
export async function generateConsequences(
  estateName: string,
  params: { story: string; chosenCharacterIds: string[] },
  signal?: AbortSignal
): Promise<ConsequenceCharacterDisplay[]> {
  const data = await request<{
    success: true;
    display: { characters: ConsequenceCharacterDisplay[] };
  }>(`/estates/${encodeURIComponent(estateName)}/events/consequences`, {
    method: 'POST',
    body: params,
    signal,
    timeoutMs: LLM_TIMEOUT_MS,
  });
  return data.display.characters;
}

/* ------------------------------------------------------------------ *
 *  Recruitment
 * ------------------------------------------------------------------ */

export interface RecruitParams {
  eventId: string;
  characterId: string;
  name: string;
  context: string;
}

/**
 * Adds the character to the estate and narrates their arrival.
 * Runs two LLM calls back to back, so it is the slowest route in the game.
 * The estate is written server-side, so refetch it once this resolves.
 */
export async function recruitCharacter(
  estateName: string,
  params: RecruitParams,
  signal?: AbortSignal
): Promise<Story> {
  const data = await request<{ success: true; story: Story }>(
    `/estates/${encodeURIComponent(estateName)}/events/recruit`,
    {
      method: 'POST',
      body: params,
      signal,
      timeoutMs: LLM_TIMEOUT_MS,
    }
  );
  return data.story;
}

/* ------------------------------------------------------------------ *
 *  Static game data
 * ------------------------------------------------------------------ */

export interface CharacterDefinition {
  identifier: string;
  title: string;
  name: string;
}

/**
 * The definition dictionaries the frontend needs to populate lists.
 * Served from static files, so this is fast — but it is also the first call
 * the app makes, which means it doubles as the "is the server up?" probe.
 */
export async function fetchStaticGameData(
  signal?: AbortSignal
): Promise<{ characters: CharacterDefinition[] }> {
  const data = await request<{
    success: true;
    data: { characters: CharacterDefinition[] };
  }>('/game/static-data', { signal });
  return data.data;
}

/* ------------------------------------------------------------------ *
 *  Month end
 * ------------------------------------------------------------------ */

/**
 * Triggers the month-end narrative review.
 *
 * The server increments estate time and rewrites narratives/logs as part of
 * applyReview, so callers should refetch the estate once this resolves.
 * Runs one or more LLM calls, so it can take a long time.
 */
export async function runReview(
  estateName: string,
  signal?: AbortSignal
): Promise<ReviewResult> {
  const data = await request<{ success: true; result: ReviewResult }>(
    `/estates/${encodeURIComponent(estateName)}/review`,
    { method: 'POST', signal, timeoutMs: LLM_TIMEOUT_MS }
  );
  return data.result;
}