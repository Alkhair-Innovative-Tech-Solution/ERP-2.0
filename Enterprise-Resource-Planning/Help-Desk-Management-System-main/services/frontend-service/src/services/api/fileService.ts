/**
 * File Service API Client
 * Handles file uploads and downloads via file-service
 */
import { apiClient } from './axiosClient';
import { ENV } from '../../config/env';

export interface UploadResponse {
    id: string; // uuid
    url: string;
    filename: string;
    size: number;
    content_type: string;
    key: string; // S3/MinIO key
    scan_status?: 'pending' | 'clean' | 'infected' | 'failed';
}

class FileService {
    /**
     * Upload a file
     * @param file File object
     * @param purpose Optional purpose tag (e.g., 'ticket_attachment', 'avatar')
     * @param ticketId Optional ticket ID to associate with
     * @param onProgress Progress callback
     */
    async uploadFile(
        file: File,
        purpose: string = 'general',
        ticketId?: string,
        onProgress?: (percent: number) => void
    ): Promise<UploadResponse> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', purpose);

        if (ticketId) {
            formData.append('ticket_id', ticketId);
        }

        try {
            // Use relative URL to ensure it goes through the Next.js proxy/rewrite
            const url = `/api/v1/files/upload`;

            // Explicitly get token to ensure it's sent with the request
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            const headers: Record<string, string> = {}; // Let Axios set Content-Type with boundary
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await apiClient.post<UploadResponse>(url, formData, {
                headers,
                onUploadProgress: (progressEvent: any) => {
                    if (onProgress && progressEvent.total) {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        onProgress(percentCompleted);
                    }
                },
            });
            return response;
        } catch (error) {
            console.error('File upload failed:', error);
            throw error;
        }

    }

    /**
     * Get file URL (if private/signed URL needed)
     */
    getFileUrl(fileId: string): string {
        return `/api/v1/files/${fileId}/download`;
    }
}

export const fileService = new FileService();
export default fileService;

