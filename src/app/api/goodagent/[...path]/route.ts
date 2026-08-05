import { NextRequest, NextResponse } from 'next/server'

const HOST_BASE =
  process.env.GOODAGENT_HOST_URL?.replace(/\/$/, '') ??
  process.env.NEXT_PUBLIC_GOODAGENT_HOST_URL?.replace(/\/$/, '') ??
  'https://goodagentids.xyz/host'

const PARTNER_KEY =
  process.env.GOODAGENT_PARTNER_API_KEY?.trim() ??
  process.env.NEXT_PUBLIC_GOODAGENT_PARTNER_KEY?.trim()

/** Proxy GoodAgent host calls server-side (avoids CORS + hides partner key). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(req, await params)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(req, await params)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(req, await params)
}

async function proxy(
  req: NextRequest,
  { path }: { path: string[] },
): Promise<NextResponse> {
  const suffix = path.join('/')
  const url = new URL(`${HOST_BASE}/${suffix}`)
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value)
  })

  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  const contentType = req.headers.get('content-type')
  if (contentType) headers['Content-Type'] = contentType
  if (PARTNER_KEY) headers['x-partner-key'] = PARTNER_KEY

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text()
  }

  let upstream: Response
  try {
    upstream = await fetch(url.toString(), init)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Host unreachable'
    return NextResponse.json(
      { error: 'HOST_UNREACHABLE', message },
      { status: 502 },
    )
  }

  const text = await upstream.text()
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      'Content-Type':
        upstream.headers.get('content-type') ?? 'application/json',
    },
  })
}
