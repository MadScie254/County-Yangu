import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Daraja does not sign callbacks, so this endpoint is protected by:
//   1. a secret carried in the callback URL (?token=...), set by mpesa-stk-push
//   2. an optional source-IP allowlist (MPESA_ALLOWED_IPS, comma separated)
//   3. only moving a payment from "pending", and only when the paid amount matches
// Deploy with `--no-verify-jwt`: Safaricom cannot send a Supabase JWT.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CALLBACK_SECRET = Deno.env.get("MPESA_CALLBACK_SECRET") ?? "";
const ALLOWED_IPS = (Deno.env.get("MPESA_ALLOWED_IPS") ?? "")
  .split(",")
  .map((ip) => ip.trim())
  .filter(Boolean);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function timingSafeEqual(a: string, b: string) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function isAuthorised(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!timingSafeEqual(token, CALLBACK_SECRET)) return false;

  if (ALLOWED_IPS.length > 0) {
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
    if (!ALLOWED_IPS.includes(forwarded)) return false;
  }
  return true;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Fail closed: without a configured secret nothing can be trusted.
  if (!CALLBACK_SECRET) {
    console.error("MPESA_CALLBACK_SECRET is not set; rejecting callback");
    return json({ ResultCode: 1, ResultDesc: "Not configured" }, 503);
  }
  if (!isAuthorised(req)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const data = await req.json();

    // Safaricom Daraja Webhook Payload Structure
    const body = data.Body.stkCallback;
    const resultCode = body.ResultCode;
    const checkoutRequestID = body.CheckoutRequestID;

    if (resultCode === 0) {
      const items = body.CallbackMetadata.Item;
      const amount = Number(items.find((item: any) => item.Name === "Amount")?.Value);
      const mpesaReceiptNumber = items.find((item: any) => item.Name === "MpesaReceiptNumber")?.Value;
      const phoneNumber = items.find((item: any) => item.Name === "PhoneNumber")?.Value?.toString();

      const { data: existing } = await supabase
        .from("payments")
        .select("*")
        .eq("checkout_request_id", checkoutRequestID)
        .single();

      if (!existing) {
        console.error("Callback for unknown CheckoutRequestID:", checkoutRequestID);
      } else if (existing.status !== "pending") {
        // Daraja retries; a payment that is already settled is not touched again.
        console.log("Ignoring callback for non-pending payment:", checkoutRequestID);
      } else if (!Number.isFinite(amount) || amount < Number(existing.amount)) {
        console.error("Amount mismatch for", checkoutRequestID, "paid", amount, "expected", existing.amount);
        await supabase
          .from("payments")
          .update({ status: "failed" })
          .eq("checkout_request_id", checkoutRequestID)
          .eq("status", "pending");
      } else {
        // The status filter makes the transition atomic if two callbacks race.
        const { data: payment, error: paymentError } = await supabase
          .from("payments")
          .update({ status: "completed" })
          .eq("checkout_request_id", checkoutRequestID)
          .eq("status", "pending")
          .select()
          .single();

        if (paymentError || !payment) {
          console.error("Payment update error:", paymentError);
        } else if (payment.application_id) {
          await supabase
            .from("applications")
            .update({ status: "Pending Review" })
            .eq("id", payment.application_id);

          const { error: revenueError } = await supabase.from("revenue").insert({
            ref: mpesaReceiptNumber || checkoutRequestID,
            amount,
            payer_name: phoneNumber || payment.phone || "Unknown Citizen",
            stream: "Digital Services",
            reconciled: true,
          });

          if (revenueError) {
            console.error("Supabase revenue insert error:", revenueError);
          }
        }
      }
    } else {
      console.log(`STK Push failed or cancelled: ${body.ResultDesc}`);
      await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("checkout_request_id", checkoutRequestID)
        .eq("status", "pending");
    }

    // Safaricom expects a success response so it doesn't retry
    return json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error: any) {
    console.error("Webhook processing error:", error.message);
    return json({ ResultCode: 1, ResultDesc: "Failed" }, 500);
  }
});
