// app/api/silent-login/route.ts
import { startShopifyCustomerLogin } from "@/app/api/login/route";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return startShopifyCustomerLogin(request, true);
}