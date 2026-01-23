"use client";

import { useEffect, useState } from "react";
import { syncAuthWithServer } from "@/lib/auth-store";

/**
 * Database Initializer Component
 *
 * Initializes the database and syncs auth state with the server.
 * This component should be rendered in the root layout.
 */
export function DbInitializer({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        // Initialize database
        await fetch('/api/db/init');

        // Sync auth with server
        await syncAuthWithServer();

        setInitialized(true);
      } catch (err) {
        console.error('App initialization error:', err);
        // Still render children even if init fails
        setInitialized(true);
      }
    }

    init();
  }, []);

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
