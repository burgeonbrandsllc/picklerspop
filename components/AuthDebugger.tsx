"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthDebugger() {
  const [output, setOutput] = useState("Checking auth...");

  useEffect(() => {
    async function check() {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setOutput("Error: " + error.message);
      } else if (data.session) {
        setOutput("✅ Logged in as " + data.session.user.email);
      } else {
        setOutput("❌ No active session");
      }
    }
    check();
  }, []);

  return (
    <div className="p-2 bg-gray-100 text-sm rounded mt-4">
      {output}
    </div>
  );
}
