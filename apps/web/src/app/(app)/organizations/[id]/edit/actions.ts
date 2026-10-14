"use server";

import { redirect } from "next/navigation";
import { createServerApi } from "@/lib/api/server";
import { describeApiError, parseOrganizationForm, type OrganizationFormState } from "@/lib/organization-form";

// Bound to the organization's id by the edit page.
export async function updateOrganization(
  id: string,
  _prev: OrganizationFormState,
  formData: FormData,
): Promise<OrganizationFormState> {
  const form = parseOrganizationForm(formData);
  if (!form.ok || !form.input) {
    return { error: "Please fix the highlighted fields.", fieldErrors: form.fieldErrors, values: form.values };
  }

  const { input } = form;
  const api = await createServerApi();
  try {
    await api.organizations.update(id, {
      name: input.name,
      type: input.type,
      // A blank optional field clears it.
      description: input.description ?? null,
      zipcode: input.zipcode ?? null,
      address: input.address ?? null,
      discordUrl: input.discordUrl ?? null,
      websiteUrl: input.websiteUrl ?? null,
    });

    if (form.logo) {
      await api.organizations.uploadLogo(id, form.logo, form.logo.name);
    } else if (form.removeLogo) {
      await api.organizations.removeLogo(id);
    }
  } catch (err) {
    return { error: describeApiError(err, "save your changes"), values: form.values };
  }

  redirect(`/organizations/${id}`);
}
