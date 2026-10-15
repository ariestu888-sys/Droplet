"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Passes the page's ?next=… (where to go after signing in) to a sign-in
// form. The server action checks it stays on this site.
export function NextField() {
  return (
    <Suspense fallback={null}>
      <NextInput />
    </Suspense>
  );
}

function NextInput() {
  const next = useSearchParams().get("next");
  return next ? <input type="hidden" name="next" value={next} /> : null;
}
