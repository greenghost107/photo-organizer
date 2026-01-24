import { useState, useEffect } from 'react'

function DuplicateFinder() {
    const [path, setPath] = useState('')
    const [status, setStatus] = useState({ scanning: false, progress: 0, total_files: 0 })
    const [results, setResults] = useState([])
    const [selected, setSelected] = useState(new Set())

    useEffect(() => {
        let interval;
        if (status.scanning) {
            interval = setInterval(async () => {
                try {
                    const res = await fetch('http://localhost:8000/status');
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
            const res = await fetch('http://localhost:8000/results');
            const data = await res.json();
            setResults(data.results);
        } catch (e) {
            console.error("Failed to fetch results", e);
        }
    };

    const startScan = async () => {
        if (!path) return;
        try {
            const res = await fetch('http://localhost:8000/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            const data = await res.json();
            if (data.status === 'started') {
                setStatus({ scanning: true, progress: 0, total_files: 0 });
                setResults([]);
            }
        } catch (e) {
            console.error("Failed to start scan", e);
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
            const res = await fetch('http://localhost:8000/delete', {
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

    return (
        <div className="animate-in fade-in duration-500">
            <section className="glass p-8 mb-12 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-grow space-y-2">
                    <label className="text-sm font-semibold text-slate-400 ml-1">Library Folder Path</label>
                    <input
                        type="text"
                        placeholder="e.g. C:\\Users\\Media\\Photos"
                        className="input-field w-full"
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                        disabled={status.scanning}
                    />
                </div>
                <button
                    className="btn-primary h-[42px]"
                    onClick={startScan}
                    disabled={status.scanning || !path}
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
                    <p className="text-sm text-slate-500 text-center italic">
                        Traversing files... {status.total_files > 0 ? `Found ${status.total_files} items` : ''}
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

                    <div className="space-y-6">
                        {results.map((group, idx) => (
                            <div key={idx} className="glass overflow-hidden">
                                <div className="bg-white bg-opacity-5 px-6 py-3 border-b border-white border-opacity-10 flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-400">Duplicate Group #{idx + 1}</span>
                                    <span className="text-xs font-mono px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded">
                                        {formatSize(group[0].size)}
                                    </span>
                                </div>
                                <div className="p-6 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                                    {group.map((file) => (
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
                                                {file.name.match(/\\.(jpg|jpeg|png|gif|heic)$/i) ? (
                                                    <img
                                                        src={`http://localhost:8000/file?path=${encodeURIComponent(file.path)}`}
                                                        className="w-full h-full object-cover"
                                                        alt={file.name}
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="text-3xl opacity-20 group-hover:opacity-40 transition-opacity">
                                                        {file.name.match(/\\.(mp4|mov|avi|mkv)$/i) ? '🎞️' : '📸'}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="flex-grow min-w-0">
                                                    <div className="truncate text-sm font-medium mb-0.5" title={file.name}>{file.name}</div>
                                                    <div className="truncate text-[10px] text-slate-500" title={file.path}>{file.path}</div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        fetch(`http://localhost:8000/reveal?path=${encodeURIComponent(file.path)}`);
                                                    }}
                                                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors flex-shrink-0"
                                                    title="Reveal in Explorer"
                                                >
                                                    📂
                                                </button>
                                            </div>
                                        </div>
                                    ))}
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
