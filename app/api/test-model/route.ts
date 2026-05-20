export const maxDuration = 60

export async function POST(request: Request) {
  const { modelId, apiKey } = await request.json()
  const key: string = apiKey || process.env.OPENROUTER_API_KEY || ''

  if (!key) {
    return Response.json({ success: false, error: 'No API key provided' }, { status: 400 })
  }

  const start = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Reply with just the word OK' }],
        max_tokens: 10,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)
    const elapsed = Date.now() - start
    const data = await res.json()

    if (!res.ok || data.error) {
      return Response.json({
        success: false,
        error: data.error?.message ?? `HTTP ${res.status}`,
        elapsed,
      })
    }

    const content: string = data.choices?.[0]?.message?.content ?? ''
    return Response.json({ success: true, elapsed, response: content })
  } catch (err) {
    clearTimeout(timeout)
    const elapsed = Date.now() - start
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    return Response.json({
      success: false,
      error: isTimeout ? 'Timeout (30s)' : err instanceof Error ? err.message : 'Unknown error',
      elapsed,
    })
  }
}
