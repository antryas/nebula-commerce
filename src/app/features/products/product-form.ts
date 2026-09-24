import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ProductInput } from '../../core/api/products-api';
import { Product, ProductCategory } from '../../models';

export const PRODUCT_CATEGORIES: readonly ProductCategory[] = [
  'Apparel',
  'Footwear',
  'Accessories',
  'Electronics',
  'Home',
  'Beauty',
];

export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 1000;
export const SKU_PATTERN = /^[A-Z0-9-]{4,20}$/;

export interface VariantControls {
  id: FormControl<string>;
  size: FormControl<string>;
  color: FormControl<string>;
  stock: FormControl<number>;
}

export type VariantGroup = FormGroup<VariantControls>;

export interface ProductControls {
  name: FormControl<string>;
  sku: FormControl<string>;
  description: FormControl<string>;
  price: FormControl<number | null>;
  compareAtPrice: FormControl<number | null>;
  category: FormControl<ProductCategory | ''>;
  stock: FormControl<number>;
  active: FormControl<boolean>;
  imageUrl: FormControl<string>;
  variants: FormArray<VariantGroup>;
}

export type ProductForm = FormGroup<ProductControls>;

export interface VariantValue {
  id?: string;
  size: string;
  color: string;
  stock: number;
}

/** Value must be a number strictly greater than zero. Empty values are left to `required`. */
export const positive: ValidatorFn = (c) =>
  c.value == null || c.value === '' || Number(c.value) > 0 ? null : { positive: true };

/** Value must be a whole number. Empty values are left to `required`. */
export const integer: ValidatorFn = (c) =>
  c.value == null || c.value === '' || Number.isInteger(Number(c.value)) ? null : { integer: true };

/** Group validator: an optional compare-at price has to be higher than the price. */
export const compareAtAbovePrice: ValidatorFn = (group: AbstractControl) => {
  const price = group.get('price')?.value as number | null | undefined;
  const compareAt = group.get('compareAtPrice')?.value as number | null | undefined;
  if (compareAt == null || price == null) return null;
  return Number(compareAt) > Number(price) ? null : { compareAtNotAbove: true };
};

export const COMPARE_AT_MESSAGE = 'Compare-at price must be higher than price';

const MESSAGES: Record<string, (e: unknown) => string> = {
  required: () => 'This field is required',
  maxlength: (e) => `Keep it under ${(e as { requiredLength: number }).requiredLength} characters`,
  pattern: () => 'Use 4–20 uppercase letters, digits or dashes',
  positive: () => 'Must be greater than 0',
  min: () => 'Cannot be negative',
  integer: () => 'Use a whole number',
  server: (e) => String(e),
};

/** First human-readable error of a control, or `null` when valid. */
export function fieldError(control: AbstractControl): string | null {
  const errors = control.errors;
  if (!errors) return null;
  // Server messages are the most specific, so they win.
  if (errors['server']) return MESSAGES['server'](errors['server']);
  for (const key of Object.keys(errors)) {
    const format = MESSAGES[key];
    if (format) return format(errors[key]);
  }
  return 'Invalid value';
}

export function buildProductForm(fb: NonNullableFormBuilder, p?: Product): ProductForm {
  const form: ProductForm = fb.group(
    {
      name: fb.control('', [Validators.required, Validators.maxLength(NAME_MAX)]),
      sku: fb.control('', [Validators.required, Validators.pattern(SKU_PATTERN)]),
      description: fb.control('', Validators.maxLength(DESCRIPTION_MAX)),
      price: new FormControl<number | null>(null, [Validators.required, positive]),
      compareAtPrice: new FormControl<number | null>(null, positive),
      category: fb.control<ProductCategory | ''>('', Validators.required),
      stock: fb.control(0, [Validators.required, Validators.min(0), integer]),
      active: fb.control(true),
      imageUrl: fb.control(''),
      variants: fb.array<VariantGroup>([]),
    },
    { validators: compareAtAbovePrice },
  );

  // Keep the aggregate stock in sync while variant quantities are edited.
  form.controls.variants.valueChanges.subscribe(() => syncStock(form));

  if (p) patchProductForm(form, p);
  return form;
}

/** Replaces the whole form state with a product and marks the result pristine. */
export function patchProductForm(form: ProductForm, p: Product): void {
  const variants = form.controls.variants;
  variants.clear({ emitEvent: false });
  for (const v of p.variants) variants.push(variantGroup(v), { emitEvent: false });
  form.reset({
    name: p.name,
    sku: p.sku,
    description: p.description,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    category: p.category,
    stock: p.stock,
    active: p.active,
    imageUrl: p.imageUrl,
  });
  syncStock(form);
}

export function addVariant(form: ProductForm, v: VariantValue): void {
  form.controls.variants.push(variantGroup(v));
  form.markAsDirty();
}

export function removeVariant(form: ProductForm, index: number): void {
  form.controls.variants.removeAt(index);
  form.markAsDirty();
}

/** Maps `ApiError.details` (field → message) onto matching controls. Returns whether any matched. */
export function applyServerErrors(form: ProductForm, details: unknown): boolean {
  if (!details || typeof details !== 'object') return false;
  let matched = false;
  for (const [key, message] of Object.entries(details as Record<string, unknown>)) {
    const control = form.get(key);
    if (!control || typeof message !== 'string') continue;
    control.setErrors({ ...control.errors, server: message });
    control.markAsTouched();
    matched = true;
  }
  return matched;
}

export function toProductInput(form: ProductForm): ProductInput {
  const v = form.getRawValue();
  return {
    sku: v.sku.trim(),
    name: v.name.trim(),
    description: v.description,
    category: v.category as ProductCategory,
    price: Number(v.price),
    compareAtPrice: v.compareAtPrice == null ? null : Number(v.compareAtPrice),
    imageUrl: v.imageUrl,
    stock: v.stock,
    variants: v.variants.map((x) => ({
      id: x.id,
      size: x.size.trim(),
      color: x.color.trim(),
      stock: Number(x.stock),
    })),
    active: v.active,
  };
}

function variantGroup(v: VariantValue): VariantGroup {
  return new FormGroup({
    id: new FormControl(v.id ?? '', { nonNullable: true }),
    size: new FormControl(v.size, { nonNullable: true, validators: Validators.required }),
    color: new FormControl(v.color, { nonNullable: true, validators: Validators.required }),
    stock: new FormControl(v.stock, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), integer],
    }),
  });
}

/** With variants, stock is derived (sum of variant stock) and read-only; otherwise editable. */
function syncStock(form: ProductForm): void {
  const { variants, stock } = form.controls;
  if (variants.length === 0) {
    if (stock.disabled) stock.enable({ emitEvent: false });
    return;
  }
  const total = variants.controls.reduce((sum, g) => {
    const n = Number(g.controls.stock.value);
    return sum + (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
  }, 0);
  if (stock.enabled) stock.disable({ emitEvent: false });
  if (stock.value !== total) stock.setValue(total, { emitEvent: false });
}
