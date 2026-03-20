export interface Note {
  id: string;
  user_id?: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_local: boolean;
  is_favorite: boolean;
  local_path?: string; // For Android local storage tracking
  uri_path?: string; // For files picked via native picker
}

export interface AppSettings {
  darkMode: boolean;
  lineNumbers: boolean;
  localDirectoryUri?: string;
}
