"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  Image as ImageIcon,
  Video,
  Link as LinkIcon,
  GripVertical,
  Eye,
  EyeOff,
  Loader2,
  Upload,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";

interface HeroSlide {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
  order_num: number;
  is_active: boolean;
  media_type: 'image' | 'video';
  video_url: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminHeroSlidesPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingSlide, setEditingSlide] = useState<HeroSlide | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    image_url: "",
    link_url: "",
    is_active: true,
    media_type: "image" as "image" | "video",
    video_url: "",
  });

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      router.push("/admin/login");
      return;
    }
    if (user?.role !== "admin" && user?.role !== "master_admin") {
      toast.error("Access denied. Admin privileges required.");
      router.push("/");
    }
  }, [isAuthenticated, user, router, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      fetchSlides();
    }
  }, [isHydrated]);

  const fetchSlides = async () => {
    try {
      const res = await fetch("/api/hero-slides");
      if (res.ok) {
        const data = await res.json();
        setSlides(data.slides || []);
      }
    } catch (error) {
      console.error("Failed to fetch slides:", error);
      toast.error("Failed to load slides");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (slide?: HeroSlide) => {
    if (slide) {
      setEditingSlide(slide);
      setFormData({
        title: slide.title || "",
        subtitle: slide.subtitle || "",
        image_url: slide.image_url,
        link_url: slide.link_url || "",
        is_active: slide.is_active,
        media_type: slide.media_type || "image",
        video_url: slide.video_url || "",
      });
    } else {
      setEditingSlide(null);
      setFormData({
        title: "",
        subtitle: "",
        image_url: "",
        link_url: "",
        is_active: true,
        media_type: "image",
        video_url: "",
      });
    }
    setShowDialog(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, image_url: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Video must be less than 50MB");
      return;
    }

    if (!file.type.startsWith("video/")) {
      toast.error("Please upload a valid video file (MP4, WebM)");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, video_url: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (formData.media_type === "image" && !formData.image_url) {
      toast.error("Please upload an image");
      return;
    }
    if (formData.media_type === "video" && !formData.video_url && !formData.image_url) {
      toast.error("Please upload a video and poster image");
      return;
    }

    setIsSaving(true);
    try {
      const url = editingSlide
        ? `/api/hero-slides/${editingSlide.id}`
        : "/api/hero-slides";
      const method = editingSlide ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          order_num: editingSlide?.order_num ?? slides.length,
        }),
      });

      if (res.ok) {
        toast.success(editingSlide ? "Slide updated" : "Slide created");
        setShowDialog(false);
        fetchSlides();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to save slide");
      }
    } catch (error) {
      toast.error("Failed to save slide");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this slide?")) return;

    try {
      const res = await fetch(`/api/hero-slides/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Slide deleted");
        fetchSlides();
      } else {
        toast.error("Failed to delete slide");
      }
    } catch (error) {
      toast.error("Failed to delete slide");
    }
  };

  const handleToggleActive = async (slide: HeroSlide) => {
    try {
      const res = await fetch(`/api/hero-slides/${slide.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !slide.is_active }),
      });
      if (res.ok) {
        toast.success(slide.is_active ? "Slide hidden" : "Slide activated");
        fetchSlides();
      }
    } catch (error) {
      toast.error("Failed to update slide");
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newSlides = [...slides];
    [newSlides[index - 1], newSlides[index]] = [newSlides[index], newSlides[index - 1]];
    
    await Promise.all([
      fetch(`/api/hero-slides/${newSlides[index - 1].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_num: index - 1 }),
      }),
      fetch(`/api/hero-slides/${newSlides[index].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_num: index }),
      }),
    ]);
    
    fetchSlides();
  };

  const handleMoveDown = async (index: number) => {
    if (index === slides.length - 1) return;
    const newSlides = [...slides];
    [newSlides[index], newSlides[index + 1]] = [newSlides[index + 1], newSlides[index]];
    
    await Promise.all([
      fetch(`/api/hero-slides/${newSlides[index].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_num: index }),
      }),
      fetch(`/api/hero-slides/${newSlides[index + 1].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_num: index + 1 }),
      }),
    ]);
    
    fetchSlides();
  };

  if (!isHydrated) {
    return (
      <SiteLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="container py-8 max-w-6xl">
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin
            </Link>
          </Button>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2">
              <ImageIcon className="w-6 h-6" />
              Hero Slideshow
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage hero banner slides for the homepage carousel
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Add Slide
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : slides.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No slides yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first hero slide to display on the homepage
              </p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Slide
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Slides ({slides.length})</CardTitle>
              <CardDescription>
                Drag to reorder slides. Active slides will appear in the homepage carousel.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Order</TableHead>
                    <TableHead className="w-[120px]">Media</TableHead>
                    <TableHead className="w-[60px]">Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slides.map((slide, index) => (
                    <TableRow key={slide.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === 0}
                            onClick={() => handleMoveUp(index)}
                          >
                            <ArrowUp className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === slides.length - 1}
                            onClick={() => handleMoveDown(index)}
                          >
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {slide.media_type === "video" && slide.video_url ? (
                          <div className="relative w-24 h-14">
                            <video
                              src={slide.video_url}
                              className="w-24 h-14 object-cover rounded"
                              muted
                              poster={slide.image_url}
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Video className="w-6 h-6 text-white drop-shadow-lg" />
                            </div>
                          </div>
                        ) : (
                          <img
                            src={slide.image_url}
                            alt={slide.title || "Slide"}
                            className="w-24 h-14 object-cover rounded"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={slide.media_type === "video" ? "secondary" : "outline"}>
                          {slide.media_type === "video" ? (
                            <><Video className="w-3 h-3 mr-1" />Video</>
                          ) : (
                            <><ImageIcon className="w-3 h-3 mr-1" />Image</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{slide.title || "(No title)"}</p>
                          {slide.subtitle && (
                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {slide.subtitle}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {slide.link_url ? (
                          <div className="flex items-center gap-1 text-sm text-blue-600">
                            <LinkIcon className="w-3 h-3" />
                            <span className="truncate max-w-[150px]">{slide.link_url}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={slide.is_active ? "default" : "secondary"}>
                          {slide.is_active ? "Active" : "Hidden"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(slide)}
                            title={slide.is_active ? "Hide" : "Show"}
                          >
                            {slide.is_active ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(slide)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(slide.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingSlide ? "Edit Slide" : "Add New Slide"}
              </DialogTitle>
              <DialogDescription>
                Create a hero banner slide with an image and optional link
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label className="mb-2 block">Media Type</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={formData.media_type === "image" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({ ...formData, media_type: "image" })}
                    className="flex items-center gap-2"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Image
                  </Button>
                  <Button
                    type="button"
                    variant={formData.media_type === "video" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({ ...formData, media_type: "video" })}
                    className="flex items-center gap-2"
                  >
                    <Video className="w-4 h-4" />
                    Video
                  </Button>
                </div>
              </div>

              {formData.media_type === "video" && (
                <div>
                  <Label>Video File *</Label>
                  <div className="mt-2">
                    {formData.video_url ? (
                      <div className="relative">
                        <video
                          src={formData.video_url}
                          className="w-full h-48 object-cover rounded-lg"
                          controls
                          muted
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={() => setFormData({ ...formData, video_url: "" })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                        <Video className="w-8 h-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">
                          Click to upload video
                        </span>
                        <span className="text-xs text-muted-foreground mt-1">
                          MP4 or WebM, max 50MB
                        </span>
                        <input
                          type="file"
                          accept="video/mp4,video/webm"
                          className="hidden"
                          onChange={handleVideoUpload}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              <div>
                <Label>{formData.media_type === "video" ? "Poster Image (fallback) *" : "Slide Image *"}</Label>
                <div className="mt-2">
                  {formData.image_url ? (
                    <div className="relative">
                      <img
                        src={formData.image_url}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => setFormData({ ...formData, image_url: "" })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                      <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">
                        Click to upload image
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        {formData.media_type === "video" 
                          ? "Shown while video loads, required" 
                          : "Recommended: 1920x600px, max 5MB"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title (optional)</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Summer Sale"
                  />
                </div>
                <div>
                  <Label htmlFor="link_url">Link URL (optional)</Label>
                  <Input
                    id="link_url"
                    value={formData.link_url}
                    onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                    placeholder="e.g., /search?sale=true"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="subtitle">Subtitle (optional)</Label>
                <Input
                  id="subtitle"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="e.g., Up to 50% off on selected items"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active (visible on homepage)</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingSlide ? "Update Slide" : "Create Slide"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SiteLayout>
  );
}
