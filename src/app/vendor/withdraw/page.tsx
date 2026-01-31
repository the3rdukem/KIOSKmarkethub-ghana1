"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getCsrfHeaders } from "@/lib/utils/csrf-client";
import {
  ArrowLeft,
  Smartphone,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Wallet,
  Loader2,
  XCircle,
  Building,
  Phone,
  Info,
  Percent,
  Plus,
  Trash2,
  Star,
  RefreshCw
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { formatDistance } from "date-fns";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/currency";

const PAYOUT_MINIMUM = 50;

interface BankAccount {
  id: string;
  account_type: 'bank' | 'mobile_money';
  bank_code?: string;
  bank_name?: string;
  account_number: string;
  account_name: string;
  mobile_money_provider?: string;
  is_primary: boolean;
  is_verified: boolean;
  paystack_recipient_code?: string;
}

interface VendorBalance {
  total_earnings: number;
  pending_earnings: number;
  available_balance: number;
  total_withdrawn: number;
  pending_withdrawals: number;
}

interface Payout {
  id: string;
  reference: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  bank_account_name: string;
  bank_name?: string;
  mobile_money_provider?: string;
  created_at: string;
  processed_at?: string;
  failure_reason?: string;
}

interface Bank {
  name: string;
  code: string;
}

export default function VendorWithdrawPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("withdraw");

  // Data state
  const [balance, setBalance] = useState<VendorBalance | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);

  // Withdrawal form state
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Add bank account form state
  const [showAddAccountDialog, setShowAddAccountDialog] = useState(false);
  const [newAccountType, setNewAccountType] = useState<'bank' | 'mobile_money'>('mobile_money');
  const [newBankCode, setNewBankCode] = useState("");
  const [newAccountNumber, setNewAccountNumber] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newMomoProvider, setNewMomoProvider] = useState("");
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  // Commission summary
  const [commissionData, setCommissionData] = useState<{
    grossSales: number;
    commission: number;
    commissionRate: number;
    commissionSource: 'vendor' | 'category' | 'default';
  } | null>(null);

  // Phone verification status
  const [isPhoneVerified, setIsPhoneVerified] = useState<boolean | null>(null);

  // OTP verification for adding payout accounts
  const [showOTPDialog, setShowOTPDialog] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [payoutToken, setPayoutToken] = useState<string | null>(null);
  const [isRequestingOTP, setIsRequestingOTP] = useState(false);
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpError, setOtpError] = useState("");

  const mobileProviders = [
    { code: 'MTN', name: 'MTN Mobile Money', prefix: '024/054/055/059' },
    { code: 'VOD', name: 'Vodafone/Telecel Cash', prefix: '020/050' },
    { code: 'ATL', name: 'AirtelTigo Money', prefix: '026/027/056/057' },
  ];

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const [payoutsRes, accountsRes, banksRes, statsRes, profileRes] = await Promise.all([
        fetch('/api/vendor/payouts', { credentials: 'include' }),
        fetch('/api/vendor/bank-accounts', { credentials: 'include' }),
        fetch('/api/vendor/banks', { credentials: 'include' }),
        fetch('/api/vendor/stats', { credentials: 'include' }),
        fetch('/api/vendor/profile', { credentials: 'include' }),
      ]);

      if (payoutsRes.ok) {
        const data = await payoutsRes.json();
        setBalance(data.balance);
        setPayouts(data.payouts || []);
        if (data.primary_account) {
          setSelectedAccountId(data.primary_account.id);
        }
      }

      if (accountsRes.ok) {
        const data = await accountsRes.json();
        setBankAccounts(data.accounts || []);
        // Auto-select primary account
        const primary = data.accounts?.find((a: BankAccount) => a.is_primary);
        if (primary && !selectedAccountId) {
          setSelectedAccountId(primary.id);
        }
      }

      if (banksRes.ok) {
        const data = await banksRes.json();
        setBanks(data.banks || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        if (data.earnings) {
          setCommissionData({
            grossSales: data.earnings.grossSales || 0,
            commission: data.earnings.commission || 0,
            commissionRate: data.earnings.commissionRate || 0.08,
            commissionSource: data.earnings.commissionSource || 'default'
          });
        }
      }

      if (profileRes.ok) {
        const data = await profileRes.json();
        setIsPhoneVerified(data.phoneVerified ?? false);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load payout data');
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedAccountId]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/auth/login");
    }
    if (isHydrated && user && user.role !== "vendor") {
      router.push("/");
    }
  }, [isHydrated, isAuthenticated, user, router]);

  useEffect(() => {
    if (isHydrated && user) {
      fetchData();
    }
  }, [isHydrated, user, fetchData]);

  if (!isHydrated || isLoading) {
    return (
      <SiteLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </SiteLayout>
    );
  }

  if (!isAuthenticated || !user || user.role !== "vendor") {
    return null;
  }

  const selectedAccount = bankAccounts.find(a => a.id === selectedAccountId);
  const availableBalance = balance?.available_balance || 0;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const amount = parseFloat(withdrawAmount);

    if (!withdrawAmount || isNaN(amount)) {
      newErrors.amount = "Please enter a valid amount";
    } else if (amount < PAYOUT_MINIMUM) {
      newErrors.amount = `Minimum withdrawal is ${formatCurrency(PAYOUT_MINIMUM)}`;
    } else if (amount > availableBalance) {
      newErrors.amount = "Insufficient balance";
    }

    if (!selectedAccountId) {
      newErrors.account = "Please select a payout account";
    }

    if (selectedAccount && !selectedAccount.paystack_recipient_code) {
      newErrors.account = "This account needs to be verified first";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleWithdrawRequest = () => {
    if (!validateForm()) return;
    setConfirmDialogOpen(true);
  };

  const confirmWithdraw = async () => {
    setIsProcessing(true);

    try {
      const amount = parseFloat(withdrawAmount);
      const response = await fetch('/api/vendor/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          amount,
          bank_account_id: selectedAccountId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit withdrawal');
      }

      toast.success(`Withdrawal request submitted! Reference: ${data.payout?.reference || 'PENDING'}`);
      setWithdrawAmount("");
      setConfirmDialogOpen(false);
      setActiveTab("history");
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process withdrawal");
    } finally {
      setIsProcessing(false);
    }
  };

  // OTP verification flow for payout accounts
  const handleRequestOTP = async () => {
    setIsRequestingOTP(true);
    setOtpError("");

    try {
      const response = await fetch('/api/vendor/payouts/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        credentials: 'include',
        body: JSON.stringify({ purpose: 'payout_account' }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'OTP_COOLDOWN') {
          setOtpCooldown(data.cooldownRemaining || 60);
        }
        throw new Error(data.error || 'Failed to send verification code');
      }

      toast.success(data.message || 'Verification code sent!');
      setShowOTPDialog(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send verification code");
    } finally {
      setIsRequestingOTP(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setOtpError("Please enter a 6-digit code");
      return;
    }

    setIsVerifyingOTP(true);
    setOtpError("");

    try {
      const response = await fetch('/api/vendor/payouts/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        credentials: 'include',
        body: JSON.stringify({ otp: otpCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        setOtpError(data.error || 'Invalid verification code');
        return;
      }

      setPayoutToken(data.payoutToken);
      setShowOTPDialog(false);
      setOtpCode("");
      toast.success('Verified! You can now add your payout account.');
      setShowAddAccountDialog(true);
    } catch (error) {
      setOtpError("Verification failed. Please try again.");
    } finally {
      setIsVerifyingOTP(false);
    }
  };

  // Countdown for OTP cooldown
  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCooldown]);

  const handleAddAccount = async () => {
    // Check if we have a valid payout token
    if (!payoutToken) {
      toast.error('Please verify with OTP first');
      handleRequestOTP();
      return;
    }

    setIsAddingAccount(true);

    try {
      const body: Record<string, unknown> = {
        account_type: newAccountType,
        account_number: newAccountNumber,
        account_name: newAccountName,
        payoutToken,
      };

      if (newAccountType === 'bank') {
        const selectedBank = banks.find(b => b.code === newBankCode);
        body.bank_code = newBankCode;
        body.bank_name = selectedBank?.name;
      } else {
        body.mobile_money_provider = newMomoProvider;
      }

      const response = await fetch('/api/vendor/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'PHONE_NOT_VERIFIED') {
          toast.error('Phone verification required. Please verify your phone number in your profile settings.');
          setShowAddAccountDialog(false);
          return;
        }
        if (data.code === 'OTP_REQUIRED' || data.code === 'INVALID_TOKEN' || data.code === 'TOKEN_EXPIRED') {
          toast.error('Verification expired. Please verify again.');
          setPayoutToken(null);
          setShowAddAccountDialog(false);
          handleRequestOTP();
          return;
        }
        throw new Error(data.error || 'Failed to add account');
      }

      toast.success('Account added successfully');
      setShowAddAccountDialog(false);
      setNewAccountNumber("");
      setNewAccountName("");
      setNewBankCode("");
      setNewMomoProvider("");
      setPayoutToken(null);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add account");
    } finally {
      setIsAddingAccount(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm("Are you sure you want to remove this payout account?")) return;

    try {
      const response = await fetch(`/api/vendor/bank-accounts?id=${accountId}`, {
        method: 'DELETE',
        headers: getCsrfHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      toast.success('Account removed');
      fetchData();
    } catch (error) {
      toast.error("Failed to remove account");
    }
  };

  const handleSetPrimary = async (accountId: string) => {
    try {
      const response = await fetch('/api/vendor/bank-accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          account_id: accountId,
          action: 'set_primary',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to set primary account');
      }

      toast.success('Primary account updated');
      fetchData();
    } catch (error) {
      toast.error("Failed to update primary account");
    }
  };

  const handleVerifyAccount = async (accountId: string) => {
    try {
      const response = await fetch('/api/vendor/bank-accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          account_id: accountId,
          action: 'verify',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify account');
      }

      toast.success('Account verified and ready for payouts');
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to verify account");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "processing":
        return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      case "reversed":
        return <Badge className="bg-orange-100 text-orange-800">Reversed</Badge>;
      case "cancelled":
        return <Badge className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <SiteLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
              <Link href="/vendor">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Dashboard
              </Link>
            </Button>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Withdraw Earnings</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Request payouts to your bank or mobile money</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchData()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Commission Summary Card */}
        {commissionData && commissionData.grossSales > 0 && (
          <Card className="mb-6 border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Percent className="w-4 h-4" />
                  Earnings Summary
                </CardTitle>
                <Badge 
                  variant="outline" 
                  className={
                    commissionData.commissionSource === 'vendor' 
                      ? 'text-purple-600 border-purple-600' 
                      : commissionData.commissionSource === 'category'
                      ? 'text-blue-600 border-blue-600'
                      : 'text-gray-600 border-gray-600'
                  }
                >
                  {commissionData.commissionSource === 'vendor' 
                    ? `Custom Rate: ${(commissionData.commissionRate * 100).toFixed(0)}%`
                    : commissionData.commissionSource === 'category'
                    ? `Category Rate: ${(commissionData.commissionRate * 100).toFixed(0)}%`
                    : `Platform Rate: ${(commissionData.commissionRate * 100).toFixed(0)}%`
                  }
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Gross Sales</p>
                  <p className="text-lg font-bold">{formatCurrency(commissionData.grossSales)}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <p className="text-xs text-muted-foreground">Platform Fee ({(commissionData.commissionRate * 100).toFixed(0)}%)</p>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">Covers payment processing, buyer protection, and marketplace services.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-lg font-bold text-red-600">- {formatCurrency(commissionData.commission)}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Your Earnings</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(commissionData.grossSales - commissionData.commission)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Balance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Earnings</p>
                  <p className="text-2xl font-bold">{formatCurrency(balance?.total_earnings || 0)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Available Balance</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(availableBalance)}</p>
                </div>
                <Wallet className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending (48h Hold)</p>
                  <p className="text-2xl font-bold text-orange-600">{formatCurrency(balance?.pending_earnings || 0)}</p>
                </div>
                <Clock className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Withdrawn</p>
                  <p className="text-2xl font-bold">{formatCurrency(balance?.total_withdrawn || 0)}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="withdraw">Request Withdrawal</TabsTrigger>
            <TabsTrigger value="accounts">Payout Accounts</TabsTrigger>
            <TabsTrigger value="history">Payout History</TabsTrigger>
          </TabsList>

          <TabsContent value="withdraw" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Withdrawal Request</CardTitle>
                    <CardDescription>
                      Enter the amount and select your payout account
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {bankAccounts.length === 0 ? (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          You need to add a payout account before you can withdraw. 
                          <Button variant="link" className="px-1" onClick={() => setActiveTab("accounts")}>
                            Add account
                          </Button>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <>
                        {/* Amount */}
                        <div>
                          <Label htmlFor="amount">Amount (GHS)</Label>
                          <div className="relative mt-1">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                              id="amount"
                              type="number"
                              value={withdrawAmount}
                              onChange={(e) => {
                                setWithdrawAmount(e.target.value);
                                setErrors({});
                              }}
                              placeholder="0.00"
                              className={`pl-10 text-lg ${errors.amount ? "border-red-500" : ""}`}
                              min={PAYOUT_MINIMUM}
                              max={availableBalance}
                            />
                          </div>
                          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
                          <p className="text-xs text-muted-foreground mt-1">
                            Minimum: {formatCurrency(PAYOUT_MINIMUM)} | Available: {formatCurrency(availableBalance)}
                          </p>
                        </div>

                        <Separator />

                        {/* Select Account */}
                        <div>
                          <Label>Payout Account</Label>
                          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                            <SelectTrigger className={errors.account ? "border-red-500" : ""}>
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                              {bankAccounts.filter(a => a.paystack_recipient_code).map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  <div className="flex items-center gap-2">
                                    {account.account_type === 'mobile_money' ? (
                                      <Smartphone className="w-4 h-4" />
                                    ) : (
                                      <Building className="w-4 h-4" />
                                    )}
                                    <span>
                                      {account.account_name} - {account.account_number}
                                      {account.is_primary && " (Primary)"}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errors.account && <p className="text-red-500 text-xs mt-1">{errors.account}</p>}
                          {bankAccounts.filter(a => a.paystack_recipient_code).length === 0 && (
                            <p className="text-amber-600 text-xs mt-1">
                              No verified accounts. Please verify your accounts in the "Payout Accounts" tab.
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Summary Sidebar */}
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Withdrawal Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span>{formatCurrency(parseFloat(withdrawAmount) || 0)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>You'll Receive</span>
                      <span className="text-green-600">{formatCurrency(parseFloat(withdrawAmount) || 0)}</span>
                    </div>

                    <Button
                      onClick={handleWithdrawRequest}
                      className="w-full mt-4"
                      disabled={!withdrawAmount || parseFloat(withdrawAmount) < PAYOUT_MINIMUM || isProcessing || bankAccounts.length === 0}
                    >
                      Request Withdrawal
                    </Button>

                    <Alert>
                      <Clock className="h-4 w-4" />
                      <AlertDescription>
                        Payouts are processed within 24-48 hours
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="accounts" className="mt-6">
            {/* Phone Verification Warning */}
            {isPhoneVerified === false && (
              <Alert className="mb-4 border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  <strong>Phone verification required:</strong> You must verify your phone number before adding payout accounts.{" "}
                  <Link href="/vendor/profile" className="underline font-medium hover:text-amber-900">
                    Verify your phone in Profile Settings
                  </Link>
                </AlertDescription>
              </Alert>
            )}
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Payout Accounts</CardTitle>
                  <CardDescription>Manage your bank and mobile money accounts</CardDescription>
                </div>
                <Button 
                  onClick={() => payoutToken ? setShowAddAccountDialog(true) : handleRequestOTP()}
                  disabled={isPhoneVerified === false || isRequestingOTP}
                >
                  {isRequestingOTP ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Add Account
                </Button>
              </CardHeader>
              <CardContent>
                {bankAccounts.length === 0 ? (
                  <div className="text-center py-12">
                    <Building className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">No payout accounts added yet</p>
                    {isPhoneVerified === false ? (
                      <p className="text-sm text-amber-600">Verify your phone number to add payout accounts</p>
                    ) : (
                      <Button 
                        onClick={() => payoutToken ? setShowAddAccountDialog(true) : handleRequestOTP()}
                        disabled={isRequestingOTP}
                      >
                        {isRequestingOTP ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        Add Your First Account
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bankAccounts.map((account) => (
                      <div
                        key={account.id}
                        className={`flex items-center justify-between p-4 border rounded-lg ${
                          account.is_primary ? 'border-green-500 bg-green-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-gray-100 rounded-full">
                            {account.account_type === 'mobile_money' ? (
                              <Smartphone className="w-5 h-5" />
                            ) : (
                              <Building className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{account.account_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {account.account_type === 'mobile_money'
                                ? `${account.mobile_money_provider?.toUpperCase()} - ${account.account_number}`
                                : `${account.bank_name} - ${account.account_number}`
                              }
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {account.is_primary && (
                              <Badge className="bg-green-100 text-green-800">Primary</Badge>
                            )}
                            {account.paystack_recipient_code ? (
                              <Badge className="bg-blue-100 text-blue-800">Verified</Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800">Unverified</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!account.paystack_recipient_code && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleVerifyAccount(account.id)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Verify
                            </Button>
                          )}
                          {!account.is_primary && account.paystack_recipient_code && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetPrimary(account.id)}
                            >
                              <Star className="w-4 h-4 mr-1" />
                              Set Primary
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAccount(account.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Payout History</CardTitle>
                <CardDescription>Your withdrawal request history</CardDescription>
              </CardHeader>
              <CardContent>
                {payouts.length === 0 ? (
                  <div className="text-center py-12">
                    <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-muted-foreground">No payout requests yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payouts.map((payout) => (
                        <TableRow key={payout.id}>
                          <TableCell className="font-mono text-sm">
                            {payout.reference?.slice(-10).toUpperCase() || 'N/A'}
                          </TableCell>
                          <TableCell>{formatCurrency(payout.net_amount || 0)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {payout.mobile_money_provider ? (
                                <Smartphone className="w-4 h-4" />
                              ) : (
                                <Building className="w-4 h-4" />
                              )}
                              <span>{payout.bank_account_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(payout.status)}</TableCell>
                          <TableCell>
                            {formatDistance(new Date(payout.created_at), new Date(), { addSuffix: true })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* OTP Verification Dialog */}
        <Dialog open={showOTPDialog} onOpenChange={setShowOTPDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Verify Your Identity</DialogTitle>
              <DialogDescription>
                Enter the 6-digit code sent to your phone to add a payout account
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="otpCode">Verification Code</Label>
                <Input
                  id="otpCode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtpCode(value);
                    setOtpError("");
                  }}
                  placeholder="Enter 6-digit code"
                  className={`text-center text-2xl tracking-widest ${otpError ? 'border-red-500' : ''}`}
                />
                {otpError && <p className="text-sm text-red-500 mt-1">{otpError}</p>}
              </div>

              <div className="text-center text-sm text-muted-foreground">
                <p>
                  Didn&apos;t receive a code?{" "}
                  {otpCooldown > 0 ? (
                    <span className="text-gray-400">Resend in {otpCooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestOTP}
                      disabled={isRequestingOTP}
                      className="text-blue-600 hover:underline"
                    >
                      {isRequestingOTP ? "Sending..." : "Resend Code"}
                    </button>
                  )}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowOTPDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleVerifyOTP} 
                disabled={isVerifyingOTP || otpCode.length !== 6}
              >
                {isVerifyingOTP ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Account Dialog */}
        <Dialog open={showAddAccountDialog} onOpenChange={setShowAddAccountDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Payout Account</DialogTitle>
              <DialogDescription>
                Add a bank account or mobile money number for withdrawals
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Account Type</Label>
                <RadioGroup
                  value={newAccountType}
                  onValueChange={(v) => setNewAccountType(v as 'bank' | 'mobile_money')}
                  className="grid grid-cols-2 gap-4 mt-2"
                >
                  <div className={`flex items-center space-x-2 p-4 border rounded-lg cursor-pointer ${
                    newAccountType === "mobile_money" ? "border-green-500 bg-green-50" : ""
                  }`}>
                    <RadioGroupItem value="mobile_money" id="new_mobile_money" />
                    <Label htmlFor="new_mobile_money" className="flex items-center gap-2 cursor-pointer">
                      <Smartphone className="w-5 h-5 text-green-600" />
                      Mobile Money
                    </Label>
                  </div>
                  <div className={`flex items-center space-x-2 p-4 border rounded-lg cursor-pointer ${
                    newAccountType === "bank" ? "border-blue-500 bg-blue-50" : ""
                  }`}>
                    <RadioGroupItem value="bank" id="new_bank" />
                    <Label htmlFor="new_bank" className="flex items-center gap-2 cursor-pointer">
                      <Building className="w-5 h-5 text-blue-600" />
                      Bank Account
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {newAccountType === 'mobile_money' ? (
                <>
                  <div>
                    <Label>Mobile Money Provider</Label>
                    <Select value={newMomoProvider} onValueChange={setNewMomoProvider}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {mobileProviders.map((provider) => (
                          <SelectItem key={provider.code} value={provider.code}>
                            {provider.name} ({provider.prefix})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Phone Number</Label>
                    <div className="relative mt-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={newAccountNumber}
                        onChange={(e) => setNewAccountNumber(e.target.value)}
                        placeholder="0XX XXX XXXX"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label>Bank</Label>
                    <Select value={newBankCode} onValueChange={setNewBankCode}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bank" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks
                          .filter((bank, index, self) => 
                            index === self.findIndex(b => b.code === bank.code)
                          )
                          .map((bank) => (
                            <SelectItem key={bank.code} value={bank.code}>
                              {bank.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Account Number</Label>
                    <Input
                      value={newAccountNumber}
                      onChange={(e) => setNewAccountNumber(e.target.value)}
                      placeholder="Enter account number"
                    />
                  </div>
                </>
              )}

              <div>
                <Label>Account Holder Name</Label>
                <Input
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="Enter name as it appears on account"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddAccountDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddAccount}
                disabled={isAddingAccount || !newAccountNumber || !newAccountName || (newAccountType === 'bank' && !newBankCode) || (newAccountType === 'mobile_money' && !newMomoProvider)}
              >
                {isAddingAccount ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Account"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog */}
        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Withdrawal</DialogTitle>
              <DialogDescription>
                Please review your withdrawal details before confirming
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{formatCurrency(parseFloat(withdrawAmount) || 0)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">You'll Receive</span>
                <span className="font-bold text-green-600">{formatCurrency(parseFloat(withdrawAmount) || 0)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account</span>
                <span>{selectedAccount?.account_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {selectedAccount?.account_type === 'mobile_money' ? 'Phone' : 'Account'}
                </span>
                <span>{selectedAccount?.account_number}</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={confirmWithdraw} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Confirm Withdrawal"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SiteLayout>
  );
}
