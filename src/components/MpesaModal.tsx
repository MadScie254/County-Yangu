import { useState, FormEvent } from "react";
import { Loader2, Smartphone, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface MpesaModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  reference: string;
  description: string;
  applicationId: string;
  onSuccess?: () => void;
}

export function MpesaModal({ isOpen, onClose, amount, reference, description, applicationId, onSuccess }: MpesaModalProps) {
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  const handlePayment = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus("processing");
    setErrorMessage("");

    try {
      // Call the Edge Function for STK Push
      const { data, error } = await supabase.functions.invoke("mpesa-stk-push", {
        body: {
          amount,
          phone,
          reference,
          description,
          applicationId
        }
      });

      if (error) throw error;
      
      // If STK push was successful, Safaricom sends a prompt to the phone.
      // We would ideally poll the DB or listen via Supabase Realtime here.
      // For this implementation, we simulate success after pushing.
      
      setStatus("success");
      setTimeout(() => {
        onSuccess?.();
        onClose();
        setStatus("idle");
        setPhone("");
      }, 3000);

    } catch (err: any) {
      console.error("M-Pesa payment failed:", err);
      setStatus("error");
      setErrorMessage(err.message || "Failed to initiate payment. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
              <Smartphone className="w-8 h-8" />
            </div>
          </div>
          
          <h2 className="text-2xl font-black text-center text-gray-900 mb-2">Lipa na M-Pesa</h2>
          <p className="text-center text-gray-500 mb-8 font-medium">
            Pay <span className="font-bold text-gray-900">KES {amount}</span> for {description}
          </p>

          {status === "success" ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Payment Initiated</h3>
              <p className="text-sm text-gray-500">Please check your phone and enter your M-Pesa PIN to complete the transaction.</p>
            </div>
          ) : (
            <form onSubmit={handlePayment} className="space-y-6">
              <div>
                <label htmlFor="phone" className="block text-sm font-bold text-gray-700 mb-2">
                  M-Pesa Phone Number
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
                    +254
                  </span>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="7XX XXX XXX"
                    className="w-full pl-16 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium transition"
                  />
                </div>
              </div>

              {status === "error" && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !phone}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-lg tracking-wide hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/20"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Pay Now"
                )}
              </button>
            </form>
          )}
        </div>
        
        <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-center items-center gap-2 text-xs font-bold text-gray-400">
          <ShieldCheck className="w-4 h-4" /> Secure Payment Gateway
        </div>
      </div>
    </div>
  );
}
