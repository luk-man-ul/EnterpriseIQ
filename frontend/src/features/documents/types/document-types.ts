export type DocumentStatus = "Pending" | "Processing" | "Completed" | "Failed";

export interface DocumentListItem {
  documentId: string;
  filename: string;
  createdAt: string;
  status: DocumentStatus;
}

export interface DocumentPagination {
  page: number;
  limit: number;
  totalCount: number;
}

export interface DocumentListData {
  documents: DocumentListItem[];
  pagination: DocumentPagination;
}

export interface DocumentDetails {
  documentId: string;
  filename: string;
  status: DocumentStatus;
  fileSize: number;
  uploadedById: string;
  departmentId: string | null;
}

export interface RoleItem {
  roleId: string;
  name: string;
  description: string;
}

export interface DocumentCapabilities {
  canUploadDocuments: boolean;
  canDeleteDocuments: boolean;
}
