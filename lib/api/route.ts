import { type NextRequest, type NextResponse } from "next/server";
import { fail } from "./response";

// Wrap an API route handler with a single try/catch so an unexpected throw
// becomes a generic 500 ({ error }) — logged server-side with method+path —
// instead of leaking a stack trace. Guarantees every handler resolves to a
// NextResponse. Auth, validation, and business logic stay inside the handler.
//
// Variadic args preserve the handler's own signature, so it works for plain
// routes `(req)` and dynamic routes `(req, { params })` alike.
//
//   export const POST = withRoute(async (req) => { ...; return ok(data); });
export function withRoute<Args extends unknown[]>(
  handler: (req: NextRequest, ...args: Args) => Promise<NextResponse>,
): (req: NextRequest, ...args: Args) => Promise<NextResponse> {
  return async (req: NextRequest, ...args: Args): Promise<NextResponse> => {
    try {
      return await handler(req, ...args);
    } catch (error) {
      console.error(`[route ${req.method} ${new URL(req.url).pathname}]`, error);
      return fail("internal error", 500);
    }
  };
}
