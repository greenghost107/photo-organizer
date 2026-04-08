import { useState, useEffect, useRef, useMemo } from 'react'

const SOURCE_COLORS = [
    { text: 'text-cyan-400',    bg: 'bg-cyan-500/20',    border: 'border-cyan-500/40',    dot: 'bg-cyan-400' },
    { text: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', dot: 'bg-emerald-400' },
    { text: 'text-amber-400',   bg: 'bg-amber-500/20',   border: 'border-amber-500/40',   dot: 'bg-amber-400' },
    { text: 'text-violet-400',  bg: 'bg-violet-500/20',  border: 'border-violet-500/40',  dot: 'bg-violet-400' },
    { text: 'text-rose-400',    bg: 'bg-rose-500/20',    border: 'border-rose-500/40',    dot: 'bg-rose-400' },
    { text: 'text-orange-400',  bg: 'bg-orange-500/20',  border: 'border-orange-500/40',  dot: 'bg-orange-400' },
    { text: 'text-pink-400',    bg: 'bg-pink-500/20',    border: 'border-pink-500/40',    dot: 'bg-pink-400' },
    { text: 'text-lime-400',    bg: 'bg-lime-500/20',    border: 'border-lime-500/40',    dot: 'bg-lime-400' },
]

function DuplicateFinder() {
    const [paths, setPaths] = useState([''])
    const [pathValidation, setPathValidation] = useState({}) // index -> true | false | null
    const [status, setStatus] = useState({
        scanning: false,
        progress: 0,
        total_files: 0,
        current_folder: '',
        folders_completed: 0,
        folders_total: 0
    })
    const [results, setResults] = useState([])
    const [selected, setSelected] = useState(new Set())
    const [activeSourceFilters, setActiveSourceFilters] = useState(new Set())

    const validationTimers = useRef({})

    // Derive unique source roots and assign colors
    const sourceColorMap = useMemo(() => {
        const roots = [...new Set(results.flatMap(g => g.map(f => f.source_root)).filter(Boolean))]
        return Object.fromEntries(roots.map((r, i) => [r, SOURCE_COLORS[i % SOURCE_COLORS.length]]))
    }, [results])

    // Filter results by active source filters
    const filteredResults = useMemo(() => {
        if (activeSourceFilters.size === 0) return results
        return results.filter(group => group.some(f => activeSourceFilters.has(f.source_root)))
    }, [results, activeSourceFilters])

    useEffect(() => {
        let interval;
        if (status.scanning) {
            interval = setInterval(async () => {
                try {
                    const res = await fetch('/status');
                    const data = await res.json();
                    setStatus(data);
                    if (!data.scanning && data.progress === 100) {
                        fetchResults();
                    }
                } catch (e) {
                    console.error("Status check failed", e);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [status.scanning]);

    const fetchResults = async () => {
        try {
            const res = await fetch('/results');
            const data = await res.json();
            setResults(data.results);
            setActiveSourceFilters(new Set());
        } catch (e) {
            console.error("Failed to fetch results", e);
        }
    };

    const addPath = () => {
        setPaths([...paths, ''])
    };

    const removePath = (index) => {
        if (paths.length > 1) {
            setPaths(paths.filter((_, i) => i !== index))
            // Rebuild validation map without the removed index, shifting indices down
            setPathValidation(prev => {
                const next = {}
                Object.entries(prev).forEach(([k, v]) => {
                    const ki = parseInt(k)
                    if (ki < index) next[ki] = v
                    else if (ki > index) next[ki - 1] = v
                })
                return next
            })
        }
    };

    const updatePath = (index, value) => {
        const newPaths = [...paths]
        newPaths[index] = value
        setPaths(newPaths)

        // Reset validation for this index
        setPathValidation(prev => ({ ...prev, [index]: null }))

        // Clear existing timer for this index
        if (validationTimers.current[index]) {
            clearTimeout(validationTimers.current[index])
        }

        if (!value.trim()) return

        // Debounce path validation
        validationTimers.current[index] = setTimeout(async () => {
            try {
                const res = await fetch(`/validate_path?path=${encodeURIComponent(value)}`)
                const data = await res.json()
                setPathValidation(prev => ({ ...prev, [index]: data.valid }))
            } catch (e) {
                setPathValidation(prev => ({ ...prev, [index]: false }))
            }
        }, 600)
    };

    const startScan = async () => {
        const validPaths = paths.filter(p => p.trim() !== '');
        if (validPaths.length === 0) return;

        try {
            const res = await fetch('/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paths: validPaths })
            });
            const data = await res.json();
            if (data.status === 'started') {
                setStatus({
                    scanning: true,
                    progress: 0,
                    total_files: 0,
                    current_folder: '',
                    folders_completed: 0,
                    folders_total: validPaths.length
                });
                setResults([]);
                setActiveSourceFilters(new Set());
            }
        } catch (e) {
            console.error("Failed to start scan", e);
            alert("Failed to start scan. Make sure all paths are valid.");
        }
    };

    const toggleSelect = (path) => {
        const next = new Set(selected);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        setSelected(next);
    };

    const deleteSelected = async () => {
        const pathsToDelete = Array.from(selected);
        if (!pathsToDelete.length) return;

        if (!confirm(`Trash ${pathsToDelete.length} files?`)) return;

        try {
            const res = await fetch('/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paths: pathsToDelete })
            });
            const data = await res.json();
            alert(`Moved ${data.deleted.length} files to trash.`);
            setSelected(new Set());
            fetchResults();
        } catch (e) {
            console.error("Delete failed", e);
        }
    };

    const toggleSourceFilter = (root) => {
        setActiveSourceFilters(prev => {
            const next = new Set(prev)
            if (next.has(root)) next.delete(root)
            else next.add(root)
            return next
        })
    };

    const formatSize = (bytes) => {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let val = bytes;
        let unitIdx = 0;
        while (val > 1024 && unitIdx < units.length - 1) {
            val /= 1024;
            unitIdx++;
        }
        return `${val.toFixed(2)} ${units[unitIdx]}`;
    };

    // Scan button disabled if scanning, all paths empty, or any non-empty path is invalid
    const hasInvalidPath = paths.some((p, i) => p.trim() !== '' && pathValidation[i] === false)
    const scanDisabled = status.scanning || paths.every(p => p.trim() === '') || hasInvalidPath

    const uniqueSourceRoots = Object.keys(sourceColorMap)

    return (
        <div className="animate-in fade-in duration-500">
            <section className="glass p-8 mb-12 space-y-4">
                <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-slate-400">Folders to Scan</label>
                    <button
                        className="text-sm px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/30 transition-all disabled:opacity-50"
                        onClick={addPath}
                        disabled={status.scanning}
                    >
                        + Add Folder
                    </button>
                </div>

                <div className="space-y-3">
                    {paths.map((path, index) => {
                        const validation = pathValidation[index]
                        return (
                            <div key={index} className="flex gap-2 items-center">
                                <div className="flex-grow relative">
                                    <input
                                        type="text"
                                        placeholder="e.g. D:\\Photos\\2023"
                                        className={`input-field w-full pr-8 ${
                                            validation === false ? 'border-rose-500/60 focus:border-rose-500' :
                                            validation === true  ? 'border-emerald-500/60 focus:border-emerald-500' : ''
                                        }`}
                                        value={path}
                                        onChange={(e) => updatePath(index, e.target.value)}
                                        disabled={status.scanning}
                                    />
                                    {path.trim() !== '' && validation !== null && (
                                        <span className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-bold pointer-events-none ${
                                            validation ? 'text-emerald-400' : 'text-rose-400'
                                        }`}>
                                            {validation ? '✓' : '✕'}
                                        </span>
                                    )}
                                </div>
                                {paths.length > 1 && (
                                    <button
                                        className="px-3 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg hover:bg-rose-500/20 transition-all disabled:opacity-50"
                                        onClick={() => removePath(index)}
                                        disabled={status.scanning}
                                        title="Remove this folder"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>

                {hasInvalidPath && (
                    <p className="text-xs text-rose-400 italic">One or more paths are invalid or inaccessible.</p>
                )}

                <button
                    className="btn-primary w-full"
                    onClick={startScan}
                    disabled={scanDisabled}
                >
                    {status.scanning ? 'Scanning...' : 'Start Scan'}
                </button>
            </section>

            {status.scanning && (
                <section className="glass p-8 mb-12 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">Scan Progress</span>
                        <span className="text-indigo-400 font-mono">{status.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                        <div
                            className="bg-indigo-500 h-full transition-all duration-500 rounded-full"
                            style={{ width: `${status.progress}%` }}
                        />
                    </div>
                    {status.folders_total > 1 && (
                        <p className="text-sm text-slate-400 text-center">
                            {status.folders_completed < status.folders_total
                                ? `Scanning folder ${status.folders_completed + 1} of ${status.folders_total}`
                                : 'Hashing files...'}
                        </p>
                    )}
                    {status.current_folder && (
                        <p className="text-xs text-slate-500 text-center italic truncate" title={status.current_folder}>
                            {status.current_folder}
                        </p>
                    )}
                    <p className="text-sm text-slate-500 text-center italic">
                        {status.total_files > 0 ? `Found ${status.total_files} media files` : 'Traversing files...'}
                    </p>
                </section>
            )}

            {results.length > 0 && (
                <section className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold">Groups Found: {results.length}</h2>
                        <button
                            className="px-4 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50"
                            disabled={selected.size === 0}
                            onClick={deleteSelected}
                        >
                            Trash Selected ({selected.size})
                        </button>
                    </div>

                    {/* Source folder filter bar */}
                    {uniqueSourceRoots.length > 1 && (
                        <div className="space-y-2">
                            <div className="flex flex-wrap gap-2 items-center">
                                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider mr-1">Filter by source:</span>
                                {uniqueSourceRoots.map(root => {
                                    const color = sourceColorMap[root]
                                    const active = activeSourceFilters.has(root)
                                    const groupCount = results.filter(g => g.some(f => f.source_root === root)).length
                                    return (
                                        <button
                                            key={root}
                                            onClick={() => toggleSourceFilter(root)}
                                            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                                                active
                                                    ? `${color.bg} ${color.text} ${color.border}`
                                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                                            }`}
                                            title={root}
                                        >
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`}></span>
                                            <span className="truncate max-w-[160px]">{root.split(/[\\/]/).pop() || root}</span>
                                            <span className="opacity-60">({groupCount})</span>
                                        </button>
                                    )
                                })}
                                {activeSourceFilters.size > 0 && (
                                    <button
                                        onClick={() => setActiveSourceFilters(new Set())}
                                        className="text-xs text-slate-500 hover:text-slate-300 underline ml-1 transition-colors"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider mr-1">Select dupes from:</span>
                                {uniqueSourceRoots.map(root => {
                                    const color = sourceColorMap[root]
                                    // Count how many files from this source are selectable (have a duplicate from another source)
                                    const selectableFromRoot = results.flatMap(group => {
                                        const fromRoot = group.filter(f => f.source_root === root)
                                        const fromOther = group.filter(f => f.source_root !== root)
                                        // Only selectable if there are copies from another source (keeps at least one)
                                        return fromOther.length > 0 ? fromRoot : []
                                    })
                                    const allSelected = selectableFromRoot.length > 0 && selectableFromRoot.every(f => selected.has(f.path))
                                    return (
                                        <button
                                            key={root}
                                            onClick={() => {
                                                const next = new Set(selected)
                                                if (allSelected) {
                                                    selectableFromRoot.forEach(f => next.delete(f.path))
                                                } else {
                                                    selectableFromRoot.forEach(f => next.add(f.path))
                                                }
                                                setSelected(next)
                                            }}
                                            disabled={selectableFromRoot.length === 0}
                                            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all disabled:opacity-30 ${
                                                allSelected
                                                    ? `${color.bg} ${color.text} ${color.border}`
                                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                                            }`}
                                            title={allSelected ? `Deselect all from ${root}` : `Select all duplicates from ${root}`}
                                        >
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`}></span>
                                            <span className="truncate max-w-[160px]">{root.split(/[\\/]/).pop() || root}</span>
                                            <span className="opacity-60">({selectableFromRoot.length})</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {activeSourceFilters.size > 0 && (
                        <p className="text-sm text-slate-500 -mt-4">
                            Showing {filteredResults.length} of {results.length} groups
                        </p>
                    )}

                    <div className="space-y-6">
                        {filteredResults.map((group, idx) => (
                            <div key={idx} className="glass overflow-hidden">
                                <div className="bg-white bg-opacity-5 px-6 py-3 border-b border-white border-opacity-10 flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-400">Duplicate Group #{idx + 1}</span>
                                    <span className="text-xs font-mono px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded">
                                        {formatSize(group[0].size)}
                                    </span>
                                </div>
                                <div className="p-6 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                                    {group.map((file) => {
                                        const color = sourceColorMap[file.source_root] || SOURCE_COLORS[0]
                                        return (
                                            <div
                                                key={file.path}
                                                onClick={() => toggleSelect(file.path)}
                                                className={`relative group cursor-pointer p-3 rounded-xl border transition-all ${selected.has(file.path)
                                                    ? 'bg-indigo-500/10 border-indigo-500/50'
                                                    : 'bg-slate-900 border-transparent hover:border-slate-700'
                                                    }`}
                                            >
                                                <div className="absolute top-2 right-2 z-10">
                                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${selected.has(file.path) ? 'bg-indigo-500 border-indigo-500' : 'bg-transparent border-slate-600'
                                                        }`}>
                                                        {selected.has(file.path) && <span className="text-[10px] text-white">✓</span>}
                                                    </div>
                                                </div>
                                                <div className="aspect-square bg-slate-800 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                                                    {file.name.match(/\.(jpg|jpeg|png|gif|heic)$/i) ? (
                                                        <img
                                                            src={`/file?path=${encodeURIComponent(file.path)}`}
                                                            className="w-full h-full object-cover"
                                                            alt={file.name}
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <div className="text-3xl opacity-20 group-hover:opacity-40 transition-opacity">
                                                            {file.name.match(/\.(mp4|mov|avi|mkv)$/i) ? '🎞️' : '📸'}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <div className="flex-grow min-w-0">
                                                            <div className="truncate text-sm font-medium mb-0.5" title={file.name}>{file.name}</div>
                                                            <div className="truncate text-[10px] text-slate-500" title={file.path}>{file.path}</div>
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                fetch(`/reveal?path=${encodeURIComponent(file.path)}`);
                                                            }}
                                                            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors flex-shrink-0"
                                                            title="Reveal in Explorer"
                                                        >
                                                            📂
                                                        </button>
                                                    </div>
                                                    {file.source_root && (
                                                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${color.bg}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color.dot}`}></span>
                                                            <span className={`text-[9px] font-medium truncate ${color.text}`} title={file.source_root}>
                                                                {file.source_root}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {results.length === 0 && !status.scanning && status.progress === 100 && (
                <div className="text-center p-12 glass">
                    <p className="text-lg text-slate-400 italic">No duplicates found in this folder. Your library is clean!</p>
                </div>
            )}
        </div>
    )
}

export default DuplicateFinder
