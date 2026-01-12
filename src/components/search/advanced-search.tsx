"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
// Popover removed - using custom dropdown to prevent input event interception
import {
  Search,
  Clock,
  TrendingUp,
  Package,
  Store,
  X,
  ArrowUpRight,
  Star,
  MapPin,
  Tag,
  Mic,
  Camera
} from "lucide-react";

interface SearchSuggestion {
  id: string;
  type: "product" | "vendor" | "category" | "query";
  title: string;
  subtitle?: string;
  image?: string;
  price?: number;
  rating?: number;
  location?: string;
  popularity?: number;
  category?: string;
}

interface SearchHistory {
  id: string;
  query: string;
  timestamp: string;
  resultsCount: number;
}

interface PopularSearch {
  query: string;
  count: number;
  trending: boolean;
}

// Mock data for suggestions and analytics
const mockSuggestions: SearchSuggestion[] = [
  {
    id: "1",
    type: "product",
    title: "iPhone 15 Pro Max 256GB",
    subtitle: "TechStore Pro",
    price: 4200,
    rating: 4.8,
    location: "Greater Accra",
    category: "Electronics"
  },
  {
    id: "2",
    type: "product",
    title: "MacBook Air M3 13-inch",
    subtitle: "TechStore Pro",
    price: 5200,
    rating: 4.9,
    location: "Greater Accra",
    category: "Electronics"
  },
  {
    id: "3",
    type: "vendor",
    title: "TechStore Pro",
    subtitle: "Electronics • Greater Accra",
    rating: 4.9
  },
  {
    id: "4",
    type: "category",
    title: "Electronics",
    subtitle: "12.5k products"
  },
  {
    id: "5",
    type: "product",
    title: "Traditional Kente Dress",
    subtitle: "Fashion Hub GH",
    price: 350,
    rating: 4.7,
    location: "Ashanti Region",
    category: "Fashion"
  }
];

const mockPopularSearches: PopularSearch[] = [
  { query: "iPhone", count: 1234, trending: true },
  { query: "MacBook", count: 987, trending: true },
  { query: "Kente", count: 756, trending: false },
  { query: "Cocoa", count: 654, trending: false },
  { query: "Smartphone", count: 543, trending: true }
];

interface AdvancedSearchProps {
  placeholder?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  showSuggestions?: boolean;
  showHistory?: boolean;
  showPopular?: boolean;
  onSearch?: (query: string) => void;
  autoFocus?: boolean;
}

export default function AdvancedSearch({
  placeholder = "Search products, vendors, categories...",
  className = "",
  size = "md",
  showSuggestions = true,
  showHistory = true,
  showPopular = true,
  onSearch,
  autoFocus = false
}: AdvancedSearchProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load search history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem("marketHub_searchHistory");
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error("Failed to parse search history:", error);
      }
    }
  }, []);

  // Auto-focus input
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Filter suggestions based on query
  const filteredSuggestions = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return [];

    return mockSuggestions.filter(suggestion =>
      suggestion.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      suggestion.subtitle?.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      suggestion.category?.toLowerCase().includes(debouncedQuery.toLowerCase())
    ).slice(0, 6);
  }, [debouncedQuery]);

  // Get recent searches
  const recentSearches = useMemo(() => {
    return searchHistory
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  }, [searchHistory]);

  const addToHistory = (query: string, resultsCount: number = 0) => {
    if (!query.trim()) return;

    const newEntry: SearchHistory = {
      id: Date.now().toString(),
      query: query.trim(),
      timestamp: new Date().toISOString(),
      resultsCount
    };

    const updatedHistory = [newEntry, ...searchHistory.filter(h => h.query !== query.trim())].slice(0, 10);
    setSearchHistory(updatedHistory);
    localStorage.setItem("marketHub_searchHistory", JSON.stringify(updatedHistory));
  };

  const removeFromHistory = (id: string) => {
    const updatedHistory = searchHistory.filter(h => h.id !== id);
    setSearchHistory(updatedHistory);
    localStorage.setItem("marketHub_searchHistory", JSON.stringify(updatedHistory));
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem("marketHub_searchHistory");
  };

  const handleSearch = (query: string = searchQuery) => {
    if (!query.trim()) return;

    setIsLoading(true);
    addToHistory(query);

    if (onSearch) {
      onSearch(query);
    } else {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }

    setShowDropdown(false);
    setIsLoading(false);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    if (suggestion.type === "product") {
      router.push(`/product/${suggestion.id}`);
    } else if (suggestion.type === "vendor") {
      router.push(`/vendor/${suggestion.id}`);
    } else if (suggestion.type === "category") {
      router.push(`/search?category=${encodeURIComponent(suggestion.title)}`);
    } else {
      handleSearch(suggestion.title);
    }
    setShowDropdown(false);
  };

  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "h-10 text-sm";
      case "lg":
        return "h-14 text-lg";
      default:
        return "h-12 text-base";
    }
  };

  const getIconSize = () => {
    switch (size) {
      case "sm":
        return "w-4 h-4";
      case "lg":
        return "w-6 h-6";
      default:
        return "w-5 h-5";
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Input - placed outside PopoverTrigger to prevent event interception */}
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground ${getIconSize()}`} />
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => {
            // Delay closing to allow clicking on suggestions
            setTimeout(() => setShowDropdown(false), 200);
          }}
          onKeyPress={(e) => e.key === "Enter" && handleSearch()}
          className={`pl-12 pr-20 ${getSizeClasses()}`}
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {/* Voice Search */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto p-1.5"
            onClick={() => alert("Voice search not yet implemented")}
          >
            <Mic className="w-4 h-4 text-muted-foreground" />
          </Button>

          {/* Visual Search */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto p-1.5"
            onClick={() => alert("Visual search not yet implemented")}
          >
            <Camera className="w-4 h-4 text-muted-foreground" />
          </Button>

          {/* Clear/Search Button */}
          {searchQuery ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto p-1.5"
              onClick={() => setSearchQuery("")}
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto p-1.5"
              onClick={() => handleSearch()}
              disabled={isLoading}
            >
              <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      {/* Dropdown suggestions - shown when input is focused */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-lg shadow-lg">
          <Command className="rounded-lg border-none shadow-lg">
            <CommandList className="max-h-96">
              {/* Search Suggestions */}
              {showSuggestions && filteredSuggestions.length > 0 && (
                <CommandGroup heading="Suggestions">
                  {filteredSuggestions.map((suggestion) => (
                    <CommandItem
                      key={suggestion.id}
                      onSelect={() => handleSuggestionClick(suggestion)}
                      className="cursor-pointer p-3"
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                          {suggestion.type === "product" && <Package className="w-4 h-4 text-gray-600" />}
                          {suggestion.type === "vendor" && <Store className="w-4 h-4 text-gray-600" />}
                          {suggestion.type === "category" && <Tag className="w-4 h-4 text-gray-600" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{suggestion.title}</span>
                            {suggestion.type === "product" && suggestion.price && (
                              <span className="text-sm font-semibold text-green-600">
                                GHS {suggestion.price.toLocaleString()}
                              </span>
                            )}
                          </div>

                          {suggestion.subtitle && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{suggestion.subtitle}</span>
                              {suggestion.rating && (
                                <div className="flex items-center gap-1">
                                  <Star className="w-3 h-3 text-yellow-400 fill-current" />
                                  <span>{suggestion.rating}</span>
                                </div>
                              )}
                              {suggestion.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  <span>{suggestion.location}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Recent Searches */}
              {showHistory && recentSearches.length > 0 && (
                <>
                  {filteredSuggestions.length > 0 && <Separator />}
                  <CommandGroup heading="Recent Searches">
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs text-muted-foreground">Recent</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                        onClick={clearHistory}
                      >
                        Clear all
                      </Button>
                    </div>
                    {recentSearches.map((search) => (
                      <CommandItem
                        key={search.id}
                        onSelect={() => handleSearch(search.query)}
                        className="cursor-pointer p-3"
                      >
                        <div className="flex items-center gap-3 w-full">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1">
                            <span className="font-medium">{search.query}</span>
                            <div className="text-xs text-muted-foreground">
                              {search.resultsCount > 0 && `${search.resultsCount} results • `}
                              {new Date(search.timestamp).toLocaleDateString()}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromHistory(search.id);
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {/* Popular Searches */}
              {showPopular && (!debouncedQuery || debouncedQuery.length < 2) && (
                <>
                  {(filteredSuggestions.length > 0 || recentSearches.length > 0) && <Separator />}
                  <CommandGroup heading="Trending">
                    <div className="px-3 py-2 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {mockPopularSearches.map((search, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="cursor-pointer hover:bg-secondary/80 flex items-center gap-1"
                            onClick={() => handleSearch(search.query)}
                          >
                            {search.trending && <TrendingUp className="w-3 h-3" />}
                            {search.query}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CommandGroup>
                </>
              )}

              {/* Empty State */}
              {filteredSuggestions.length === 0 &&
               recentSearches.length === 0 &&
               debouncedQuery.length >= 2 && (
                <CommandEmpty className="py-6 text-center">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                  <p>No suggestions found</p>
                  <p className="text-sm text-muted-foreground">
                    Try searching for products, vendors, or categories
                  </p>
                </CommandEmpty>
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
