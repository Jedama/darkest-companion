// server/middleware/errorHandler.ts
import type { ErrorRequestHandler, RequestHandler, Request, Response, NextFunction } from 'express';
import { AppError } from '../errors.js';

/** Any shape of typed request a route might declare. */
type AnyRequest = Request<any, any, any, any, any>;

/**
 * Wraps an async route so a rejected promise reaches Express's error pipeline.
 *
 * Without this, `throw` inside an async handler is an unhandled rejection and
 * the request hangs until it times out. With it, routes lose their try/catch
 * entirely: throw an AppError and the middleware below does the rest.
 *
 * Generic over the handler's own Request/Response types so a route can keep
 * declaring `Request<{ estateName: string }, {}, SomeBody>` and still type-check.
 */
export function asyncHandler<Req extends AnyRequest, Res extends Response<any, any>>(
  handler: (req: Req, res: Res, next: NextFunction) => unknown
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req as unknown as Req, res as unknown as Res, next)).catch(next);
  };
}

/** Anything that fell through every route. Mounted after the routers. */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: `No route matches ${req.method} ${req.path}.`,
    code: 'not_found',
  });
};

/**
 * The single place an error becomes a response body.
 *
 * Shape, for every failure the server can produce:
 *   { error: "<message fit to show a player>", code: "<machine tag>", details?: ... }
 *
 * `error` is ALWAYS the human message and `code` is ALWAYS the tag — never the
 * other way around, which is what the old routes disagreed about.
 *
 * Must be registered last, and must keep all four parameters: Express
 * identifies error middleware by arity, so dropping `next` silently breaks it.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // A response already started streaming; only Express can tidy this up.
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    // Expected failures are noise at stack-trace volume; one line is enough.
    console.error(`[${err.code}] ${req.method} ${req.path} → ${err.status}: ${err.message}`);
    if (err.details !== undefined) {
      console.error(JSON.stringify(err.details, null, 2));
    }

    res.status(err.status).json({
      error: err.message,
      code: err.code,
      ...(err.details !== undefined && { details: err.details }),
    });
    return;
  }

  // Anything else is a bug. Log it in full, tell the client nothing specific.
  console.error(`[internal] ${req.method} ${req.path}`, err);

  const isProduction = process.env.NODE_ENV === 'production';

  res.status(500).json({
    error: 'Something went wrong on the server.',
    code: 'internal',
    // While developing, the real message is far more useful than the platitude.
    ...(isProduction ? {} : { details: err instanceof Error ? err.message : String(err) }),
  });
};