"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  ArrowLeft,
  Smartphone,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Wallet,
  CreditCard,
  Loader2,
  XCircle,
  Building,
  Phone
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useOrdersStore } from "@/lib/orders-store";
import {
  usePayoutsStore,
  PAYOUT_MINIMUM,
  PAYOUT_FEE,
  getMobileMoneyProviders,
  getBanks,
  PayoutMethod
} from "@/lib/payouts-store";
import { formatDistance } from "date-fns";
import { toast } from "sonner";
import { OTPVerification } from "@/components/integrations/otp-verification";
import { useArkeselOTP } from "@/lib/integrations-store";

export default function VendorWithdrawPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { getOrderStats } = useOrdersStore();
  const {
    requestPayout,
    getPayoutsByVendor,
    getTransactionsByVendor,
    getVendorEarningsSummary,
    getAvailableBalance,
    addTransaction,
    cancelPayout
  } = usePayoutsStore();

  const [isHydrated, setIsHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState("withdraw");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("mobile_money");
  const [momoProvider, setMomoProvider] = useState("");
  const [momoNumber, setMomoNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { isEnabled: otpEnabled } = useArkeselOTP();

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

  // Initialize vendor earnings from orders if no transactions exist
  useEffect(() => {
    if (isHydrated && user) {
      const transactions = getTransactionsByVendor(user.id);
      if (transactions.length === 0) {
        // Calculate earnings from orders
        const orderStats = getOrderStats(user.id);
        if (orderStats.totalRevenue > 0) {
          addTransaction({
            vendorId: user.id,
            orderId: "initial",
            orderNumber: "INITIAL",
            type: "credit",
            amount: orderStats.totalRevenue,
            description: "Initial balance from completed orders",
          });
        }
      }
    }
    // Store functions are stable - intentionally not in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, user]);

  if (!isHydrated) {
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

  const earningsSummary = getVendorEarningsSummary(user.id);
  const availableBalance = getAvailableBalance(user.id);
  const payouts = getPayoutsByVendor(user.id);
  const transactions = getTransactionsByVendor(user.id);
  const mobileProviders = getMobileMoneyProviders();
  const banks = getBanks();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const amount = parseFloat(withdrawAmount);

    if (!withdrawAmount || isNaN(amount)) {
      newErrors.amount = "Please enter a valid amount";
    } else if (amount < PAYOUT_MINIMUM) {
      newErrors.amount = `Minimum withdrawal is GHS ${PAYOUT_MINIMUM}`;
    } else if (amount > availableBalance) {
      newErrors.amount = "Insufficient balance";
    }

    if (payoutMethod === "mobile_money") {
      if (!momoProvider) {
        newErrors.provider = "Please select a provider";
      }
      if (!momoNumber || momoNumber.length < 10) {
        newErrors.phone = "Please enter a valid phone number";
      }
    } else {
      if (!bankName) {
        newErrors.bank = "Please select a bank";
      }
      if (!accountNumber || accountNumber.length < 8) {
        newErrors.accountNumber = "Please enter a valid account number";
      }
      if (!accountName) {
        newErrors.accountName = "Please enter account holder name";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleWithdrawRequest = () => {
    if (!validateForm()) return;

    // If OTP is enabled and not verified, show OTP verification
    if (otpEnabled && !otpVerified) {
      setShowOTPVerification(true);
      return;
    }

    setConfirmDialogOpen(true);
  };

  const handleOTPVerified = () => {
    setOtpVerified(true);
    setShowOTPVerification(false);
    setConfirmDialogOpen(true);
  };

  const confirmWithdraw = async () => {
    setIsProcessing(true);

    try {
      const amount = parseFloat(withdrawAmount);
      const accountDetails = payoutMethod === "mobile_money"
        ? { provider: momoProvider, phoneNumber: momoNumber }
        : { bankName, accountNumber, accountName };

      const payout = requestPayout(user.id, amount, payoutMethod, accountDetails);

      toast.success(`Withdrawal request submitted! Reference: ${payout.id.slice(-8).toUpperCase()}`);

      // Reset form
      setWithdrawAmount("");
      setMomoNumber("");
      setAccountNumber("");
      setAccountName("");
      setConfirmDialogOpen(false);
      setOtpVerified(false);
      setActiveTab("history");
    } catch (error) {
      toast.error("Failed to process withdrawal request");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelPayout = (payoutId: string) => {
    if (confirm("Are you sure you want to cancel this payout request?")) {
      cancelPayout(payoutId);
      toast.success("Payout request cancelled");
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
      case "cancelled":
        return <Badge className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const fee = withdrawAmount ? parseFloat(withdrawAmount) * PAYOUT_FEE : 0;
  const netAmount = withdrawAmount ? parseFloat(withdrawAmount) - fee : 0;

  return (
    <SiteLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/vendor">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Dashboard
            </Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Withdraw Earnings</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Request payouts to mobile money or bank</p>
          </div>
        </div>

        {/* Balance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Earnings</p>
                  <p className="text-2xl font-bold">GHS {earningsSummary.totalEarnings.toLocaleString()}</p>
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
                  <p className="text-2xl font-bold text-green-600">GHS {availableBalance.toLocaleString()}</p>
                </div>
                <Wallet className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Payout</p>
                  <p className="text-2xl font-bold text-orange-600">GHS {earningsSummary.pendingPayout.toLocaleString()}</p>
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
                  <p className="text-2xl font-bold">GHS {earningsSummary.totalWithdrawn.toLocaleString()}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="withdraw">Request Withdrawal</TabsTrigger>
            <TabsTrigger value="history">Payout History</TabsTrigger>
            <TabsTrigger value="transactions">Transaction History</TabsTrigger>
          </TabsList>

          <TabsContent value="withdraw" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Withdrawal Request</CardTitle>
                    <CardDescription>
                      Enter the amount and select your preferred payout method
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
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
                        Minimum: GHS {PAYOUT_MINIMUM} | Available: GHS {availableBalance.toLocaleString()}
                      </p>
                    </div>

                    <Separator />

                    {/* Payout Method */}
                    <div>
                      <Label>Payout Method</Label>
                      <RadioGroup
                        value={payoutMethod}
                        onValueChange={(v) => setPayoutMethod(v as PayoutMethod)}
                        className="grid grid-cols-2 gap-4 mt-2"
                      >
                        <div className={`flex items-center space-x-2 p-4 border rounded-lg cursor-pointer ${
                          payoutMethod === "mobile_money" ? "border-green-500 bg-green-50" : ""
                        }`}>
                          <RadioGroupItem value="mobile_money" id="mobile_money" />
                          <Label htmlFor="mobile_money" className="flex items-center gap-2 cursor-pointer">
                            <Smartphone className="w-5 h-5 text-green-600" />
                            Mobile Money
                          </Label>
                        </div>
                        <div className={`flex items-center space-x-2 p-4 border rounded-lg cursor-pointer ${
                          payoutMethod === "bank_transfer" ? "border-blue-500 bg-blue-50" : ""
                        }`}>
                          <RadioGroupItem value="bank_transfer" id="bank_transfer" />
                          <Label htmlFor="bank_transfer" className="flex items-center gap-2 cursor-pointer">
                            <Building className="w-5 h-5 text-blue-600" />
                            Bank Transfer
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Mobile Money Details */}
                    {payoutMethod === "mobile_money" && (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="provider">Mobile Money Provider</Label>
                          <Select value={momoProvider} onValueChange={setMomoProvider}>
                            <SelectTrigger className={errors.provider ? "border-red-500" : ""}>
                              <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent>
                              {mobileProviders.map((provider) => (
                                <SelectItem key={provider.id} value={provider.id}>
                                  {provider.name} ({provider.prefix})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errors.provider && <p className="text-red-500 text-xs mt-1">{errors.provider}</p>}
                        </div>
                        <div>
                          <Label htmlFor="momoNumber">Phone Number</Label>
                          <div className="relative mt-1">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="momoNumber"
                              value={momoNumber}
                              onChange={(e) => setMomoNumber(e.target.value)}
                              placeholder="0XX XXX XXXX"
                              className={`pl-10 ${errors.phone ? "border-red-500" : ""}`}
                            />
                          </div>
                          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                        </div>
                      </div>
                    )}

                    {/* Bank Transfer Details */}
                    {payoutMethod === "bank_transfer" && (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="bank">Bank</Label>
                          <Select value={bankName} onValueChange={setBankName}>
                            <SelectTrigger className={errors.bank ? "border-red-500" : ""}>
                              <SelectValue placeholder="Select bank" />
                            </SelectTrigger>
                            <SelectContent>
                              {banks.map((bank) => (
                                <SelectItem key={bank.id} value={bank.name}>
                                  {bank.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errors.bank && <p className="text-red-500 text-xs mt-1">{errors.bank}</p>}
                        </div>
                        <div>
                          <Label htmlFor="accountNumber">Account Number</Label>
                          <Input
                            id="accountNumber"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            placeholder="Enter account number"
                            className={errors.accountNumber ? "border-red-500" : ""}
                          />
                          {errors.accountNumber && <p className="text-red-500 text-xs mt-1">{errors.accountNumber}</p>}
                        </div>
                        <div>
                          <Label htmlFor="accountName">Account Holder Name</Label>
                          <Input
                            id="accountName"
                            value={accountName}
                            onChange={(e) => setAccountName(e.target.value)}
                            placeholder="Enter name as it appears on account"
                            className={errors.accountName ? "border-red-500" : ""}
                          />
                          {errors.accountName && <p className="text-red-500 text-xs mt-1">{errors.accountName}</p>}
                        </div>
                      </div>
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
                      <span>GHS {withdrawAmount || "0.00"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fee ({(PAYOUT_FEE * 100).toFixed(0)}%)</span>
                      <span className="text-red-600">- GHS {fee.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>You'll Receive</span>
                      <span className="text-green-600">GHS {netAmount > 0 ? netAmount.toFixed(2) : "0.00"}</span>
                    </div>

                    <Button
                      onClick={handleWithdrawRequest}
                      className="w-full mt-4"
                      disabled={!withdrawAmount || parseFloat(withdrawAmount) < PAYOUT_MINIMUM || isProcessing}
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
                        <TableHead>Net Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payouts.map((payout) => (
                        <TableRow key={payout.id}>
                          <TableCell className="font-mono text-sm">
                            {payout.id.slice(-8).toUpperCase()}
                          </TableCell>
                          <TableCell>GHS {payout.amount.toLocaleString()}</TableCell>
                          <TableCell className="text-green-600">GHS {payout.netAmount.toLocaleString()}</TableCell>
                          <TableCell>
                            {payout.method === "mobile_money" ? (
                              <div className="flex items-center gap-1">
                                <Smartphone className="w-4 h-4" />
                                <span>{payout.accountDetails.provider}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Building className="w-4 h-4" />
                                <span>{payout.accountDetails.bankName}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(payout.status)}</TableCell>
                          <TableCell>
                            {formatDistance(new Date(payout.requestedAt), new Date(), { addSuffix: true })}
                          </TableCell>
                          <TableCell>
                            {payout.status === "pending" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelPayout(payout.id)}
                              >
                                <XCircle className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>All earnings and withdrawals</CardDescription>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-muted-foreground">No transactions yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell>
                            {new Date(txn.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{txn.description}</TableCell>
                          <TableCell>
                            <Badge variant={txn.type === "credit" ? "default" : "secondary"}>
                              {txn.type}
                            </Badge>
                          </TableCell>
                          <TableCell className={txn.amount >= 0 ? "text-green-600" : "text-red-600"}>
                            {txn.amount >= 0 ? "+" : ""}GHS {Math.abs(txn.amount).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-medium">
                            GHS {txn.balance.toLocaleString()}
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
        <Dialog open={showOTPVerification} onOpenChange={setShowOTPVerification}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Verify Your Identity</DialogTitle>
              <DialogDescription>
                For security, we need to verify your phone number before processing this withdrawal.
              </DialogDescription>
            </DialogHeader>
            <OTPVerification
              phone={user?.phone || momoNumber}
              purpose="withdrawal"
              userId={user?.id}
              onVerified={handleOTPVerified}
              onCancel={() => setShowOTPVerification(false)}
              title="Withdrawal Verification"
              description="Enter the OTP sent to your phone"
            />
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
                <span className="font-medium">GHS {withdrawAmount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee</span>
                <span className="text-red-600">- GHS {fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">You'll Receive</span>
                <span className="font-bold text-green-600">GHS {netAmount.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span>{payoutMethod === "mobile_money" ? "Mobile Money" : "Bank Transfer"}</span>
              </div>
              {payoutMethod === "mobile_money" ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span>{momoNumber}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank</span>
                    <span>{bankName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account</span>
                    <span>{accountNumber}</span>
                  </div>
                </>
              )}
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
