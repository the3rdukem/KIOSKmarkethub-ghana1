import Link from "next/link";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  ShoppingCart,
  CreditCard,
  Truck,
  Shield,
  User,
  Store,
  CheckCircle,
  Star,
  MessageSquare,
  Package,
  Smartphone,
  Camera,
  FileText,
  ArrowRight
} from "lucide-react";

const buyerSteps = [
  {
    step: 1,
    title: "Browse & Search",
    description: "Discover thousands of products from verified vendors across Ghana",
    icon: Search,
    details: ["Advanced search filters", "Category browsing", "Vendor storefronts", "Product comparisons"]
  },
  {
    step: 2,
    title: "Add to Cart",
    description: "Select your items and review your order before checkout",
    icon: ShoppingCart,
    details: ["Multiple vendor support", "Quantity selection", "Variation options", "Wishlist management"]
  },
  {
    step: 3,
    title: "Secure Payment",
    description: "Pay safely with Mobile Money or credit card",
    icon: CreditCard,
    details: ["MTN MoMo, AirtelTigo, Vodafone", "Credit/debit cards", "Escrow protection", "SSL encryption"]
  },
  {
    step: 4,
    title: "Track & Receive",
    description: "Monitor your order and receive your products",
    icon: Truck,
    details: ["Real-time tracking", "SMS notifications", "Delivery confirmation", "Return options"]
  }
];

const vendorSteps = [
  {
    step: 1,
    title: "Register & Verify",
    description: "Create your vendor account with ID and facial verification",
    icon: User,
    details: ["Photo ID upload", "Facial recognition", "Business registration", "Background check"]
  },
  {
    step: 2,
    title: "Setup Store",
    description: "Create your virtual storefront and add products",
    icon: Store,
    details: ["Store customization", "Product listings", "Inventory management", "Pricing tools"]
  },
  {
    step: 3,
    title: "Manage Orders",
    description: "Process orders and communicate with customers",
    icon: Package,
    details: ["Order notifications", "Customer messaging", "Shipping management", "Status updates"]
  },
  {
    step: 4,
    title: "Get Paid",
    description: "Receive payments directly to your Mobile Money account",
    icon: Smartphone,
    details: ["Instant payouts", "Mobile Money integration", "Transaction history", "Fee transparency"]
  }
];

const securityFeatures = [
  {
    title: "Vendor Verification",
    description: "All vendors undergo rigorous ID and facial recognition verification",
    icon: Shield,
    features: ["Government ID verification", "Facial recognition technology", "Business document review", "Manual verification process"]
  },
  {
    title: "Escrow Protection",
    description: "Your money is held safely until you confirm receipt of your order",
    icon: CreditCard,
    features: ["Payment protection", "Dispute resolution", "Refund guarantee", "Secure transactions"]
  },
  {
    title: "Quality Assurance",
    description: "Review system and quality monitoring ensure high standards",
    icon: Star,
    features: ["Customer reviews", "Vendor ratings", "Quality monitoring", "Feedback system"]
  }
];

export default function HowItWorksPage() {
  return (
    <SiteLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">How KIOSK Works</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Ghana's most secure marketplace connecting verified vendors with buyers
          </p>
          <div className="flex justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/auth/register">
                <User className="w-5 h-5 mr-2" />
                Start Buying
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/auth/register">
                <Store className="w-5 h-5 mr-2" />
                Start Selling
              </Link>
            </Button>
          </div>
        </div>

        {/* For Buyers */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">For Buyers</h2>
            <p className="text-muted-foreground">
              Shop with confidence from verified vendors across Ghana
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {buyerSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card key={index} className="relative">
                  <CardHeader className="text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-8 h-8 text-blue-600" />
                    </div>
                    <div className="absolute -top-3 -right-3 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                      {step.step}
                    </div>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                    <CardDescription>{step.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {step.details.map((detail, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* For Vendors */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">For Vendors</h2>
            <p className="text-muted-foreground">
              Start selling and reach customers across Ghana with our verification process
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {vendorSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card key={index} className="relative">
                  <CardHeader className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-8 h-8 text-green-600" />
                    </div>
                    <div className="absolute -top-3 -right-3 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                      {step.step}
                    </div>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                    <CardDescription>{step.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {step.details.map((detail, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Security & Trust */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">Security & Trust</h2>
            <p className="text-muted-foreground">
              Multiple layers of protection ensure safe transactions for everyone
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {securityFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index}>
                  <CardHeader className="text-center">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-8 h-8 text-orange-600" />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {feature.features.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Verification Process */}
        <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-0 mb-16">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold mb-4">Vendor Verification Process</h3>
              <p className="text-muted-foreground">
                Our comprehensive verification ensures only legitimate vendors can sell on KIOSK
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-semibold mb-2">Document Upload</h4>
                <p className="text-sm text-muted-foreground">
                  Upload government-issued ID and business documents
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-semibold mb-2">Facial Recognition</h4>
                <p className="text-sm text-muted-foreground">
                  Live facial verification matches your ID photo
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-semibold mb-2">AI Validation</h4>
                <p className="text-sm text-muted-foreground">
                  Advanced AI checks document authenticity
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-semibold mb-2">Manual Review</h4>
                <p className="text-sm text-muted-foreground">
                  Human verification team final approval
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mobile Money Integration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-6 h-6 text-green-600" />
                Mobile Money Integration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Pay and get paid instantly with Ghana's most popular mobile money services
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Badge variant="outline" className="justify-center p-2">MTN MoMo</Badge>
                <Badge variant="outline" className="justify-center p-2">Vodafone Cash</Badge>
                <Badge variant="outline" className="justify-center p-2">AirtelTigo Money</Badge>
                <Badge variant="outline" className="justify-center p-2">Telecel Cash</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-blue-600" />
                Communication Tools
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Built-in messaging system keeps buyers and vendors connected
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  Order-linked conversations
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  File and image sharing
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  Real-time notifications
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  Dispute resolution support
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action */}
        <Card className="text-center border-2 border-dashed border-blue-300 bg-blue-50">
          <CardContent className="p-8">
            <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
            <p className="text-muted-foreground mb-6">
              Join thousands of buyers and vendors who trust KIOSK for secure online commerce
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link href="/auth/register">
                  <User className="w-5 h-5 mr-2" />
                  Start as Buyer
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/auth/register">
                  <Store className="w-5 h-5 mr-2" />
                  Become a Vendor
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </SiteLayout>
  );
}
