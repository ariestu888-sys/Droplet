import {
  CreateOrganizationSchema,
  DropletApiError,
  LOGO_MAX_BYTES,
  LOGO_TYPES,
  type CreateOrganization,
} from "@droplet/shared";
import { CUSTOM_TYPE } from "./form-constants";

// Shared by the create and edit organization forms.


type FieldName = keyof CreateOrganization;

export type OrganizationFormValues = Partial<Record<FieldName | "customType", string>>;

export type OrganizationFormState = {
  error?: string;
  fieldErrors?: Partial<Record<FieldName | "logo", string>>;
  // What the user typed, so the form can show it again after an error.
  values?: OrganizationFormValues;
};

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

const FRIENDLY_ERRORS: Partial<Record<FieldName, string>> = {
  name: "Names need 2 to 80 characters.",
  type: "Pick a type, or enter your own (2 to 40 characters).",
  description: "Descriptions can be up to 500 characters.",
  address: "Addresses can be up to 200 characters.",
};

// Reads and checks the form. `input` has blank optional fields left out.
export function parseOrganizationForm(formData: FormData) {
  const values: OrganizationFormValues = {
    name: text(formData, "name"),
    type: text(formData, "type"),
    customType: text(formData, "customType"),
    description: text(formData, "description"),
    zipcode: text(formData, "zipcode"),
    address: text(formData, "address"),
    discordUrl: text(formData, "discordUrl"),
    websiteUrl: text(formData, "websiteUrl"),
  };

  const fieldErrors: NonNullable<OrganizationFormState["fieldErrors"]> = {};
  const parsed = CreateOrganizationSchema.safeParse({
    name: values.name,
    type: values.type === CUSTOM_TYPE ? values.customType : values.type,
    description: values.description || undefined,
    zipcode: values.zipcode || undefined,
    address: values.address || undefined,
    discordUrl: values.discordUrl || undefined,
    websiteUrl: values.websiteUrl || undefined,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as FieldName;
      fieldErrors[key] ??= FRIENDLY_ERRORS[key] ?? issue.message;
    }
  }

  const file = formData.get("logo");
  const logo = file instanceof File && file.size > 0 ? file : null;
  if (logo) {
    if (!(LOGO_TYPES as readonly string[]).includes(logo.type)) {
      fieldErrors.logo = "Logos must be PNG, JPG or WebP images.";
    } else if (logo.size > LOGO_MAX_BYTES) {
      fieldErrors.logo = "Logos can be up to 2 MB.";
    }
  }

  const ok = parsed.success && Object.keys(fieldErrors).length === 0;
  return {
    ok,
    input: parsed.success ? parsed.data : null,
    values,
    fieldErrors,
    logo,
    removeLogo: formData.get("removeLogo") === "1",
  };
}

export function describeApiError(err: unknown, action: string) {
  if (err instanceof DropletApiError) {
    if (err.status === 401) return "Your session has expired. Please log in again.";
    if (err.status === 403) return "Only owners and admins can change this organization.";
    if (err.code === "not_set_up") {
      return "Organizations aren't fully set up in the database yet. Run the latest migration in supabase/migrations.";
    }
    if (err.status === 400) return err.message;
  }
  return `Couldn't ${action}. Please try again.`;
}
