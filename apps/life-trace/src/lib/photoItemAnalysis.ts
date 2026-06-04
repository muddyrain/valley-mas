import { buildDefaultPantryReminder } from '@/lib/pantry';
import type {
  NewPantryItemInput,
  PantryCategory,
  PantryLocation,
  PantryPreferences,
} from '@/types';

export type PhotoItemDraftForm = {
  name: string;
  category: PantryCategory;
  quantity: string;
  unit: string;
  location: PantryLocation;
  expiresAt: string;
  openedAt: string;
  note: string;
  householdId: string;
  reminderEnabled: boolean;
};

type BuildPhotoItemPantryInputOptions = {
  form: PhotoItemDraftForm;
  pantryPreferences: PantryPreferences;
  uploadedImageUrl: string;
};

export function buildPhotoItemPantryInput({
  form,
  pantryPreferences,
  uploadedImageUrl,
}: BuildPhotoItemPantryInputOptions): NewPantryItemInput {
  const expiresAt = form.expiresAt.trim();
  const openedAt = form.openedAt.trim();

  return {
    householdId: form.householdId || undefined,
    name: form.name.trim(),
    category: form.category,
    quantity: Number.parseInt(form.quantity, 10) || 1,
    unit: form.unit.trim() || '件',
    location: form.location,
    expiresAt: expiresAt || undefined,
    openedAt: openedAt || undefined,
    note: form.note.trim(),
    imageUrl: uploadedImageUrl || undefined,
    thumbnailUrl: undefined,
    status: 'normal',
    reminder: buildDefaultPantryReminder(
      pantryPreferences,
      Boolean(expiresAt) && form.reminderEnabled,
    ),
  };
}
