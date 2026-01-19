"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Plus,
  MoreHorizontal,
  Archive,
  Flag,
  Volume2,
  VolumeX,
  Settings,
  MessageSquare,
  Package,
  Star,
  User,
  Calendar,
  Bell,
  BellOff,
  Send,
  Paperclip,
  Image as ImageIcon,
  Smile,
  CheckCheck,
  Check,
  Circle,
  ArrowLeft,
  Loader2,
  ShoppingBag,
  Store,
  ExternalLink,
  XCircle
} from "lucide-react";
import { formatDistance, format } from "date-fns";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";
import { useMessagingStore, Conversation, Message } from "@/lib/messaging-store";
import { useUsersStore } from "@/lib/users-store";
import { useProductsStore } from "@/lib/products-store";

function MessagesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vendorParam = searchParams.get('vendor');
  const productParam = searchParams.get('product');
  const conversationParam = searchParams.get('conversation');

  // Hydration state
  const [isHydrated, setIsHydrated] = useState(false);

  // Get auth state safely
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Hydration effect
  useEffect(() => {
    setIsHydrated(true);
  }, []);
  const {
    conversations,
    messages,
    unreadCount,
    isLoading,
    fetchConversations,
    fetchMessages,
    sendMessage,
    markConversationAsRead,
    createConversation,
    archiveConversation,
    updateConversationSettings,
  } = useMessagingStore();
  const { users } = useUsersStore();
  const { getProductById } = useProductsStore();

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newConversationVendorId, setNewConversationVendorId] = useState("");
  const [newConversationVendorName, setNewConversationVendorName] = useState("");
  const [newConversationProductName, setNewConversationProductName] = useState("");
  const [newConversationMessage, setNewConversationMessage] = useState("");
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isLoadingVendor, setIsLoadingVendor] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [vendorProducts, setVendorProducts] = useState<Array<{id: string; name: string; price: number; image?: string}>>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine user role
  const userRole = user?.role === 'vendor' ? 'vendor' : 'buyer';
  
  // Fetch conversations on mount
  useEffect(() => {
    if (user && isHydrated) {
      fetchConversations();
    }
  }, [user, isHydrated, fetchConversations]);
  
  // Filter conversations based on user role
  const userConversations = conversations.filter(conv => 
    userRole === 'buyer' ? conv.buyerId === user?.id : conv.vendorId === user?.id
  );

  // Handle vendor param on mount - fetch vendor info and set up dialog
  useEffect(() => {
    if (vendorParam && user && userRole === 'buyer' && isHydrated) {
      // Check if conversation exists with this vendor (and optionally same product)
      const existingConv = productParam 
        ? userConversations.find(c => c.vendorId === vendorParam && c.productId === productParam)
        : userConversations.find(c => c.vendorId === vendorParam);
      if (existingConv) {
        setSelectedConversationId(existingConv.id);
      } else {
        // Fetch vendor info and show new conversation dialog
        setNewConversationVendorId(vendorParam);
        setIsLoadingVendor(true);
        
        // Fetch vendor details
        fetch(`/api/users/${vendorParam}`, { credentials: 'include' })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.user) {
              setNewConversationVendorName(data.user.businessName || data.user.name || 'Vendor');
            } else {
              setNewConversationVendorName('Vendor');
            }
          })
          .catch(() => setNewConversationVendorName('Vendor'))
          .finally(() => setIsLoadingVendor(false));
        
        // Fetch product info via API if provided and set initial message
        if (productParam) {
          fetch(`/api/products/${productParam}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              if (data?.product?.name) {
                setNewConversationProductName(data.product.name);
                setNewConversationMessage(`Hi, I'm interested in "${data.product.name}".\n/product/${productParam}`);
              }
            })
            .catch(err => console.error('Failed to fetch product:', err));
        }
        
        setShowNewConversation(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorParam, productParam, user, userRole, isHydrated]);

  // Handle conversation param from notification deep-link
  useEffect(() => {
    if (conversationParam && user && isHydrated && conversations.length > 0) {
      const targetConv = conversations.find(c => c.id === conversationParam);
      if (targetConv) {
        setSelectedConversationId(conversationParam);
      }
    }
  }, [conversationParam, user, isHydrated, conversations]);

  // Mark message notifications as read when visiting messages page
  useEffect(() => {
    if (user && isHydrated) {
      fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'message' }),
      }).catch(() => {});
    }
  }, [user, isHydrated]);

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (selectedConversationId) {
      fetchMessages(selectedConversationId);
      markConversationAsRead(selectedConversationId);
    }
  }, [selectedConversationId, fetchMessages, markConversationAsRead]);
  
  // Scroll to bottom when messages change (within container only)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, selectedConversationId]);

  // Filter conversations
  const filteredConversations = userConversations.filter(conv => {
    const searchLower = searchQuery.toLowerCase();
    const participantName = userRole === 'buyer' ? conv.vendorName : conv.buyerName;
    return (
      participantName.toLowerCase().includes(searchLower) ||
      (conv.productName?.toLowerCase().includes(searchLower)) ||
      (conv.lastMessageContent?.toLowerCase().includes(searchLower))
    );
  });

  const selectedConversation = userConversations.find(c => c.id === selectedConversationId);
  const conversationMessages = selectedConversationId ? (messages[selectedConversationId] || []) : [];

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || !user) return;

    setIsSending(true);
    try {
      const result = await sendMessage(selectedConversation.id, messageInput.trim(), 'text');
      if (result) {
        setMessageInput("");
      } else {
        toast.error("Failed to send message");
      }
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleCreateConversation = async () => {
    if (!newConversationVendorId || !newConversationMessage.trim() || !user) {
      toast.error("Please select a vendor and enter a message");
      return;
    }

    setIsCreatingConversation(true);
    try {
      // Create conversation via API - use productParam directly
      const conv = await createConversation({
        vendorId: newConversationVendorId,
        productId: productParam || undefined,
        context: productParam ? 'product_inquiry' : 'general',
      });

      if (!conv) {
        // Store already shows error toast, don't duplicate
        return;
      }

      // Send first message
      const message = await sendMessage(conv.id, newConversationMessage.trim(), 'text');
      if (!message) {
        toast.error("Conversation created but failed to send message");
      }

      setSelectedConversationId(conv.id);
      setShowNewConversation(false);
      setNewConversationVendorId("");
      setNewConversationMessage("");
      toast.success("Conversation started!");
    } catch {
      // Store already shows error toast, don't duplicate
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const togglePin = async (conv: Conversation) => {
    const isPinned = userRole === 'buyer' ? conv.isPinnedBuyer : conv.isPinnedVendor;
    await updateConversationSettings(conv.id, { isPinned: !isPinned });
    toast.success(isPinned ? "Conversation unpinned" : "Conversation pinned");
    fetchConversations();
  };

  const toggleMute = async (conv: Conversation) => {
    const isMuted = userRole === 'buyer' ? conv.isMutedBuyer : conv.isMutedVendor;
    await updateConversationSettings(conv.id, { isMuted: !isMuted });
    toast.success(isMuted ? "Notifications enabled" : "Notifications muted");
    fetchConversations();
  };

  const handleArchive = async (conv: Conversation) => {
    if (!user) return;
    await archiveConversation(conv.id);
    if (selectedConversationId === conv.id) {
      setSelectedConversationId(null);
    }
    toast.success("Conversation archived");
    fetchConversations();
  };

  const handleClose = async (conv: Conversation) => {
    if (!user) return;
    try {
      const response = await fetch(`/api/messaging/conversations/${conv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'close' }),
      });
      if (response.ok) {
        if (selectedConversationId === conv.id) {
          setSelectedConversationId(null);
        }
        toast.success("Conversation closed");
        fetchConversations();
      } else {
        toast.error("Failed to close conversation");
      }
    } catch {
      toast.error("Failed to close conversation");
    }
  };

  const handleFileUpload = async (file: File, type: 'image' | 'file') => {
    if (!selectedConversation || !user) return;
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }
    
    // Validate file type for images
    if (type === 'image' && !file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('directory', 'messages');
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }
      
      const data = await response.json();
      const attachmentUrl = data.file?.url || '';
      
      // Send message with attachment - include URL in content for display
      const messageContent = type === 'image' 
        ? `📷 Image: ${file.name}\n${attachmentUrl}` 
        : `📎 File: ${file.name}\n${attachmentUrl}`;
      
      const result = await sendMessage(
        selectedConversation.id, 
        messageContent, 
        type
      );
      
      if (result) {
        toast.success(`${type === 'image' ? 'Image' : 'File'} sent`);
      } else {
        toast.error("Failed to send attachment");
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to upload file");
    } finally {
      setIsUploading(false);
      // Reset file inputs
      if (imageInputRef.current) imageInputRef.current.value = '';
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleOpenProductPicker = async () => {
    if (!user || userRole !== 'vendor') return;
    
    setIsLoadingProducts(true);
    setShowProductPicker(true);
    
    try {
      const response = await fetch(`/api/products?vendorId=${user.id}&status=active`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setVendorProducts(data.products || []);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      toast.error('Failed to load products');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const handleShareProduct = async (product: {id: string; name: string; price: number; image?: string}) => {
    if (!selectedConversation || !user) return;
    
    setIsSending(true);
    try {
      const productLink = `/product/${product.id}`;
      const messageContent = `🛍️ Check out this product:\n\n**${product.name}**\nPrice: GHS ${product.price.toLocaleString()}\n${productLink}`;
      
      const result = await sendMessage(selectedConversation.id, messageContent, 'text');
      if (result) {
        toast.success('Product shared');
        setShowProductPicker(false);
      } else {
        toast.error('Failed to share product');
      }
    } catch (error) {
      toast.error('Failed to share product');
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return format(date, 'h:mm a');
    } else if (diffDays < 7) {
      return format(date, 'EEE');
    } else {
      return format(date, 'MMM d');
    }
  };

  const getUnreadCountForConv = (conv: Conversation) => {
    return userRole === 'buyer' ? conv.unreadCountBuyer : conv.unreadCountVendor;
  };

  const isMuted = (conv: Conversation) => {
    return userRole === 'buyer' ? conv.isMutedBuyer : conv.isMutedVendor;
  };

  const getParticipantName = (conv: Conversation) => {
    return userRole === 'buyer'
      ? (conv.vendorBusinessName || conv.vendorName)
      : conv.buyerName;
  };

  const getParticipantAvatar = (conv: Conversation) => {
    return userRole === 'buyer' ? conv.vendorAvatar : conv.buyerAvatar;
  };

  const renderMessageContent = (content: string, messageType?: string, isOwnMessage?: boolean) => {
    if (messageType === 'image' || content.startsWith('📷 Image:')) {
      const lines = content.split('\n');
      const urlLine = lines.find(line => line.startsWith('/uploads/') || line.includes('/uploads/'));
      if (urlLine) {
        const imageUrl = urlLine.trim();
        return (
          <div className="space-y-1">
            <a href={imageUrl} target="_blank" rel="noopener noreferrer">
              <img 
                src={imageUrl} 
                alt="Shared image" 
                className="max-w-[250px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
              />
            </a>
          </div>
        );
      }
    }
    
    if (messageType === 'file' || content.startsWith('📎 File:')) {
      const lines = content.split('\n');
      const fileNameLine = lines.find(line => line.startsWith('📎 File:'));
      const urlLine = lines.find(line => line.startsWith('/uploads/') || line.includes('/uploads/'));
      if (urlLine) {
        const fileName = fileNameLine?.replace('📎 File:', '').trim() || 'Download file';
        return (
          <a 
            href={urlLine.trim()} 
            target="_blank" 
            rel="noopener noreferrer"
            className={`flex items-center gap-2 ${isOwnMessage ? 'text-white hover:text-green-100' : 'text-green-600 hover:text-green-700'} underline`}
          >
            <Paperclip className="w-4 h-4" />
            <span className="text-sm">{fileName}</span>
          </a>
        );
      }
    }
    
    // Parse product links in text messages (format: /product/[id])
    const productLinkPattern = /\/product\/[a-zA-Z0-9_-]+/;
    if (productLinkPattern.test(content)) {
      const parts = content.split(/(\/product\/[a-zA-Z0-9_-]+)/);
      return (
        <p className="text-sm whitespace-pre-wrap">
          {parts.map((part, index) => {
            if (productLinkPattern.test(part)) {
              return (
                <a
                  key={index}
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`underline ${isOwnMessage ? 'text-green-100 hover:text-white' : 'text-green-600 hover:text-green-700'}`}
                >
                  View Product
                </a>
              );
            }
            return <span key={index}>{part}</span>;
          })}
        </p>
      );
    }
    
    return <p className="text-sm whitespace-pre-wrap">{content}</p>;
  };

  // Wait for hydration before showing auth-dependent content
  if (!isHydrated) {
    return (
      <SiteLayout>
        <div className="container py-8">
          <div className="flex h-[calc(100vh-200px)] items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <SiteLayout>
        <div className="container py-8">
          <div className="text-center py-12">
            <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Sign in to view messages</h2>
            <p className="text-muted-foreground mb-4">
              You need to be logged in to access your messages
            </p>
            <Button onClick={() => router.push('/auth/login')}>Sign In</Button>
          </div>
        </div>
      </SiteLayout>
    );
  }

  const totalUnread = unreadCount;

  return (
    <SiteLayout>
      <div className="container py-8">
        <div className="flex h-[calc(100vh-200px)] bg-white rounded-lg border overflow-hidden">
          {/* Conversations Sidebar */}
          <div className="w-80 border-r flex flex-col">
            {/* Header */}
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Messages
                  {totalUnread > 0 && (
                    <Badge className="ml-2">{totalUnread}</Badge>
                  )}
                </h2>
                <div className="flex gap-2">
                  {userRole === 'buyer' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNewConversation(true)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Conversations List */}
            <ScrollArea className="flex-1">
              <div className="p-2">
                {filteredConversations.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">
                      {searchQuery ? "No conversations found" : "No conversations yet"}
                    </p>
                    {userRole === 'buyer' && !searchQuery && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setShowNewConversation(true)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Start Conversation
                      </Button>
                    )}
                  </div>
                ) : (
                  filteredConversations.map((conv) => {
                    const unreadCount = getUnreadCountForConv(conv);
                    const convIsMuted = isMuted(conv);

                    return (
                      <div
                        key={conv.id}
                        onClick={() => setSelectedConversationId(conv.id)}
                        className={`group p-3 rounded-lg cursor-pointer transition-colors relative ${
                          selectedConversationId === conv.id
                            ? "bg-green-50 border border-green-200"
                            : "hover:bg-gray-50"
                        } ${conv.status === 'archived' ? 'opacity-60' : ''}`}
                      >
                        {/* Pin indicator */}
                        {(userRole === 'buyer' ? conv.isPinnedBuyer : conv.isPinnedVendor) && (
                          <div className="absolute top-2 left-2 w-2 h-2 bg-blue-500 rounded-full" />
                        )}

                        {/* Conversation actions - placed as direct child of group for absolute positioning */}
                        <div className="absolute top-2 right-2 z-10">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); togglePin(conv); }}>
                                {(userRole === 'buyer' ? conv.isPinnedBuyer : conv.isPinnedVendor) ? "Unpin" : "Pin"} Conversation
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toggleMute(conv); }}>
                                {convIsMuted ? <Volume2 className="w-4 h-4 mr-2" /> : <VolumeX className="w-4 h-4 mr-2" />}
                                {convIsMuted ? "Unmute" : "Mute"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchive(conv); }}>
                                <Archive className="w-4 h-4 mr-2" />
                                Archive
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleClose(conv); }}>
                                <XCircle className="w-4 h-4 mr-2" />
                                Close Conversation
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600">
                                <Flag className="w-4 h-4 mr-2" />
                                Report
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="relative">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={getParticipantAvatar(conv)} />
                              <AvatarFallback>
                                <User className="w-4 h-4" />
                              </AvatarFallback>
                            </Avatar>
                          </div>

                          <div className="flex-1 min-w-0 pr-6">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">
                                  {getParticipantName(conv)}
                                </span>
                                {convIsMuted && (
                                  <BellOff className="w-3 h-3 text-gray-400" />
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500">
                                  {conv.lastMessageAt ? formatTime(conv.lastMessageAt) : ""}
                                </span>
                                {unreadCount > 0 && (
                                  <Badge className="w-5 h-5 rounded-full p-0 flex items-center justify-center text-xs">
                                    {unreadCount}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <p className="text-sm text-gray-600 truncate mb-1">
                              {conv.lastMessageContent || "No messages yet"}
                            </p>

                            {conv.productName && (
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Package className="w-3 h-3" />
                                <span className="truncate">{conv.productName}</span>
                              </div>
                            )}

                            {conv.orderNumber && (
                              <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                                <Calendar className="w-3 h-3" />
                                <span>Order: {conv.orderNumber}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={getParticipantAvatar(selectedConversation)} />
                      <AvatarFallback>
                        <User className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      {userRole === 'buyer' ? (
                        <Link 
                          href={`/vendor/${selectedConversation.vendorId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold hover:text-green-600 hover:underline flex items-center gap-1"
                        >
                          {getParticipantName(selectedConversation)}
                          <ExternalLink className="w-3 h-3 opacity-50" />
                        </Link>
                      ) : (
                        <span className="font-semibold">
                          {getParticipantName(selectedConversation)}
                        </span>
                      )}
                      {selectedConversation.productName && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Package className="w-3 h-3" />
                          {selectedConversation.productId ? (
                            <Link 
                              href={`/product/${selectedConversation.productId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-green-600 hover:underline"
                            >
                              {selectedConversation.productName}
                            </Link>
                          ) : (
                            selectedConversation.productName
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {selectedConversation.context.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {conversationMessages.length === 0 ? (
                      <div className="text-center py-12">
                        <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500">No messages yet</p>
                        <p className="text-sm text-muted-foreground">Send a message to start the conversation</p>
                      </div>
                    ) : (
                      conversationMessages.map((msg) => {
                        const isOwnMessage = msg.senderId === user.id;

                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`flex items-end gap-2 max-w-[70%] ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                              {!isOwnMessage && (
                                <Avatar className="w-8 h-8">
                                  <AvatarImage src={msg.senderAvatar} />
                                  <AvatarFallback>
                                    <User className="w-3 h-3" />
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              <div>
                                <div
                                  className={`px-4 py-2 rounded-2xl ${
                                    isOwnMessage
                                      ? 'bg-green-600 text-white rounded-br-sm'
                                      : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                                  }`}
                                >
                                  {renderMessageContent(msg.content, msg.messageType, isOwnMessage)}
                                </div>
                                <div className={`flex items-center gap-1 mt-1 text-xs text-muted-foreground ${isOwnMessage ? 'justify-end' : ''}`}>
                                  <span>{format(new Date(msg.createdAt), 'h:mm a')}</span>
                                  {isOwnMessage && (
                                    msg.isRead ? (
                                      <CheckCheck className="w-3 h-3 text-blue-500" />
                                    ) : (
                                      <Check className="w-3 h-3" />
                                    )
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Message Input */}
                <div className="p-4 border-t">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                      <Textarea
                        placeholder="Type a message..."
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        className="min-h-[44px] max-h-[120px] resize-none pr-20"
                        rows={1}
                      />
                      <div className="absolute right-2 bottom-2 flex items-center gap-1">
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.txt"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, 'file');
                          }}
                        />
                        <input
                          type="file"
                          ref={imageInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, 'image');
                          }}
                        />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          title="Attach file"
                        >
                          {isUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Paperclip className="w-4 h-4" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={() => imageInputRef.current?.click()}
                          disabled={isUploading}
                          title="Attach image"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </Button>
                        {userRole === 'vendor' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={handleOpenProductPicker}
                            disabled={isSending}
                            title="Share product"
                          >
                            <ShoppingBag className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || isSending}
                      className="h-11"
                    >
                      {isSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
                  <p className="text-gray-500 mb-4">
                    Choose a conversation from the sidebar to view messages
                  </p>
                  {userRole === 'buyer' && (
                    <Button variant="outline" onClick={() => setShowNewConversation(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Start New Conversation
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* New Conversation Dialog */}
        <Dialog open={showNewConversation} onOpenChange={(open) => {
          setShowNewConversation(open);
          if (!open) {
            // Reset state when dialog closes
            setNewConversationVendorId("");
            setNewConversationVendorName("");
            setNewConversationProductName("");
            setNewConversationMessage("");
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Message {newConversationVendorName || 'Vendor'}</DialogTitle>
              <DialogDescription>
                Start a conversation with this vendor
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Vendor Info - Read Only */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Vendor</label>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback>
                      <Store className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    {isLoadingVendor ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Loading...</span>
                      </div>
                    ) : (
                      <span className="font-medium">{newConversationVendorName || 'Vendor'}</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Product Reference (if any) */}
              {newConversationProductName && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Regarding</label>
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-700">{newConversationProductName}</span>
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Message</label>
                <Textarea
                  placeholder="Write your message..."
                  value={newConversationMessage}
                  onChange={(e) => setNewConversationMessage(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewConversation(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateConversation}
                disabled={!newConversationVendorId || !newConversationMessage.trim() || isCreatingConversation}
              >
                {isCreatingConversation ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Message
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Product Picker Dialog for Vendors */}
        <Dialog open={showProductPicker} onOpenChange={setShowProductPicker}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                Share a Product
              </DialogTitle>
              <DialogDescription>
                Select a product to share with this buyer
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {isLoadingProducts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : vendorProducts.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No products available</p>
                  <p className="text-sm text-muted-foreground">Add products to your store first</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-2">
                    {vendorProducts.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => handleShareProduct(product)}
                        disabled={isSending}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
                      >
                        {product.image ? (
                          <img 
                            src={product.image} 
                            alt={product.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{product.name}</p>
                          <p className="text-sm text-green-600">GHS {product.price.toLocaleString()}</p>
                        </div>
                        <Send className="w-4 h-4 text-gray-400" />
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SiteLayout>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="container py-8">
        <div className="flex h-[calc(100vh-200px)] bg-white rounded-lg border overflow-hidden">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-lg text-gray-600">Loading messages...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <MessagesPageContent />
    </Suspense>
  );
}
