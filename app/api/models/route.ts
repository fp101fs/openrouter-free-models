export async function GET() {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    return Response.json({ error: 'Failed to fetch models' }, { status: 502 })
  }

  const data = await res.json()

  const freeModels = (data.data ?? []).filter(
    (m: { pricing?: { prompt?: string; completion?: string } }) =>
      parseFloat(m.pricing?.prompt ?? '1') === 0 &&
      parseFloat(m.pricing?.completion ?? '1') === 0
  )

  return Response.json(freeModels)
}
