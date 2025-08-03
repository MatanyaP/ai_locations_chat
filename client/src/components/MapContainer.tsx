'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { LocationResponse } from '@/types/api';

const MapComponent = dynamic(() => import('./Map'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100">
      <div className="text-gray-500">Loading map...</div>
    </div>
  ),
});

interface MapContainerProps {
  locations: LocationResponse | null;
}

export function MapContainer({ locations }: MapContainerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Loading map...</div>
      </div>
    );
  }

  return <MapComponent locations={locations} />;
}