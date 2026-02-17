import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Heart } from "lucide-react";

interface DonationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Paystack script URL - V1 is often more stable for plain JS integrations
const PAYSTACK_SCRIPT_URL = "https://js.paystack.co/v1/inline.js";

const DonationModal = ({ isOpen, onClose }: DonationModalProps) => {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [amount, setAmount] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [scriptLoaded, setScriptLoaded] = useState(false);

    const presetAmounts = ["1000", "2000", "5000", "10000"];

    // Preload script when modal is open
    React.useEffect(() => {
        if (isOpen && !scriptLoaded) {
            const script = document.createElement("script");
            script.src = PAYSTACK_SCRIPT_URL;
            script.async = true;
            script.onload = () => setScriptLoaded(true);
            script.onerror = () => {
                setScriptLoaded(false);
                toast.error("Failed to load payment gateway");
            };
            document.body.appendChild(script);
        }
    }, [isOpen, scriptLoaded]);

    const handlePaystackPayment = (e: React.FormEvent) => {
        e.preventDefault();

        if (!name || !email || !amount) {
            toast.error("Please fill in all fields");
            return;
        }

        const amountInKobo = parseInt(amount) * 100;
        if (isNaN(amountInKobo) || amountInKobo <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        const PaystackPop = (window as any).PaystackPop;
        if (!PaystackPop) {
            toast.error("Payment system not ready. Please wait a moment.");
            return;
        }

        setIsProcessing(true);

        try {
            const handler = PaystackPop.setup({
                key: "pk_test_86bdd5466ad3348adf0db92923e85232cb366f10",
                email: email,
                amount: amountInKobo,
                currency: "NGN",
                ref: `DON-${Math.floor(Math.random() * 1000000000 + 1)}`,
                metadata: {
                    custom_fields: [
                        {
                            display_name: "Name",
                            variable_name: "name",
                            value: name,
                        },
                    ],
                },
                onSuccess: function (response: any) {
                    console.log("Paystack Success:", response);
                    toast.success("Hallelujah! Your donation has been received. May God bless you abundantly for your generosity!");

                    // Log to backend (non-blocking)
                    fetch("/api/donations", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name,
                            email,
                            amount,
                            reference: response.reference,
                        }),
                    }).catch(err => console.error("Failed to log donation:", err));

                    setIsProcessing(false);
                    onClose();
                    // Clear form
                    setName("");
                    setEmail("");
                    setAmount("");
                },
                onClose: function () {
                    setIsProcessing(false);
                },
                onCancel: function () {
                    setIsProcessing(false);
                    toast.info("Transaction cancelled");
                },
            });

            // Ensure iframe has highest z-index and handle mobile quirks
            handler.openIframe();

            // Subtle hack: Paystack uses an iframe that might be hidden by Radix modal on mobile
            setTimeout(() => {
                const iframes = document.getElementsByTagName('iframe');
                for (let i = 0; i < iframes.length; i++) {
                    if (iframes[i].src.includes('paystack')) {
                        iframes[i].style.zIndex = '9999999999';
                        if (iframes[i].parentElement) {
                            iframes[i].parentElement!.style.zIndex = '9999999999';
                        }
                    }
                }
            }, 500);

        } catch (error) {
            console.error("Paystack Setup Error:", error);
            toast.error("An error occurred during payment setup");
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px] bg-card border-border">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Heart className="w-5 h-5 text-primary fill-primary" />
                        Support Kingdom FM Xtra
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Your donations help us keep the word of God on air.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handlePaystackPayment} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="don-name">Full Name</Label>
                        <Input
                            id="don-name"
                            placeholder="Your Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="don-email">Email Address</Label>
                        <Input
                            id="don-email"
                            type="email"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="don-amount">Amount (NGN)</Label>
                        <Input
                            id="don-amount"
                            type="number"
                            placeholder="Amount in Naira"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                        <div className="flex flex-wrap gap-2 mt-2">
                            {presetAmounts.map((amt) => (
                                <Button
                                    key={amt}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setAmount(amt)}
                                    className={amount === amt ? "border-primary bg-primary/10" : ""}
                                >
                                    ₦{parseInt(amt).toLocaleString()}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="submit" disabled={isProcessing} className="w-full h-12 text-lg">
                            {isProcessing ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                "Donate Now"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default DonationModal;
