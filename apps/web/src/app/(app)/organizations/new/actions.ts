"use server";

import { redirect } from "next/navigation";
import { createServerApi } from "@/lib/api/server";
import { describeApiError, parseOrganizationForm, type OrganizationFormState } from "@/lib/organization-form";

export async function createOrganization(
  _prev: OrganizationFormState,
  formData: FormData,
): Promise<OrganizationFormState> {
  const form = parseOrganizationForm(formData);
  if (!form.ok || !form.input) {
    return { error: "Please fix the highlighted fields.", fieldErrors: form.fieldErrors, values: form.values };
  }

  const api = await createServerApi();
  let organizationId: string;
  try {
    organizationId = (await api.organizations.create(form.input)).id;
  } catch (err) {
    return { error: describeApiError(err, "create the organization"), values: form.values };
  }

  if (form.logo) {
    try {
      await api.organizations.uploadLogo(organizationId, form.logo, form.logo.name);
    } catch (err) {
      // The organization exists; don't make people fill the form again.
      console.error("Logo upload failed", err);
    }
  }

  redirect(`/organizations/${organizationId}`);
}
