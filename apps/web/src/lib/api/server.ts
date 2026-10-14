import { createDropletApi } from "@droplet/shared";
import { createClient } from "@/lib/supabase/server";

// Droplet API client for Server Components and Server Actions. It sends the
// signed-in user's access token from their session cookie; the API verifies it.
export async function createServerApi() {
  const supabase = await createClient();

  return createDropletApi({
    baseUrl: process.env.NEXT_PUBLIC_API_URL!,
    getAccessToken: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token;
    },
  });
}
