'use client';

interface QueryFormProps {
    onSubmit: (query: string) => void;
    loading: boolean;
    query: string;
    setQuery: (query: string) => void;
}

export function QueryForm({ onSubmit, loading, query, setQuery }: QueryFormProps) {

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            onSubmit(query.trim());
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
                <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask about locations... e.g., 'Where was person1 at 3pm?'"
                    className="w-full px-4 py-4 glass rounded-xl resize-none text-gray-800 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300 hover:bg-white/30 dark:hover:bg-white/10"
                    rows={4}
                    disabled={loading}
                />
                <div className="absolute bottom-3 right-3 flex items-center space-x-2">
                    <div className="flex items-center text-xs text-gray-400">
                        <span className="mr-1">⌘</span>
                        <span>Enter</span>
                    </div>
                </div>
            </div>
            <button
                type="submit"
                disabled={loading || !query.trim()}
                className="w-full relative overflow-hidden group bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 text-white py-4 px-6 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/25 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none hover:scale-[1.02] active:scale-[0.98]"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center justify-center">
                    {loading ? (
                        <>
                            <span className="flex items-center">
                                Searching
                                <span className="ml-1 animate-bounce">.</span>
                                <span className="ml-0.5 animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
                                <span className="ml-0.5 animate-bounce" style={{ animationDelay: '0.4s' }}>.</span>
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="mr-2">🔍</span>
                            Ask Question
                        </>
                    )}
                </div>
            </button>
        </form>
    );
}
