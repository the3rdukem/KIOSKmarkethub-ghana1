import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home, Search, ArrowLeft, ShoppingBag, HelpCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <Link href="/" className="flex items-center justify-center space-x-2 mb-8">
            <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center text-white font-bold text-xl">
              K
            </div>
            <span className="font-bold text-2xl">KIOSK</span>
          </Link>
          
          <div className="mb-6">
            <span className="text-8xl font-bold text-green-600">404</span>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Page Not Found
          </h1>
          <p className="text-gray-600 mb-8">
            Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
          </p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-gray-500 mb-4">Here are some helpful links:</p>
            
            <div className="grid grid-cols-2 gap-3">
              <Button asChild variant="outline" className="flex items-center gap-2">
                <Link href="/">
                  <Home className="w-4 h-4" />
                  Home
                </Link>
              </Button>
              
              <Button asChild variant="outline" className="flex items-center gap-2">
                <Link href="/search">
                  <Search className="w-4 h-4" />
                  Search
                </Link>
              </Button>
              
              <Button asChild variant="outline" className="flex items-center gap-2">
                <Link href="/search">
                  <ShoppingBag className="w-4 h-4" />
                  Products
                </Link>
              </Button>
              
              <Button asChild variant="outline" className="flex items-center gap-2">
                <Link href="/how-it-works">
                  <HelpCircle className="w-4 h-4" />
                  Help
                </Link>
              </Button>
            </div>
            
            <div className="pt-4">
              <Button asChild className="w-full bg-green-600 hover:bg-green-700">
                <Link href="/">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Homepage
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-sm text-gray-500">
          Ghana's trusted marketplace for verified vendors and secure shopping
        </p>
      </div>
    </div>
  );
}
