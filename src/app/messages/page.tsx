"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
  ShoppingBag
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
  const [newConversationMessage, setNewConversationMessage] = useState("");
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Handle vendor param on mount
  useEffect(() => {
    if (vendorParam && user && userRole === 'buyer') {
      // Check if conversation exists with this vendor
      const existingConv = userConversations.find(c => c.vendorId === vendorParam);
      if (existingConv) {
        setSelectedConversationId(existingConv.id);
      } else {
        // Show new conversation dialog
        setNewConversationVendorId(vendorParam);
        setShowNewConversation(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorParam, user, userRole]);

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (selectedConversationId) {
      fetchMessages(selectedConversationId);
      markConversationAsRead(selectedConversationId);
    }
  }, [selectedConversationId, fetchMessages, markConversationAsRead]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

    // Get product info if provided
    const product = productParam ? getProductById(productParam) : undefined;

    setIsCreatingConversation(true);
    try {
      // Create conversation via API
      const conv = await createConversation({
        vendorId: newConversationVendorId,
        productId: product?.id,
        context: product ? 'product_inquiry' : 'general',
      });

      if (!conv) {
        toast.error("Failed to create conversation");
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
    } catch (error) {
      toast.error("Failed to start conversation");
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

  // Get vendors for new conversation
  const availableVendors = users.filter(u => u.role === 'vendor' && u.id !== user?.id);

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
                        className={`p-3 rounded-lg cursor-pointer transition-colors relative ${
                          selectedConversationId === conv.id
                            ? "bg-green-50 border border-green-200"
                            : "hover:bg-gray-50"
                        } ${conv.status === 'archived' ? 'opacity-60' : ''}`}
                      >
                        {/* Pin indicator */}
                        {(userRole === 'buyer' ? conv.isPinnedBuyer : conv.isPinnedVendor) && (
                          <div className="absolute top-2 left-2 w-2 h-2 bg-blue-500 rounded-full" />
                        )}

                        <div className="flex items-start gap-3">
                          <div className="relative">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={getParticipantAvatar(conv)} />
                              <AvatarFallback>
                                <User className="w-4 h-4" />
                              </AvatarFallback>
                            </Avatar>
                          </div>

                          <div className="flex-1 min-w-0">
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

                          {/* Conversation actions */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
                                <MoreHorizontal className="w-3 h-3" />
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
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600">
                                <Flag className="w-4 h-4 mr-2" />
                                Report
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
                      <h3 className="font-semibold">{getParticipantName(selectedConversation)}</h3>
                      {selectedConversation.productName && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Package className="w-3 h-3" />
                          {selectedConversation.productName}
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
                                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
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
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Paperclip className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <ImageIcon className="w-4 h-4" />
                        </Button>
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
        <Dialog open={showNewConversation} onOpenChange={setShowNewConversation}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start New Conversation</DialogTitle>
              <DialogDescription>
                Send a message to a vendor
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Vendor</label>
                <select
                  className="w-full p-2 border rounded-lg"
                  value={newConversationVendorId}
                  onChange={(e) => setNewConversationVendorId(e.target.value)}
                >
                  <option value="">Choose a vendor...</option>
                  {availableVendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.businessName || vendor.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
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
              <Button onClick={handleCreateConversation}>
                <Send className="w-4 h-4 mr-2" />
                Send Message
              </Button>
            </DialogFooter>
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
