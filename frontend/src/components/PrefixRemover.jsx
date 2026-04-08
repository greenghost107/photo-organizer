import { useState, useEffect } from 'react'

function PrefixRemover() {
    const [path, setPath] = useState('')
    const [prefixInput, setPrefixInput] = useState('VID_, VID-, MOV_, IMG_')
    const [status, setStatus] = useState({ running: false, inspected_count: 0, renamed_count: 0, errors: [], current_folder: '' })
    const [lastRenamedCount, setLastRenamedCount] = useState(null)
    const [lastErrors, setLastErrors] = useState([])
    const [isStarting, setIsStarting] = useState(false)

    const truncatePath = (p, maxLen = 60) => {
        if (!p || p.length <= maxLen) return p
        return '...' + p.slice(-maxLen)
    }

    useEffect(() => {
        let interval
        if (status.running || isStarting) {
            interval = setInterval(async () => {
                try {
                    const res = await fetch('http://localhost:8000/remove_prefix/status')
                    const data = await res.json()
                    setStatus(data)
                    if (data.running) {
                        setIsStarting(false)
                    } else if (isStarting && data.inspected_count > 0) {
                        // Backend started and finished between polls
                        setIsStarting(false)
                        setLastRenamedCount(data.renamed_count)
                        setLastErrors(data.errors || [])
                    } else if (!isStarting) {
                        setLastRenamedCount(data.renamed_count)
                        setLastErrors(data.errors || [])
                    }
                } catch (e) {
                    console.error('[PrefixRemover] Status check failed', e)
                }
            }, 500)
        }
        return () => clearInterval(interval)
    }, [status.running, isStarting])

    const parsedPrefixes = prefixInput.split(',').map(p => p.trim()).filter(Boolean)

    const handleRemove = async () => {
        if (!path || parsedPrefixes.length === 0) return

        if (!confirm(`Remove prefixes [${parsedPrefixes.join(', ')}] from all matching filenames in:\n${path}\n\nThis renames files in place. Continue?`)) return

        setLastRenamedCount(null)
        setLastErrors([])
        setIsStarting(true)

        try {
            const res = await fetch('http://localhost:8000/remove_prefix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path, prefixes: parsedPrefixes })
            })
            const data = await res.json()
            if (data.status === 'started') {
                setStatus({ running: true, inspected_count: 0, renamed_count: 0, errors: [], current_folder: '' })
            } else {
                setIsStarting(false)
            }
        } catch (e) {
            console.error('[PrefixRemover] Failed to start', e)
            alert('Failed to start prefix removal.')
            setIsStarting(false)
        }
    }

    const showProgress = status.running || isStarting

    return (
        <div className="animate-in fade-in duration-500">
            <section className="glass p-8 mb-12 space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-grow space-y-2">
                        <label className="text-sm font-semibold text-slate-400 ml-1">Folder Path</label>
                        <input
                            type="text"
                            placeholder="e.g. D:\\Photos\\2023"
                            className="input-field w-full"
                            value={path}
                            onChange={(e) => setPath(e.target.value)}
                            disabled={showProgress}
                        />
                    </div>
                    <button
                        className="btn-primary h-[42px] bg-amber-500 hover:bg-amber-600 border-amber-400/50"
                        onClick={handleRemove}
                        disabled={showProgress || !path || parsedPrefixes.length === 0}
                    >
                        {showProgress ? 'Renaming...' : 'Remove Prefixes'}
                    </button>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-400 ml-1">
                        Prefixes to remove
                        <span className="text-slate-500 font-normal ml-2">(comma-separated)</span>
                    </label>
                    <input
                        type="text"
                        placeholder="e.g. VID_, MOV_, IMG_"
                        className="input-field w-full"
                        value={prefixInput}
                        onChange={(e) => setPrefixInput(e.target.value)}
                        disabled={showProgress}
                    />
                    {parsedPrefixes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                            {parsedPrefixes.map((p, i) => (
                                <span key={i} className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-mono">
                                    {p}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {showProgress && (
                <section className="glass p-8 mb-12 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-amber-400 flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full bg-amber-400 animate-pulse"></span>
                            Renaming in Progress
                        </span>
                        <span className="text-slate-400 font-mono text-xs">
                            {isStarting && !status.running ? 'Starting...' : 'Scanning...'}
                        </span>
                    </div>

                    {status.current_folder && (
                        <div className="text-xs text-slate-500 font-mono bg-slate-800/50 p-2 rounded overflow-hidden">
                            <span className="text-slate-400">Currently scanning: </span>
                            <span className="text-slate-300">{truncatePath(status.current_folder)}</span>
                        </div>
                    )}

                    <div className="flex justify-around text-center gap-4">
                        <div>
                            <div className="text-3xl font-bold text-white">{status.inspected_count.toLocaleString()}</div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Inspected</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-amber-400">{status.renamed_count.toLocaleString()}</div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Renamed</div>
                        </div>
                    </div>

                    <div className="text-center text-xs text-slate-500">
                        {status.errors.length === 0
                            ? '0 errors'
                            : <span className="text-amber-400">{status.errors.length} error{status.errors.length !== 1 ? 's' : ''}</span>
                        }
                    </div>
                </section>
            )}

            {lastRenamedCount !== null && !showProgress && (
                <section className="glass p-8 text-center animate-in zoom-in-95 duration-500 mb-12">
                    <div className="text-5xl mb-4">✏️</div>
                    <h2 className="text-2xl font-bold mb-2">Done!</h2>
                    <p className="text-slate-400">
                        Renamed <span className="text-amber-400 font-bold">{lastRenamedCount.toLocaleString()}</span> file{lastRenamedCount !== 1 ? 's' : ''}.
                    </p>

                    {lastErrors.length > 0 && (
                        <div className="mt-6 text-left">
                            <div className="text-amber-400 font-medium mb-2 flex items-center gap-2">
                                <span>⚠️</span>
                                <span>{lastErrors.length} file{lastErrors.length !== 1 ? 's' : ''} could not be renamed:</span>
                            </div>
                            <div className="bg-slate-800/50 rounded p-3 max-h-40 overflow-y-auto text-xs font-mono">
                                {lastErrors.slice(0, 10).map((err, idx) => (
                                    <div key={idx} className="text-slate-400 mb-1">
                                        <span className="text-slate-500">{truncatePath(err.path, 50)}:</span>{' '}
                                        <span className="text-red-400">{err.error}</span>
                                    </div>
                                ))}
                                {lastErrors.length > 10 && (
                                    <div className="text-slate-500 mt-2">... and {lastErrors.length - 10} more errors</div>
                                )}
                            </div>
                        </div>
                    )}
                </section>
            )}

            <section className="glass p-6 text-sm text-slate-400 space-y-2">
                <h3 className="font-bold text-slate-300">About Prefix Remover</h3>
                <p>
                    Camera apps often prepend filenames with codes like <code>VID_</code> or <code>MOV_</code>.
                    This tool renames files in bulk by stripping those prefixes, leaving the rest of the filename intact.
                </p>
                <p>
                    Comma-separate multiple prefixes to strip several at once. If stripping a prefix would cause a name conflict, that file is skipped and reported as an error.
                </p>
                <p className="text-amber-400/80 italic">
                    Note: This renames files in place — it does not move or delete anything.
                </p>
            </section>
        </div>
    )
}

export default PrefixRemover
