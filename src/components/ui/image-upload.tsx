"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ImageUploadProps {
  value?: string;
  onChange: (value: string) => void;
  onRemove?: () => void;
  label?: string;
  description?: string;
  aspectRatio?: "square" | "banner" | "auto";
  maxSizeMB?: number;
  className?: string;
}

export function ImageUpload({
  value,
  onChange,
  onRemove,
  label = "Upload Image",
  description = "PNG, JPG up to 5MB",
  aspectRatio = "auto",
  maxSizeMB = 5,
  className = "",
}: ImageUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const getAspectClass = () => {
    switch (aspectRatio) {
      case "square":
        return "aspect-square";
      case "banner":
        return "aspect-[3/1]";
      default:
        return "min-h-[150px]";
    }
  };

  const handleFileSelect = useCallback(
    async (file: File) => {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }

      // Validate file size
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        toast.error(`Image must be less than ${maxSizeMB}MB`);
        return;
      }

      setIsLoading(true);

      try {
        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          onChange(base64String);
          setIsLoading(false);
        };
        reader.onerror = () => {
          toast.error("Failed to read image file");
          setIsLoading(false);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        toast.error("Failed to process image");
        setIsLoading(false);
      }
    },
    [onChange, maxSizeMB]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove();
    } else {
      onChange("");
    }
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />

      {value ? (
        <div className={`relative rounded-lg overflow-hidden border ${getAspectClass()}`}>
          <img
            src={value}
            alt="Uploaded"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleClick}
            >
              <Upload className="w-4 h-4 mr-1" />
              Change
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemove}
            >
              <X className="w-4 h-4 mr-1" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg cursor-pointer transition-colors
            flex flex-col items-center justify-center p-6
            ${getAspectClass()}
            ${isDragging ? "border-primary bg-primary/5" : "border-gray-300 hover:border-gray-400"}
          `}
        >
          {isLoading ? (
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          ) : (
            <>
              <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
              <p className="text-sm font-medium text-gray-700">{label}</p>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
              <Button type="button" variant="outline" size="sm" className="mt-3">
                <Upload className="w-4 h-4 mr-2" />
                Choose File
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface MultiImageUploadProps {
  values: string[];
  onChange: (values: string[]) => void;
  maxImages?: number;
  maxSizeMB?: number;
  className?: string;
}

export function MultiImageUpload({
  values,
  onChange,
  maxImages = 5,
  maxSizeMB = 5,
  className = "",
}: MultiImageUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Defensive: ensure values is always an array
  const safeValues = Array.isArray(values) ? values : [];

  const handleFileSelect = useCallback(
    async (files: FileList) => {
      const remainingSlots = maxImages - safeValues.length;
      if (remainingSlots <= 0) {
        toast.error(`Maximum ${maxImages} images allowed`);
        return;
      }

      const filesToProcess = Array.from(files).slice(0, remainingSlots);
      setIsLoading(true);

      try {
        const newImages: string[] = [];

        for (const file of filesToProcess) {
          // Validate file type
          if (!file.type.startsWith("image/")) {
            toast.error(`${file.name} is not an image file`);
            continue;
          }

          // Validate file size
          const sizeMB = file.size / (1024 * 1024);
          if (sizeMB > maxSizeMB) {
            toast.error(`${file.name} is larger than ${maxSizeMB}MB`);
            continue;
          }

          // Convert to base64
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          newImages.push(base64);
        }

        if (newImages.length > 0) {
          onChange([...safeValues, ...newImages]);
          toast.success(`Added ${newImages.length} image(s)`);
        }
      } catch (error) {
        toast.error("Failed to process images");
      } finally {
        setIsLoading(false);
      }
    },
    [safeValues, onChange, maxImages, maxSizeMB]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
    // Reset input
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleRemove = (index: number) => {
    const newValues = safeValues.filter((_, i) => i !== index);
    onChange(newValues);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const newValues = [...safeValues];
    const [removed] = newValues.splice(fromIndex, 1);
    newValues.splice(toIndex, 0, removed);
    onChange(newValues);
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleInputChange}
        className="hidden"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {safeValues.map((image, index) => (
          <div
            key={index}
            className="relative aspect-square rounded-lg overflow-hidden border group"
          >
            <img
              src={image}
              alt={`Product image ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => handleRemove(index)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            {index === 0 && (
              <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                Main
              </div>
            )}
          </div>
        ))}

        {safeValues.length < maxImages && (
          <div
            onClick={() => inputRef.current?.click()}
            className="aspect-square border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors flex flex-col items-center justify-center"
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            ) : (
              <>
                <Upload className="w-6 h-6 text-gray-400 mb-1" />
                <span className="text-xs text-muted-foreground">Add Image</span>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        {safeValues.length}/{maxImages} images. First image is the main product image.
      </p>
    </div>
  );
}
