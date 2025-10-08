// app/api/upsert-customer/route.ts
import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface UpsertBody {
  id: string; // Shopify customer GID or numeric id (stringified)
  email?: string;
  firstName?: string;
  lastName?: string;
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

    const body = (await request.json()) as Partial<UpsertBody>;

    if (!body.id) {
      return NextResponse.json(
        { ok: false, error: "Missing 'id' in body" },
        { status: 400 }
      );
    }

    const payload = {
      shopify_id: String(body.id),
      email: body.email ?? "",
      first_name: body.firstName ?? "",
      last_name: body.lastName ?? "",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("customers")
      .upsert(payload)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, customer: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}