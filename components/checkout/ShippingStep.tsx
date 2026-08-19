"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { shippingSchema, type ShippingValues } from "@/lib/schemas/checkout";
import { Field, Input, Textarea, FieldRow, FieldRow3 } from "./FormField";
import { Button } from "@/components/shared/Button";

export function ShippingStep({
  defaultValues,
  onNext,
  onBack,
}: {
  defaultValues: Partial<ShippingValues>;
  onNext: (values: ShippingValues) => void;
  onBack: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ShippingValues>({
    resolver: zodResolver(shippingSchema),
    defaultValues: { country: "Canada", sameBilling: true, ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onNext)}>
      <h2 className="font-display font-bold text-header mb-sp-4">Ship To</h2>

      <Field label="Street Address" error={errors.address1?.message}>
        <Input placeholder="1234 Industrial Ave" invalid={!!errors.address1} {...register("address1")} />
      </Field>

      <FieldRow>
        <Field label="Suite / Unit (optional)">
          <Input {...register("address2")} />
        </Field>
        <Field label="City" error={errors.city?.message}>
          <Input placeholder="Vancouver" invalid={!!errors.city} {...register("city")} />
        </Field>
      </FieldRow>

      <FieldRow3>
        <Field label="Province" error={errors.region?.message}>
          <Input placeholder="BC" invalid={!!errors.region} {...register("region")} />
        </Field>
        <Field label="Postal Code" error={errors.postalCode?.message}>
          <Input placeholder="V6A 1A1" invalid={!!errors.postalCode} {...register("postalCode")} />
        </Field>
        <Field label="Country" error={errors.country?.message}>
          <Input placeholder="Canada" invalid={!!errors.country} {...register("country")} />
        </Field>
      </FieldRow3>

      <Field label="Delivery Notes (optional)">
        <Textarea rows={2} placeholder="Loading dock hours, etc." {...register("notes")} />
      </Field>

      <label className="flex items-center gap-2 text-sm mt-2">
        <input type="checkbox" {...register("sameBilling")} defaultChecked />
        Billing address is the same as shipping address
      </label>

      <div className="flex justify-between mt-sp-4">
        <Button type="button" variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <Button type="submit">Continue to Review →</Button>
      </div>
    </form>
  );
}
