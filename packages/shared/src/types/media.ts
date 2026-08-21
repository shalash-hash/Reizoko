export interface MediaItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  localPath: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}
