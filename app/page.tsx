'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Model {
  id: string
  name: string
  context_length: number
  pricing: { prompt: string; completion: string }
}

type TestStatus = 'idle' | 'testing' | 'pass' | 'fail'

interface TestResult {
  status: TestStatus
  elapsed?: number
  response?: string
  error?: string
}

export default function Home() {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [results, setResults] = useState<Record<string, TestResult>>({})
  const [isTesting, setIsTesting] = useState(false)
  const [exportOnlyPassed, setExportOnlyPassed] = useState(true)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const stopRef = useRef(false)

  useEffect(() => {
    const saved = localStorage.getItem('openrouter_api_key')
    if (saved) setApiKey(saved)
  }, [])

  useEffect(() => {
    localStorage.setItem('openrouter_api_key', apiKey)
  }, [apiKey])

  useEffect(() => {
    fetch('/api/models')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setModels(data)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = models.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.id.toLowerCase().includes(search.toLowerCase())
  )

  const testOne = useCallback(
    async (modelId: string) => {
      setResults((prev) => ({ ...prev, [modelId]: { status: 'testing' } }))
      try {
        const res = await fetch('/api/test-model', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modelId, apiKey }),
        })
        const data = await res.json()
        setResults((prev) => ({
          ...prev,
          [modelId]: {
            status: data.success ? 'pass' : 'fail',
            elapsed: data.elapsed,
            response: data.response,
            error: data.error,
          },
        }))
      } catch {
        setResults((prev) => ({
          ...prev,
          [modelId]: { status: 'fail', error: 'Network error' },
        }))
      }
    },
    [apiKey]
  )

  const testAll = useCallback(async () => {
    if (!apiKey && !process.env.NEXT_PUBLIC_HAS_SERVER_KEY) {
      const key = prompt('Enter your OpenRouter API key (sk-or-...):')
      if (!key) return
      setApiKey(key)
      return
    }
    stopRef.current = false
    setIsTesting(true)
    setProgress({ current: 0, total: filtered.length })
    for (let i = 0; i < filtered.length; i++) {
      if (stopRef.current) break
      setProgress({ current: i + 1, total: filtered.length })
      await testOne(filtered[i].id)
    }
    setIsTesting(false)
    setProgress({ current: 0, total: 0 })
  }, [filtered, testOne, apiKey])

  const stopTesting = () => {
    stopRef.current = true
    setIsTesting(false)
    setProgress({ current: 0, total: 0 })
  }

  const exportJSON = () => {
    const toExport = models
      .filter((m) => {
        if (!exportOnlyPassed) return true
        return results[m.id]?.status === 'pass'
      })
      .map((m) => {
        const r = results[m.id]
        return {
          id: m.id,
          name: m.name,
          context_length: m.context_length,
          ...(r
            ? {
                tested: true,
                test_passed: r.status === 'pass',
                test_elapsed_ms: r.elapsed,
                ...(r.response ? { test_response: r.response } : {}),
                ...(r.error ? { test_error: r.error } : {}),
              }
            : { tested: false }),
        }
      })

    const blob = new Blob([JSON.stringify(toExport, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `openrouter-free-models-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const passCount = Object.values(results).filter((r) => r.status === 'pass').length
  const failCount = Object.values(results).filter((r) => r.status === 'fail').length
  const testedCount = passCount + failCount
  const exportCount = exportOnlyPassed
    ? passCount
    : models.filter((m) => !exportOnlyPassed || results[m.id]?.status === 'pass').length

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-sky-400 mb-1">OpenRouter Free Models</h1>
          <p className="text-gray-500 text-sm">
            {loading
              ? 'Loading models…'
              : error
              ? `Error: ${error}`
              : `${models.length} free models`}
            {testedCount > 0 && (
              <span>
                {' '}· <span className="text-emerald-400">{passCount} passed</span>
                {failCount > 0 && (
                  <span className="text-red-400"> · {failCount} failed</span>
                )}
              </span>
            )}
            {progress.total > 0 && (
              <span className="text-sky-400">
                {' '}· testing {progress.current}/{progress.total}
              </span>
            )}
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 mb-8">
          {/* API key */}
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="OpenRouter API key (sk-or-…) — saved in browser"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm placeholder-gray-600 focus:outline-none focus:border-sky-600"
            />
          </div>

          {/* Search + actions */}
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              placeholder="Search models…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-48 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm placeholder-gray-600 focus:outline-none focus:border-sky-600"
            />

            {isTesting ? (
              <button
                onClick={stopTesting}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={testAll}
                disabled={loading || filtered.length === 0}
                className="px-4 py-2 bg-sky-700 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
              >
                Test all ({filtered.length})
              </button>
            )}

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm text-gray-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={exportOnlyPassed}
                  onChange={(e) => setExportOnlyPassed(e.target.checked)}
                  className="accent-sky-500"
                />
                passed only
              </label>
              <button
                onClick={exportJSON}
                disabled={exportOnlyPassed && passCount === 0}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
              >
                Export JSON{exportCount > 0 ? ` (${exportCount})` : ''}
              </button>
            </div>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <p className="text-center text-gray-600 py-20">Loading…</p>
        ) : error ? (
          <p className="text-center text-red-500 py-20">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-600 py-20">No models match your search.</p>
        ) : (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}
          >
            {filtered.map((model) => {
              const r = results[model.id]
              const status: TestStatus = r?.status ?? 'idle'
              return (
                <div
                  key={model.id}
                  className={[
                    'bg-gray-900 border rounded-xl p-4 flex flex-col gap-2 transition-colors',
                    status === 'pass'
                      ? 'border-emerald-600/40'
                      : status === 'fail'
                      ? 'border-red-600/40'
                      : status === 'testing'
                      ? 'border-sky-500/50'
                      : 'border-gray-800 hover:border-gray-700',
                  ].join(' ')}
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-sm leading-snug">{model.name}</span>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                      <span className="text-xs px-1.5 py-0.5 bg-sky-950 text-sky-400 rounded font-mono">
                        FREE
                      </span>
                      {status === 'testing' && (
                        <span className="text-xs px-1.5 py-0.5 bg-sky-950/60 text-sky-400 rounded animate-pulse">
                          …
                        </span>
                      )}
                      {status === 'pass' && (
                        <span className="text-xs px-1.5 py-0.5 bg-emerald-950 text-emerald-400 rounded">
                          ✓ {r?.elapsed}ms
                        </span>
                      )}
                      {status === 'fail' && (
                        <span className="text-xs px-1.5 py-0.5 bg-red-950 text-red-400 rounded">
                          ✗ fail
                        </span>
                      )}
                      <button
                        onClick={() => testOne(model.id)}
                        disabled={isTesting || status === 'testing'}
                        title="Test this model"
                        className="text-xs px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        ↻
                      </button>
                    </div>
                  </div>

                  {/* Model ID */}
                  <div className="text-xs text-gray-600 font-mono truncate" title={model.id}>
                    {model.id}
                  </div>

                  {/* Context */}
                  <div className="text-xs text-gray-700">
                    {Math.round(model.context_length / 1024)}k ctx
                  </div>

                  {/* Test details */}
                  {status === 'fail' && r?.error && (
                    <div
                      className="text-xs text-red-400/80 truncate"
                      title={r.error}
                    >
                      {r.error}
                    </div>
                  )}
                  {status === 'pass' && r?.response && (
                    <div
                      className="text-xs text-emerald-400/60 truncate"
                      title={r.response}
                    >
                      &ldquo;{r.response}&rdquo;
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
