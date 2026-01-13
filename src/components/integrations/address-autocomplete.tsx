"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Loader2, Navigation, X } from "lucide-react";
import {
  getAddressPredictions,
  getPlaceDetails,
  getCurrentLocation,
  reverseGeocode,
  PlacePrediction,
  PlaceDetails,
  isMapsEnabled,
  fetchMapsApiKey,
} from "@/lib/services/google-maps";
import { cn } from "@/lib/utils";

export interface AddressAutocompleteProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onAddressSelect?: (details: PlaceDetails) => void;
  onValueChange?: (value: string) => void;
  showCurrentLocation?: boolean;
  className?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  types?: string[];
  id?: string;
}

export function AddressAutocomplete({
  label,
  placeholder = "Enter address...",
  value = "",
  onAddressSelect,
  onValueChange,
  showCurrentLocation = true,
  className,
  error,
  required,
  disabled,
  types = ["address"],
  id,
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [mapsEnabled, setMapsEnabled] = useState(false);
  const [mapsInitialized, setMapsInitialized] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    let mounted = true;
    async function initMaps() {
      try {
        const apiKey = await fetchMapsApiKey();
        if (mounted) {
          setMapsEnabled(!!apiKey);
          setMapsInitialized(true);
        }
      } catch {
        if (mounted) {
          setMapsEnabled(false);
          setMapsInitialized(true);
        }
      }
    }
    initMaps();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const searchAddresses = useCallback(
    async (query: string) => {
      if (!query || query.length < 2) {
        setPredictions([]);
        return;
      }

      if (!mapsEnabled) {
        return;
      }

      setIsLoading(true);
      try {
        const result = await getAddressPredictions(query, {
          types,
          componentRestrictions: { country: "gh" },
        });

        if (result.success && result.data) {
          setPredictions(result.data);
          setShowDropdown(result.data.length > 0);
        } else {
          setPredictions([]);
          if (result.integrationDisabled) {
            console.warn("Maps API not available:", result.error);
          }
        }
      } catch (err) {
        console.error("Address search error:", err);
        setPredictions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [mapsEnabled, types]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onValueChange?.(newValue);
    setSelectedIndex(-1);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      searchAddresses(newValue);
    }, 300);
  };

  const handlePredictionSelect = async (prediction: PlacePrediction) => {
    setInputValue(prediction.description);
    onValueChange?.(prediction.description);
    setPredictions([]);
    setShowDropdown(false);

    if (isMapsEnabled()) {
      setIsLoading(true);
      const result = await getPlaceDetails(prediction.placeId);
      setIsLoading(false);

      if (result.success && result.data) {
        onAddressSelect?.(result.data);
      } else {
        onAddressSelect?.({
          placeId: prediction.placeId,
          name: prediction.mainText,
          formattedAddress: prediction.description,
          latitude: 0,
          longitude: 0,
        });
      }
    } else {
      onAddressSelect?.({
        placeId: prediction.placeId,
        name: prediction.mainText,
        formattedAddress: prediction.description,
        latitude: 0,
        longitude: 0,
      });
    }
  };

  const handleGetCurrentLocation = async () => {
    setIsGettingLocation(true);

    try {
      const location = await getCurrentLocation();

      if (!location) {
        console.warn("Could not get current location");
        setIsGettingLocation(false);
        return;
      }

      if (isMapsEnabled()) {
        const result = await reverseGeocode(location.latitude, location.longitude);
        if (result.success && result.data) {
          setInputValue(result.data.formattedAddress);
          onValueChange?.(result.data.formattedAddress);
          onAddressSelect?.(result.data);
        }
      } else {
        const addressText = `Current Location (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`;
        setInputValue(addressText);
        onValueChange?.(addressText);
        onAddressSelect?.({
          placeId: "current_location",
          name: "Current Location",
          formattedAddress: addressText,
          latitude: location.latitude,
          longitude: location.longitude,
        });
      }
    } catch (err) {
      console.error("Error getting location:", err);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || predictions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < predictions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0) {
          handlePredictionSelect(predictions[selectedIndex]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const clearInput = () => {
    setInputValue("");
    onValueChange?.("");
    setPredictions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const inputId = id || "address-input";

  return (
    <div className={cn("relative", className)}>
      {label && (
        <Label htmlFor={inputId} className="mb-2 block">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}

      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

        <Input
          ref={inputRef}
          id={inputId}
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => predictions.length > 0 && setShowDropdown(true)}
          disabled={disabled}
          className={cn(
            "pl-10 pr-20",
            error && "border-red-500 focus-visible:ring-red-500"
          )}
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}

          {inputValue && !isLoading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={clearInput}
            >
              <X className="w-3 h-3" />
            </Button>
          )}

          {showCurrentLocation && mapsEnabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleGetCurrentLocation}
              disabled={isGettingLocation}
              title="Use current location"
            >
              {isGettingLocation ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Navigation className="w-3 h-3" />
              )}
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}

      {showDropdown && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg"
        >
          <ScrollArea className="max-h-[200px]">
            {predictions.map((prediction, index) => (
              <button
                key={prediction.placeId}
                type="button"
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors",
                  "flex items-start gap-2",
                  selectedIndex === index && "bg-gray-100"
                )}
                onClick={() => handlePredictionSelect(prediction)}
              >
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">{prediction.mainText}</p>
                  <p className="text-xs text-muted-foreground">
                    {prediction.secondaryText}
                  </p>
                </div>
              </button>
            ))}
          </ScrollArea>
        </div>
      )}

      {mapsInitialized && !mapsEnabled && (
        <p className="text-xs text-muted-foreground mt-1">
          Type your location manually
        </p>
      )}
    </div>
  );
}
