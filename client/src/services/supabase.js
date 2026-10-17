import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Validate if environment variables are set and not placeholder
export const isSupabaseConfigured = () => {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes('your-project-id') &&
    supabaseUrl.startsWith('https://')
  );
};

// Safe fallback client initialization to prevent app crash if keys are being configured
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder-key',
      {
        auth: {
          persistSession: false
        }
      }
    );

// Test database connection helper
export const testSupabaseConnection = async () => {
  if (!isSupabaseConfigured()) {
    return {
      connected: false,
      message: 'Supabase credentials are not configured in client/.env. Please provide VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
    };
  }

  try {
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    if (error) {
      // If table doesn't exist yet, we still reached the database
      if (error.code === '42P01') {
        return {
          connected: true,
          tablesMissing: true,
          message: 'Connected to Supabase! The database schema has not been executed yet. Please run supabase/schema.sql in the Supabase SQL Editor.'
        };
      }
      return {
        connected: false,
        message: `Connection error: ${error.message} (Code: ${error.code})`
      };
    }
    return {
      connected: true,
      tablesMissing: false,
      message: 'Successfully connected to Supabase database!'
    };
  } catch (err) {
    return {
      connected: false,
      message: `Network or configuration error: ${err.message}`
    };
  }
};

// Upload user profile image to Supabase Storage avatars bucket
export const uploadAvatarToSupabase = async (file, userId) => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  const fileExt = (file.name || 'image.png').split('.').pop() || 'png';
  const cleanId = (userId || 'user').replace(/[^a-zA-Z0-9_-]/g, '');
  const fileName = `${cleanId}_${Date.now()}.${fileExt}`;
  const filePath = `avatars/${fileName}`;

  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
};
