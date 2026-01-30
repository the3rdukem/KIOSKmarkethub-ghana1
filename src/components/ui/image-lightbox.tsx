"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, ImageOff } from "lucide-react";

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageLightbox({ images, initialIndex = 0, open, onOpenChange }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [imageError, setImageError] = useState(false);

  const validImages = images.filter(url => url && typeof url === 'string' && url.startsWith('http'));

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setZoom(1);
      setImageError(false);
    }
  }, [open, initialIndex]);

  useEffect(() => {
    setImageError(false);
  }, [currentIndex]);

  if (validImages.length === 0) return null;

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : validImages.length - 1));
    setZoom(1);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < validImages.length - 1 ? prev + 1 : 0));
    setZoom(1);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.5, 0.5));
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setZoom(1);
      setImageError(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl w-full p-0 bg-black/95 border-none">
        <DialogTitle className="sr-only">
          Image {currentIndex + 1} of {validImages.length}
        </DialogTitle>
        <div className="relative flex flex-col items-center justify-center min-h-[60vh]">
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              className="text-white hover:bg-white/20"
              disabled={zoom <= 0.5 || imageError}
            >
              <ZoomOut className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              className="text-white hover:bg-white/20"
              disabled={zoom >= 3 || imageError}
            >
              <ZoomIn className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenChange(false)}
              className="text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {validImages.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10"
            >
              <ChevronLeft className="w-8 h-8" />
            </Button>
          )}

          <div className="flex items-center justify-center p-8 overflow-auto max-h-[80vh]">
            {imageError ? (
              <div className="flex flex-col items-center justify-center text-white/60">
                <ImageOff className="w-16 h-16 mb-4" />
                <p>Image failed to load</p>
              </div>
            ) : (
              <img
                src={validImages[currentIndex]}
                alt={`Image ${currentIndex + 1} of ${validImages.length}`}
                className="max-w-full max-h-[70vh] object-contain transition-transform duration-200"
                style={{ transform: `scale(${zoom})` }}
                onError={() => setImageError(true)}
              />
            )}
          </div>

          {validImages.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10"
            >
              <ChevronRight className="w-8 h-8" />
            </Button>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm">
            {currentIndex + 1} / {validImages.length}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ThumbnailState {
  [key: number]: boolean;
}

interface EvidenceGalleryProps {
  images: string[];
}

export function EvidenceGallery({ images }: EvidenceGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<ThumbnailState>({});

  const validImages = images.filter(url => url && typeof url === 'string' && url.startsWith('http'));
  const invalidCount = images.length - validImages.length;

  if (validImages.length === 0 && invalidCount > 0) {
    return <p className="text-xs text-muted-foreground">Images could not be loaded</p>;
  }

  if (validImages.length === 0) {
    return null;
  }

  const handleImageClick = (index: number) => {
    setSelectedIndex(index);
    setLightboxOpen(true);
  };

  const handleImageError = (index: number) => {
    setFailedImages(prev => ({ ...prev, [index]: true }));
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {validImages.map((url, index) => (
          <button
            key={index}
            onClick={() => handleImageClick(index)}
            className="block w-20 h-20 border rounded overflow-hidden hover:ring-2 hover:ring-primary bg-gray-100 cursor-pointer transition-all"
          >
            {failedImages[index] ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                <ImageOff className="w-6 h-6" />
              </div>
            ) : (
              <img
                src={url}
                alt={`Evidence ${index + 1}`}
                className="w-full h-full object-cover"
                onError={() => handleImageError(index)}
              />
            )}
          </button>
        ))}
      </div>
      {invalidCount > 0 && (
        <p className="text-xs text-muted-foreground mt-1">Some images could not be loaded</p>
      )}
      <ImageLightbox
        images={validImages}
        initialIndex={selectedIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </>
  );
}
