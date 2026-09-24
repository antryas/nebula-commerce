import { TestBed } from '@angular/core/testing';
import { NonNullableFormBuilder } from '@angular/forms';
import { Product } from '../../models';
import {
  addVariant,
  applyServerErrors,
  buildProductForm,
  fieldError,
  removeVariant,
  toProductInput,
} from './product-form';

const PRODUCT: Product = {
  id: 'prd_0001',
  sku: 'APP-NOV-001',
  name: 'Nova Hoodie',
  description: 'Soft and warm.',
  category: 'Apparel',
  price: 79,
  compareAtPrice: 99,
  imageUrl: 'https://example.test/p.png',
  stock: 5,
  sold: 12,
  rating: 4.6,
  variants: [
    { id: 'prd_0001_v1', size: 'M', color: 'Black', stock: 2 },
    { id: 'prd_0001_v2', size: 'L', color: 'Black', stock: 3 },
  ],
  createdAt: '2025-01-01T00:00:00.000Z',
  active: true,
};

describe('buildProductForm', () => {
  let fb: NonNullableFormBuilder;
  beforeEach(() => (fb = TestBed.inject(NonNullableFormBuilder)));

  it('requires name, sku, price, category', () => {
    const f = buildProductForm(fb);
    expect(f.valid).toBe(false);
    expect(f.controls.name.hasError('required')).toBe(true);
    expect(f.controls.sku.hasError('required')).toBe(true);
    expect(f.controls.price.hasError('required')).toBe(true);
    expect(f.controls.category.hasError('required')).toBe(true);
  });

  it('validates SKU pattern', () => {
    const f = buildProductForm(fb);
    f.controls.sku.setValue('ab');
    expect(f.controls.sku.hasError('pattern')).toBe(true);
    expect(fieldError(f.controls.sku)).toBe('Use 4–20 uppercase letters, digits or dashes');
    f.controls.sku.setValue('NB-1001');
    expect(f.controls.sku.valid).toBe(true);
  });

  it('requires a positive price and limits name and description length', () => {
    const f = buildProductForm(fb);
    f.controls.price.setValue(0);
    expect(f.controls.price.hasError('positive')).toBe(true);
    f.controls.name.setValue('x'.repeat(81));
    expect(f.controls.name.hasError('maxlength')).toBe(true);
    f.controls.description.setValue('x'.repeat(1001));
    expect(f.controls.description.hasError('maxlength')).toBe(true);
  });

  it('requires compare-at price above price', () => {
    const f = buildProductForm(fb);
    f.patchValue({ price: 50, compareAtPrice: 40 });
    expect(f.hasError('compareAtNotAbove')).toBe(true);
    f.patchValue({ compareAtPrice: 60 });
    expect(f.hasError('compareAtNotAbove')).toBe(false);
    f.patchValue({ compareAtPrice: null });
    expect(f.hasError('compareAtNotAbove')).toBe(false);
  });

  it('rejects negative or fractional stock', () => {
    const f = buildProductForm(fb);
    f.controls.stock.setValue(-1);
    expect(f.controls.stock.valid).toBe(false);
    f.controls.stock.setValue(1.5);
    expect(f.controls.stock.hasError('integer')).toBe(true);
    f.controls.stock.setValue(3);
    expect(f.controls.stock.valid).toBe(true);
  });

  it('sums variant stock and disables stock control', () => {
    const f = buildProductForm(fb);
    addVariant(f, { size: 'M', color: 'Black', stock: 3 });
    addVariant(f, { size: 'L', color: 'Black', stock: 4 });
    expect(f.controls.stock.disabled).toBe(true);
    expect(f.getRawValue().stock).toBe(7);

    f.controls.variants.at(0).controls.stock.setValue(10);
    expect(f.getRawValue().stock).toBe(14);

    removeVariant(f, 0);
    removeVariant(f, 0);
    expect(f.controls.stock.enabled).toBe(true);
  });

  it('requires size and color on variants', () => {
    const f = buildProductForm(fb);
    addVariant(f, { size: '', color: '', stock: 0 });
    const v = f.controls.variants.at(0).controls;
    expect(v.size.hasError('required')).toBe(true);
    expect(v.color.hasError('required')).toBe(true);
  });

  it('prefills from a product and converts back to input', () => {
    const f = buildProductForm(fb, PRODUCT);
    expect(f.valid).toBe(true);
    expect(f.controls.variants.length).toBe(2);
    expect(f.controls.stock.disabled).toBe(true);
    expect(f.pristine).toBe(true);

    const input = toProductInput(f);
    expect(input).toEqual({
      sku: 'APP-NOV-001',
      name: 'Nova Hoodie',
      description: 'Soft and warm.',
      category: 'Apparel',
      price: 79,
      compareAtPrice: 99,
      imageUrl: 'https://example.test/p.png',
      stock: 5,
      variants: PRODUCT.variants,
      active: true,
    });
  });

  it('maps server validation details onto matching controls', () => {
    const f = buildProductForm(fb, PRODUCT);
    const mapped = applyServerErrors(f, { sku: 'SKU is already in use', unknown: 'x' });
    expect(mapped).toBe(true);
    expect(f.controls.sku.hasError('server')).toBe(true);
    expect(fieldError(f.controls.sku)).toBe('SKU is already in use');
    expect(applyServerErrors(f, 'nope')).toBe(false);

    f.controls.sku.setValue('APP-NOV-002');
    expect(f.controls.sku.hasError('server')).toBe(false);
  });
});
