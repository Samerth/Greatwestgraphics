"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactSchema, type ContactValues } from "@/lib/schemas/checkout";
import { Field, Input, FieldRow } from "./FormField";
import { Button } from "@/components/shared/Button";

export function ContactStep({
  defaultValues,
  onNext,
}: {
  defaultValues: Partial<ContactValues>;
  onNext: (values: ContactValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onNext)}>
      <h2 className="font-display font-bold text-header mb-sp-4">Contact Information</h2>

      <Field label="Email" error={errors.email?.message}>
        <Input type="email" placeholder="you@company.com" invalid={!!errors.email} {...register("email")} />
      </Field>

      <FieldRow>
        <Field label="Full Name" error={errors.fullName?.message}>
          <Input placeholder="Jordan Lee" invalid={!!errors.fullName} {...register("fullName")} />
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          <Input type="tel" placeholder="(604) 555-0100" invalid={!!errors.phone} {...register("phone")} />
        </Field>
      </FieldRow>

      <Field label="Company (optional)">
        <Input placeholder="Company name" {...register("company")} />
      </Field>

      <div className="flex justify-end mt-sp-4">
        <Button type="submit">Continue to Shipping →</Button>
      </div>
    </form>
  );
}
