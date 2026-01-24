import { useState, useEffect } from 'react'

function JsonRemover() {
    const [path, setPath] = useState('')
    const [status, setStatus] = useState({ running: false, inspected_count: 0, removed_count: 0, errors: [], current_folder: '' })
    const [lastRemovedCount, setLastRemovedCount] = useState(null)
    const [lastErrors, setLastErrors] = useState([])
    const [isStarting, setIsStarting] = useState(false)

    // Truncate long paths for display
    const truncatePath = (p, maxLen = 60) => {
        if (!p || p.length <= maxLen) return p
        return '...' + p.slice(-maxLen)
    }

    useEffect(() => {
        let interval;
        if (status.running || isStarting) {
            interval = setInterval(async () => {
                try {
                    console.log('[JsonRemover] Polling status...')
                    const res = await fetch('http://localhost:8000/remove_json/status');
                    const data = await res.json();
                    console.log('[JsonRemover] Status response:', data)
                    setStatus(data);

                    // Once we get a running status, we're no longer in "starting" state
                    if (data.running) {
                        setIsStarting(false)
                    }

                    if (!data.running && !isStarting) {
                        setLastRemovedCount(data.removed_count);
                        setLastErrors(data.errors || []);
                    }
                } catch (e) {
                    console.error("[JsonRemover] Status check failed", e);
                }
            }, 500);
        }
        return () => clearInterval(interval);
    }, [status.running, isStarting]);

    const handleRemove = async () => {
        if (!path) return;

        if (!confirm("Are you sure you want to remove ALL JSON files in this directory and its subdirectories? They will be moved to the Trash.")) {
            return;
        }

        setLastRemovedCount(null);
        setLastErrors([]);
        setIsStarting(true);

        try {
            console.log('[JsonRemover] Starting removal for path:', path)
            const res = await fetch('http://localhost:8000/remove_json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            const data = await res.json();
            console.log('[JsonRemover] Start response:', data)
            if (data.status === 'started') {
                setStatus({ running: true, inspected_count: 0, removed_count: 0, errors: [], current_folder: '' });
            } else {
                setIsStarting(false);
            }
        } catch (e) {
            console.error("[JsonRemover] Remove JSON failed", e);
            alert("Failed to start JSON removal.");
            setIsStarting(false);
        }
    };

    const showProgress = status.running || isStarting;

    return (
        <div className="animate-in fade-in duration-500">
            <section className="glass p-8 mb-12 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-grow space-y-2">
                    <label className="text-sm font-semibold text-slate-400 ml-1">Cleanup Folder Path</label>
                    <input
                        type="text"
                        placeholder="e.g. C:\\Users\\Media\\Downloads\\Google Takeout"
                        className="input-field w-full"
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                        disabled={showProgress}
                    />
                </div>
                <button
                    className="btn-primary h-[42px] bg-rose-500 hover:bg-rose-600 border-rose-400/50"
                    onClick={handleRemove}
                    disabled={showProgress || !path}
                >
                    {showProgress ? 'Cleaning...' : 'Remove JSONs'}
                </button>
            </section>

            {showProgress && (
                <section className="glass p-8 mb-12 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-rose-400 flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full bg-rose-400 animate-pulse"></span>
                            Cleanup in Progress
                        </span>
                        <span className="text-slate-400 font-mono text-xs">
                            {isStarting && !status.running ? 'Starting cleanup...' : 'Scanning...'}
                        </span>
                    </div>

                    {/* Current folder display */}
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
                            <div className="text-3xl font-bold text-rose-400">{status.removed_count.toLocaleString()}</div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">JSONs Found</div>
                        </div>
                    </div>

                    {/* Error count during operation */}
                    <div className="text-center text-xs text-slate-500">
                        {status.errors.length === 0
                            ? '0 errors'
                            : <span className="text-amber-400">{status.errors.length} error{status.errors.length !== 1 ? 's' : ''}</span>
                        }
                    </div>
                </section>
            )}

            {lastRemovedCount !== null && !showProgress && (
                <section className="glass p-8 text-center animate-in zoom-in-95 duration-500 mb-12">
                    <div className="text-5xl mb-4">🧹</div>
                    <h2 className="text-2xl font-bold mb-2">Cleanup Complete!</h2>
                    <p className="text-slate-400">
                        Successfully moved <span className="text-indigo-400 font-bold">{lastRemovedCount.toLocaleString()}</span> JSON files to the trash.
                    </p>

                    {/* Show errors if any occurred */}
                    {lastErrors.length > 0 && (
                        <div className="mt-6 text-left">
                            <div className="text-amber-400 font-medium mb-2 flex items-center gap-2">
                                <span>⚠️</span>
                                <span>{lastErrors.length} file{lastErrors.length !== 1 ? 's' : ''} could not be removed:</span>
                            </div>
                            <div className="bg-slate-800/50 rounded p-3 max-h-40 overflow-y-auto text-xs font-mono">
                                {lastErrors.slice(0, 10).map((err, idx) => (
                                    <div key={idx} className="text-slate-400 mb-1">
                                        <span className="text-slate-500">{truncatePath(err.path, 50)}:</span>{' '}
                                        <span className="text-red-400">{err.error}</span>
                                    </div>
                                ))}
                                {lastErrors.length > 10 && (
                                    <div className="text-slate-500 mt-2">
                                        ... and {lastErrors.length - 10} more errors
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </section>
            )}

            <section className="glass p-6 text-sm text-slate-400 space-y-2">
                <h3 className="font-bold text-slate-300">About JSON Remover</h3>
                <p>
                    Google Takeout often exports metadata (like GPS coordinates and timestamps) into separate <code>.json</code> files.
                    If you just want your photos and videos, these files can clutter your library.
                </p>
                <p className="text-rose-400/80 italic">
                    Note: This action is recursive and will target all <code>.json</code> files in the specified path.
                </p>
            </section>
        </div>
    )
}

export default JsonRemover
