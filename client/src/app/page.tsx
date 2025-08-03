'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MapContainer } from '@/components/MapContainer';
import { QueryForm } from '@/components/QueryForm';
import { LocationResponse } from '@/types/api';

export default function Home() {
    const [locations, setLocations] = useState<LocationResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [availablePersons, setAvailablePersons] = useState<string[]>([]);
    const [query, setQuery] = useState('');

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    useEffect(() => {
        const fetchPersons = async () => {
            try {
                const response = await fetch(`${API_URL}/persons`);
                if (response.ok) {
                    const data = await response.json();
                    setAvailablePersons(data.persons || []);
                }
            } catch (error) {
                console.error('Error fetching available persons:', error);
                setAvailablePersons(['person1', 'person2']);
            }
        };

        fetchPersons();
    }, [API_URL]);

    const handleQuery = async (query: string) => {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch');
            }

            const data = await response.json();
            setLocations(data);
        } catch (error) {
            console.error('Error querying locations:', error);
            alert('Error querying locations. Make sure the backend server is running.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative">
            {/* Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-gradient-to-br from-purple-400/20 to-pink-400/20 blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-gradient-to-tr from-blue-400/20 to-cyan-400/20 blur-3xl"></div>
            </div>

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10">
                {/* Header */}
                <div className="mb-8 sm:mb-12 text-center">
                    <div className="inline-block mb-4 sm:mb-6">
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent mb-2 sm:mb-4">
                            LocationGPT
                        </h1>
                        <div className="h-1 w-24 sm:w-32 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full mx-auto"></div>
                    </div>
                    <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 font-light px-4">
                        Natural language queries for location data in{' '}
                        <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">
                            Tel Aviv
                        </span>
                    </p>
                    {availablePersons.length > 0 && (
                        <p className="text-sm text-gray-500 mt-2">
                            Tracking: {availablePersons.join(', ')}
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                    {/* Query Panel */}
                    <div className="lg:col-span-1 space-y-4 sm:space-y-6">
                        <div className="glass-card p-4 sm:p-6 lg:p-8">
                            <div className="flex items-center mb-6">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mr-3">
                                    <span className="text-white text-sm font-bold">?</span>
                                </div>
                                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Ask a Question</h2>
                            </div>
                            <QueryForm onSubmit={handleQuery} loading={loading} query={query} setQuery={setQuery} />

                            {locations && (
                                <div className="mt-8 p-6 glass rounded-xl border-l-4 border-gradient-to-b from-blue-500 to-purple-500">
                                    <div className="flex items-center mb-3">
                                        <h3 className="font-semibold text-gray-800 dark:text-white">Result Summary</h3>
                                    </div>
                                    <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-gray-800 dark:text-white">{children}</h1>,
                                                h2: ({ children }) => <h2 className="text-base font-semibold mb-1 text-gray-800 dark:text-white">{children}</h2>,
                                                h3: ({ children }) => <h3 className="text-sm font-medium mb-1 text-gray-800 dark:text-white">{children}</h3>,
                                                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                                                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                                                li: ({ children }) => <li className="text-gray-700 dark:text-gray-300">{children}</li>,
                                                strong: ({ children }) => <strong className="font-semibold text-gray-800 dark:text-white">{children}</strong>,
                                                em: ({ children }) => <em className="italic text-gray-600 dark:text-gray-400">{children}</em>,
                                                code: ({ children }) => <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                                                blockquote: ({ children }) => <blockquote className="border-l-2 border-blue-300 pl-3 italic text-gray-600 dark:text-gray-400 mb-2">{children}</blockquote>
                                            }}
                                        >
                                            {locations.summary}
                                        </ReactMarkdown>
                                    </div>

                                    <div className="mt-4 space-y-2">
                                        {locations.person && (
                                            <div className="flex items-center text-xs">
                                                <span className="text-gray-600 dark:text-gray-400">Person: {locations.person}</span>
                                            </div>
                                        )}
                                        {locations.persons && (
                                            <div className="flex items-center text-xs">
                                                <span className="text-gray-600 dark:text-gray-400">Persons: {locations.persons.join(', ')}</span>
                                            </div>
                                        )}
                                        {locations.time_period && (
                                            <div className="flex items-center text-xs">
                                                <span className="text-gray-600 dark:text-gray-400">Time: {locations.time_period}</span>
                                            </div>
                                        )}
                                        {locations.person_colors && (
                                            <div className="mt-3">
                                                <p className="text-gray-600 dark:text-gray-400 text-xs mb-2 flex items-center">
                                                    Map Colors:
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {Object.entries(locations.person_colors).map(([person, color]) => (
                                                        <div key={person} className="flex items-center bg-white/50 dark:bg-black/20 px-2 py-1 rounded-full">
                                                            <div
                                                                className="w-3 h-3 rounded-full mr-2 border border-white/50"
                                                                style={{ backgroundColor: color }}
                                                            />
                                                            <span className="text-xs text-gray-700 dark:text-gray-300">{person}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="mt-8">
                                <div className="flex items-center mb-4">
                                    <h3 className="font-semibold text-gray-800 dark:text-white">Example Queries</h3>
                                </div>
                                <div className="space-y-3 text-sm">
                                    {availablePersons.length > 0 && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    const queryText = `Where was ${availablePersons[0]} between 8am and 11am?`;
                                                    setQuery(queryText);
                                                    handleQuery(queryText);
                                                }}
                                                className="block w-full text-left p-3 glass rounded-lg hover:bg-white/30 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-all duration-200 hover:scale-[1.02]"
                                            >
                                                Where was {availablePersons[0]} between 8am and 11am?
                                            </button>
                                            {availablePersons.length > 1 && (
                                                <button
                                                    onClick={() => {
                                                        const queryText = `What locations did ${availablePersons[1]} visit throughout the day?`;
                                                        setQuery(queryText);
                                                        handleQuery(queryText);
                                                    }}
                                                    className="block w-full text-left p-3 glass rounded-lg hover:bg-white/30 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-all duration-200 hover:scale-[1.02]"
                                                >
                                                    What locations did {availablePersons[1]} visit throughout the day?
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    const queryText = `Where was ${availablePersons[0]} at 3pm?`;
                                                    setQuery(queryText);
                                                    handleQuery(queryText);
                                                }}
                                                className="block w-full text-left p-3 glass rounded-lg hover:bg-white/30 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-all duration-200 hover:scale-[1.02]"
                                            >
                                                Where was {availablePersons[0]} at 3pm?
                                            </button>

                                            {/* Multi-person example queries */}
                                            {availablePersons.length > 1 && (
                                                <>
                                                    <div className="border-t border-white/20 pt-3 mt-4">
                                                        <p className="font-medium text-gray-600 dark:text-gray-400 mb-3 text-xs flex items-center">
                                                            Multi-Person Queries:
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const queryText = `Where were ${availablePersons[0]} and ${availablePersons[1]} at 3pm?`;
                                                            setQuery(queryText);
                                                            handleQuery(queryText);
                                                        }}
                                                        className="block w-full text-left p-3 glass rounded-lg hover:bg-gradient-to-r hover:from-green-50/50 hover:to-blue-50/50 dark:hover:from-green-900/20 dark:hover:to-blue-900/20 text-gray-700 dark:text-gray-300 transition-all duration-200 hover:scale-[1.02]"
                                                    >
                                                        Where were {availablePersons[0]} and {availablePersons[1]} at 3pm?
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const queryText = `Were there any locations where ${availablePersons[0]} and ${availablePersons[1]} were together?`;
                                                            setQuery(queryText);
                                                            handleQuery(queryText);
                                                        }}
                                                        className="block w-full text-left p-3 glass rounded-lg hover:bg-gradient-to-r hover:from-green-50/50 hover:to-blue-50/50 dark:hover:from-green-900/20 dark:hover:to-blue-900/20 text-gray-700 dark:text-gray-300 transition-all duration-200 hover:scale-[1.02]"
                                                    >
                                                        Were {availablePersons[0]} and {availablePersons[1]} ever together?
                                                    </button>
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Map Panel */}
                    <div className="lg:col-span-2">
                        <div className="glass-card overflow-hidden">
                            <div className="h-[400px] sm:h-[500px] lg:h-[650px] relative">
                                <div className="absolute top-4 left-4 z-10 glass px-4 py-2 rounded-lg">
                                    <div className="flex items-center">
                                        <div className="w-3 h-3 rounded-full bg-green-400 mr-2 animate-pulse"></div>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Live Map</span>
                                    </div>
                                </div>
                                <MapContainer locations={locations} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
