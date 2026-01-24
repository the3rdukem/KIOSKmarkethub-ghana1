"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Database, CheckCircle, Info, Shield, ArrowLeft } from "lucide-react";

/**
 * Data Management Page
 *
 * The old seed utility has been replaced with proper database persistence.
 * Data is now stored in SQLite and persists across sessions.
 */
export default function DataManagementPage() {
  const [dbStatus, setDbStatus] = useState<{
    initialized: boolean;
    healthy: boolean;
    tables: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkDb() {
      try {
        const response = await fetch('/api/db/init');
        if (response.ok) {
          const data = await response.json();
          setDbStatus({
            initialized: data.initialized,
            healthy: data.healthy,
            tables: data.stats?.tables || [],
          });
        }
      } catch (error) {
        console.error('Failed to check database:', error);
      } finally {
        setLoading(false);
      }
    }
    checkDb();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container max-w-2xl">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Home
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <Database className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">Data Persistence</h1>
          <p className="text-muted-foreground">
            Your marketplace data is now stored in a persistent database
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              Database Status
            </CardTitle>
            <CardDescription>
              Real-time status of the database system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600" />
                Checking database...
              </div>
            ) : dbStatus ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Initialized</span>
                  <Badge variant={dbStatus.initialized ? "default" : "destructive"}>
                    {dbStatus.initialized ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Health Check</span>
                  <Badge variant={dbStatus.healthy ? "default" : "destructive"}>
                    {dbStatus.healthy ? "Healthy" : "Unhealthy"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Tables</span>
                  <Badge variant="outline">{dbStatus.tables.length} tables</Badge>
                </div>
              </div>
            ) : (
              <div className="text-red-600">Failed to connect to database</div>
            )}
          </CardContent>
        </Card>

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Migration Complete:</strong> The old localStorage-based seed system has been replaced with
            SQLite database persistence. All data now persists across:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Browser refreshes</li>
              <li>Logout/login cycles</li>
              <li>Server restarts</li>
              <li>Different browsers and devices</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              What's Changed
            </CardTitle>
          </CardHeader>
          <CardContent className="text-green-900 text-sm space-y-2">
            <p><strong>Users:</strong> Stored in database, survive logout/login</p>
            <p><strong>Products:</strong> Stored in database, persist forever</p>
            <p><strong>Orders:</strong> Stored in database, full history preserved</p>
            <p><strong>API Keys:</strong> Stored server-side only, never exposed to client</p>
            <p><strong>Sessions:</strong> Server-managed with httpOnly cookies</p>
            <p><strong>Audit Logs:</strong> Complete history in database</p>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            To create test data, use the admin panel to create users and products.
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild variant="outline">
              <Link href="/admin/login">Admin Login</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/register">Create Account</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
