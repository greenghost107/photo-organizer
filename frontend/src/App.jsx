import { useState } from 'react'
import DuplicateFinder from './components/DuplicateFinder'
import JsonRemover from './components/JsonRemover'

function App() {
  const [activeTab, setActiveTab] = useState('duplicates')



  return (
    <div className="max-w-6xl mx-auto p-8 animate-in fade-in duration-1000">
      <header className="mb-12 text-center">
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-4">
          Dup Photo Locator
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Unclutter your media library. Tools to find duplicates and clean up metadata.
        </p>
      </header>

      <nav className="flex justify-center gap-4 mb-12">
        <button
          onClick={() => setActiveTab('duplicates')}
          className={`px-8 py-3 rounded-2xl font-bold transition-all ${activeTab === 'duplicates'
            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
            : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
        >
          Duplicate Finder
        </button>
        <button
          onClick={() => setActiveTab('json')}
          className={`px-8 py-3 rounded-2xl font-bold transition-all ${activeTab === 'json'
            ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
            : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
        >
          JSON Remover
        </button>
      </nav>

      <main>
        {activeTab === 'duplicates' ? <DuplicateFinder /> : <JsonRemover />}
      </main>
    </div>
  )
}

export default App
