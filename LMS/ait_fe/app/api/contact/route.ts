import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Read the JSON body from the incoming request
    const { name, email, subject, message } = await req.json();

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { message: "All fields are required" },
        { status: 400 }
      );
    }

    // Log the received message (for debugging)
    console.log("Received message:", { name, email, subject, message });

    // Forward the request to your Django backend API endpoint
    const baseUrl = process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const backendResponse = await fetch(
      `${baseUrl}/api/contact/`, // Replace with your Django endpoint
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      }
    );

    // Check if the backend returned an error
    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      return NextResponse.json(
        { message: "Backend error", error: errorData },
        { status: backendResponse.status }
      );
    }

    // If successful, return a success message
    return NextResponse.json(
      { message: "Message sent successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
