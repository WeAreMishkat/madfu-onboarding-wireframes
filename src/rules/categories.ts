/**
 * MADFU BUSINESS CATEGORY CATALOGUE — FIXTURE
 *
 * This is NOT Madfu's real category or restriction list. It is a clearly
 * labelled demonstration fixture with the same shape the Category API is
 * expected to return. Replace this file (or its API source) without touching
 * any screen component.
 *
 * The Madfu catalogue is a different taxonomy from the government CR activity
 * list and the freelancing-certificate taxonomy. See `GOV_ACTIVITY_TO_MADFU`.
 */
import type { ApplicantType } from './config';

export type Eligibility = 'ALLOWED' | 'BLOCKED' | 'CR_ONLY' | 'MANUAL_REVIEW';

export interface Subcategory {
  subcategoryId: string;
  subcategoryName: string;
  eligibility: Eligibility;
  permittedApplicantTypes: ApplicantType[];
  manualReviewRequired: boolean;
}

export interface Category {
  categoryId: string;
  categoryName: string;
  subcategories: Subcategory[];
}

const both: ApplicantType[] = ['CR', 'FREELANCER'];
const crOnly: ApplicantType[] = ['CR'];

const sub = (id: string, name: string, eligibility: Eligibility = 'ALLOWED'): Subcategory => ({
  subcategoryId: id,
  subcategoryName: name,
  eligibility,
  permittedApplicantTypes: eligibility === 'CR_ONLY' ? crOnly : both,
  manualReviewRequired: eligibility === 'MANUAL_REVIEW',
});

export const CATEGORY_CATALOGUE: Category[] = [
  {
    categoryId: 'C10',
    categoryName: 'Retail',
    subcategories: [sub('C10-01', 'Fashion & apparel'), sub('C10-02', 'Electronics & accessories'), sub('C10-03', 'Home & furniture')],
  },
  {
    categoryId: 'C20',
    categoryName: 'Health & beauty',
    subcategories: [sub('C20-01', 'Cosmetics & personal care'), sub('C20-02', 'Medical & dental clinics', 'CR_ONLY')],
  },
  {
    categoryId: 'C30',
    categoryName: 'Education & training',
    subcategories: [sub('C30-01', 'Private tutoring'), sub('C30-02', 'Licensed training centres', 'CR_ONLY')],
  },
  {
    categoryId: 'C40',
    categoryName: 'Professional & creative services',
    subcategories: [sub('C40-01', 'Graphic & digital design'), sub('C40-02', 'Photography & videography'), sub('C40-03', 'Business consulting')],
  },
  {
    categoryId: 'C50',
    categoryName: 'Events & hospitality',
    subcategories: [sub('C50-01', 'Event planning'), sub('C50-02', 'Fixture — subcategory requiring business review', 'MANUAL_REVIEW')],
  },
  {
    categoryId: 'C90',
    categoryName: 'Fixture — restricted demo category',
    subcategories: [sub('C90-01', 'Fixture — restricted subcategory A', 'BLOCKED'), sub('C90-02', 'Fixture — restricted subcategory B', 'BLOCKED')],
  },
];

export function findSubcategory(subcategoryId?: string): { category: Category; subcategory: Subcategory } | undefined {
  if (!subcategoryId) return undefined;
  for (const category of CATEGORY_CATALOGUE) {
    const subcategory = category.subcategories.find((s) => s.subcategoryId === subcategoryId);
    if (subcategory) return { category, subcategory };
  }
  return undefined;
}

/**
 * FIXTURE mapping from freelancing-certificate activity codes to the Madfu
 * catalogue. Government and Madfu taxonomies do not share IDs; this mapping
 * table is the reconciliation seam (PROVISIONAL, D-06). `null` = unmapped.
 */
export const GOV_ACTIVITY_TO_MADFU: Record<string, string | null> = {
  'FL-DES-01': 'C40-01',
  'FL-PHO-01': 'C40-02',
  'FL-CON-01': 'C40-03',
  'FL-EDU-01': 'C30-01',
  'FL-FAS-01': 'C10-01',
  'FL-RST-01': 'C90-01',
  'FL-UNK-99': null,
};
