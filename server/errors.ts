// server/errors.ts
//
// One error type for the whole server. Routes throw these; the error
// middleware turns them into responses. Nothing else formats an error body.
//
// Status conventions:
//   4xx  the request was wrong        — the client can fix it
//   502  the model misbehaved         — retrying is reasonable
//   500  we broke                     — details stay server-side

export type ErrorCode =
  | 'bad_request'
  | 'estate_not_found'
  | 'estate_exists'
  | 'estate_busy'
  | 'invalid_state'
  | 'not_found'
  | 'llm_unavailable'
  | 'llm_bad_json'
  | 'llm_bad_content'
  | 'internal';

export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ErrorCode,
    /** Anything useful for debugging. Echoed to the client as-is. */
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace?.(this, AppError);
  }

  /** The request asked for something that isn't there. */
  static notFound(message: string, code: ErrorCode = 'not_found'): AppError {
    return new AppError(message, 404, code);
  }

  static estateNotFound(estateName: string): AppError {
    return new AppError(`Estate '${estateName}' not found.`, 404, 'estate_not_found');
  }

  /** The request was malformed or missing something. */
  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(message, 400, 'bad_request', details);
  }

  /** The request is well-formed but the game isn't in a state to serve it. */
  static invalidState(message: string): AppError {
    return new AppError(message, 409, 'invalid_state');
  }

  static estateExists(estateName: string): AppError {
    return new AppError(`An estate named '${estateName}' already exists.`, 409, 'estate_exists');
  }

  /**
   * Another request has held the write lock on this estate for longer than we
   * are willing to wait. 503 rather than 409: nothing is wrong with the
   * request, it just needs trying again shortly.
   */
  static estateBusy(estateName: string, waitedMs: number): AppError {
    return new AppError(
      `Estate '${estateName}' is busy with another action. Try again in a moment.`,
      503,
      'estate_busy',
      { waitedMs }
    );
  }

  /** The provider call itself failed — network, auth, rate limit, outage. */
  static llmUnavailable(message: string, details?: unknown): AppError {
    return new AppError(
      `The storyteller could not be reached: ${message}`,
      502,
      'llm_unavailable',
      details
    );
  }

  /** The model answered, but not with parseable JSON. */
  static llmBadJson(label: string, raw: string): AppError {
    return new AppError(
      `The ${label} response was not valid JSON.`,
      502,
      'llm_bad_json',
      { raw: truncate(raw) }
    );
  }

  /** The model answered with valid JSON that breaks the game's rules. */
  static llmBadContent(label: string, problems: string[], raw?: unknown): AppError {
    const summary = problems.length === 1 ? problems[0] : `${problems.length} problems`;
    return new AppError(
      `The ${label} response failed validation: ${summary}`,
      502,
      'llm_bad_content',
      { problems, raw }
    );
  }
}

function truncate(text: string, max = 2000): string {
  return text.length > max ? `${text.slice(0, max)}… [${text.length - max} more chars]` : text;
}