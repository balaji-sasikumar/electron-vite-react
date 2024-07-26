export interface DirectoryItem {
  label: string;
  id?: string;
  children?: DirectoryItem[];
  level?: number;
}
