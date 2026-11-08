/**
 * Express 4 does not catch rejected promises from async handlers.
 * Wrap them so errors reach the global error middleware.
 */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
