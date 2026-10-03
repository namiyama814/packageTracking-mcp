/** Timing-safe comparison for shared secrets. */
export async function timingSafeEqualString(
  a: string,
  b: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const length = Math.max(aBytes.length, bBytes.length);
  const aPadded = new Uint8Array(length);
  const bPadded = new Uint8Array(length);
  aPadded.set(aBytes);
  bPadded.set(bBytes);

  let mismatch = aBytes.length === bBytes.length ? 0 : 1;
  for (let i = 0; i < length; i++) {
    mismatch |= aPadded[i]! ^ bPadded[i]!;
  }
  return mismatch === 0;
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function authorizeSharedSecret(
  request: Request,
  sharedSecret: string | undefined,
): Promise<Response | null> {
  if (!sharedSecret) {
    return Response.json(
      {
        error: "server_misconfigured",
        message: "MCP_SHARED_SECRET is not configured",
      },
      { status: 500 },
    );
  }

  const token = extractBearerToken(request);
  if (!token || !(await timingSafeEqualString(token, sharedSecret))) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Bearer realm="package-tracking-mcp"',
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  return null;
}
