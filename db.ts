import { supabase } from './supabaseClient';

// جلب كل البيانات من جدول معين
export const getAll = async (tableName: string) => {
  const { data, error } = await supabase.from(tableName).select('*');
  if (error) {
    console.error(`Error fetching ${tableName}:`, error);
    return [];
  }
  return data;
};

// حفظ أو تحديث عنصر
export const saveItem = async (tableName: string, item: any) => {
  const { error } = await supabase.from(tableName).upsert(item);
  if (error) console.error(`Error saving to ${tableName}:`, error);
};

// حذف عنصر
export const deleteItem = async (tableName: string, id: string) => {
  await supabase.from(tableName).delete().eq('id', id);
};
