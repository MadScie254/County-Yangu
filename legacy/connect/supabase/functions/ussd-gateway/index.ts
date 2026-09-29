import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const formData = await req.formData();
    const sessionId = formData.get("sessionId");
    const serviceCode = formData.get("serviceCode");
    const phoneNumber = formData.get("phoneNumber");
    const text = formData.get("text")?.toString() || "";

    // Africa's Talking USSD logic
    // The "text" parameter contains the user's input, separated by *
    // e.g., if user entered 1, then 2, text would be "1*2"
    let response = "";

    if (text === "") {
      // This is the first request. Note how we start the response with CON
      response = `CON Welcome to CountyConnect
1. Check Application Status
2. Report an Issue
3. Exit`;
    } else if (text === "1") {
      // Business logic for checking application
      response = `CON Enter your National ID number:`;
    } else if (text.startsWith("1*")) {
      // User has entered their National ID
      const parts = text.split("*");
      const idNumber = parts[1];
      
      // In a real app, query the database here using the Supabase client
      response = `END Your application for ID ${idNumber} is currently under review. You will be notified via SMS once approved.`;
    } else if (text === "2") {
      response = `CON What issue would you like to report?
1. Broken Water Pipe
2. Pothole / Road Issue
3. Garbage Collection`;
    } else if (text.startsWith("2*")) {
      response = `END Thank you for reporting. Your issue has been logged and the county maintenance team has been notified.`;
    } else if (text === "3") {
      response = `END Thank you for using CountyConnect. Goodbye!`;
    } else {
      response = `END Invalid input. Please try again.`;
    }

    // Send the response back to Africa's Talking
    return new Response(response, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error: any) {
    console.error("USSD processing error:", error.message);
    return new Response(`END System error. Please try again later.`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
});
