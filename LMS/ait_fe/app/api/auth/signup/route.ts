// import { NextRequest, NextResponse } from "next/server";
// import { setReFreshToken, setToken } from "@/lib/auth";

// export async function POST(req: NextRequest) {
//   const req_data = await req.json();
//   console.log(req_data)
//   // console.log(`${process.env.NEXT_PUBLIC_API_URL}/user/register`)
//   try {
//     const res = await fetch(
//       `${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`,
//       {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(req_data),
//       }
//     );
//     const responseData = await res.json();
//     console.log("responseData :", responseData);
//     if (responseData.status == 301) {
//       if (responseData === "phone") {
//         return NextResponse.json({
//           message: responseData,
//           status: 301,
//         });
//       } else if (responseData === "email") {
//         return NextResponse.json({
//           message: responseData,
//           status: 301,
//         });
//       } else if (responseData === "cnic") {
//         return NextResponse.json({
//           message: responseData,
//           status: 301,
//         });
//       }
//       return NextResponse.json({ message: responseData, status: 301 });

//     } else if (res.ok) {
//       await setReFreshToken(responseData.refresh);
//       await setToken(responseData.access);
//       const user = responseData.user;
//       return NextResponse.json({ user, status: 200 });
//     } else {
//       return NextResponse.json({
//         message: responseData.message || "Failed to process checkout",
//         status: res.status,
//       });
//     }
//   } catch (error) {
//     console.error("Error:", error);
//     return NextResponse.json({
//       message: "An unexpected error occurred",
//       status: 500,
//     });
//   }
// }
import { NextRequest, NextResponse } from "next/server";
import { setReFreshToken, setToken, setLmsBridgeToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // 1) Read incoming JSON and extract the `url` param
  let reqBody: any;
  try {
    reqBody = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body", status: 400 });
  }
  const path = req.nextUrl.searchParams.get("url") || "";

  console.log(reqBody)
  // 2) Forward the request to Django
  let upstream: Response;
  try {
    const baseUrl = process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    upstream = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reqBody),
    });
  } catch (err) {
    console.error("Proxy fetch failed:", err);
    return NextResponse.json({ message: "Unable to reach backend", status: 502 });
  }

  // 3) Safely parse the response body (JSON or text)
  const contentType = upstream.headers.get("content-type") || "";
  let data: any;
  if (contentType.includes("application/json")) {
    try {
      data = await upstream.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON from backend", status: 502 });
    }
  } else {
    data = await upstream.text();
  }
  console.log("upstream:", data);
  // 4) Duplicate‑field error (301) → just forward
  if (upstream.status === 301) {
    return NextResponse.json({ message: data, status: 301 });
  }

  // 5) INIT step → OTP sent, no tokens
  // if (upstream.ok && path.endsWith("/register/init")) {
  //   // data should be { message: "Verification code sent!" }
  //   return NextResponse.json({ ...data, status: 200 });
  // }

  // 6) VERIFY (final signup) → set cookies and return user
  // if (upstream.ok && path.endsWith("/register/verify")) {
  //   const { access, refresh, user } = data as {
  //     access: string;
  //     refresh: string;
  //     user: Record<string, any>;
  //   };

  //   // Store tokens in secure HTTP cookies
  //   await setReFreshToken(refresh);
  //   await setToken(access);

  //   return NextResponse.json({ user, status: 200 });
  // }

  // DIRECT REGISTER (New 1-step flow)
  if (upstream.ok && path.endsWith("/register")) {
    const dataObj = data as any;
    const access = dataObj.access || dataObj.access_token || dataObj.token;
    const refresh = dataObj.refresh || dataObj.refresh_token;
    const user = dataObj.user;

    if (access && refresh) {
      // Store tokens in secure HTTP cookies
      await setReFreshToken(refresh);
      await setToken(access);
      await setLmsBridgeToken(access); // Bridge to LMS
    } else {
      console.error("Signup success but tokens missing:", data);
    }

    // Return user AND access token (frontend needs it for client-side bridge cookie)
    return NextResponse.json({ user, access, status: 200 });
  }

  // 7) Other success (if any) → simply forward
  if (upstream.ok) {
    return NextResponse.json({ ...data, status: 200 });
  }

  // 8) Fallback for all other errors
  return NextResponse.json({
    message: data.message || "Unknown error",
    status: upstream.status,
  });
}
