'use client';

import React, { useRef, useState, useCallback } from 'react';
import { Upload, X, File, Image as ImageIcon, Video, FileText, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { THEME } from '../../lib/theme';
import { formatFileSize, validateFileType, validateFileSize, validateTotalFileSize, MAX_FILE_SIZE, MAX_TOTAL_SIZE } from '../../lib/validation';

export interface FileWithStatus {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'processing' | 'ready' | 'error';
  progress?: number;
  error?: string;
  preview?: string;
}

interface FileUploadProps {
  files: FileWithStatus[];
  onFilesChange: (files: FileWithStatus[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  files,
  onFilesChange,
  maxFiles = 10,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return ImageIcon;
    if (file.type.startsWith('video/')) return Video;
    return FileText;
  };

  const generatePreview = (file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        resolve(undefined);
      }
    });
  };

  const validateAndAddFiles = useCallback(async (newFiles: File[]) => {
    const errors: string[] = [];
    const validFiles: FileWithStatus[] = [];

    // Check total size
    const totalSizeError = validateTotalFileSize([...files.map(f => f.file), ...newFiles]);
    if (totalSizeError) {
      errors.push(totalSizeError);
    }

    for (const file of newFiles) {
      // Check file type
      const typeError = validateFileType(file);
      if (typeError) {
        errors.push(`${file.name}: ${typeError}`);
        continue;
      }

      // Check file size
      const sizeError = validateFileSize(file);
      if (sizeError) {
        errors.push(`${file.name}: ${sizeError}`);
        continue;
      }

      // Check max files
      if (files.length + validFiles.length >= maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
        break;
      }

      const preview = await generatePreview(file);
      validFiles.push({
        file,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        status: 'pending',
        preview,
      });
    }

    if (errors.length > 0) {
      setDragError(errors[0]);
      setTimeout(() => setDragError(null), 5000);
    }

    if (validFiles.length > 0) {
      onFilesChange([...files, ...validFiles]);
    }
  }, [files, maxFiles, onFilesChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      validateAndAddFiles(droppedFiles);
    }
  }, [disabled, validateAndAddFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      validateAndAddFiles(selectedFiles);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [validateAndAddFiles]);

  const removeFile = (id: string) => {
    onFilesChange(files.filter(f => f.id !== id));
  };

  const totalSize = files.reduce((sum, f) => sum + f.file.size, 0);
  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
  const maxSizeMB = (MAX_TOTAL_SIZE / (1024 * 1024)).toFixed(0);

  return (
    <div className="space-y-4">
      {/* Drag and Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400 hover:bg-gray-50'}
        `}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.txt,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4,.mov,.mkv,.avi"
          disabled={disabled}
        />
        
        <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            {isDragging ? 'Drop files here' : 'Click to upload or drag and drop'}
          </p>
          <p className="text-xs text-gray-500">
            Documents: PDF, TXT, DOCX, XLSX | Images: JPG, PNG, GIF | Videos: MP4, MOV, MKV, AVI
          </p>
          <p className="text-xs text-gray-400">
            Max 250MB per file, {maxSizeMB}MB total
          </p>
        </div>
      </div>

      {/* Error Message */}
      {dragError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-600">{dragError}</p>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              Selected Files ({files.length})
            </p>
            <p className="text-xs text-gray-500">
              Total: {totalSizeMB}MB / {maxSizeMB}MB
            </p>
          </div>
          
          <div className="space-y-2">
            {files.map((fileWithStatus) => {
              const FileIcon = getFileIcon(fileWithStatus.file);
              const statusColors = {
                pending: 'text-gray-500',
                uploading: 'text-blue-500',
                processing: 'text-yellow-500',
                ready: 'text-green-500',
                error: 'text-red-500',
              };

              return (
                <div
                  key={fileWithStatus.id}
                  className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:shadow-md transition-shadow"
                  style={{ borderColor: THEME.colors.light }}
                >
                  {/* Preview/Icon */}
                  <div className="flex-shrink-0">
                    {fileWithStatus.preview ? (
                      <img
                        src={fileWithStatus.preview}
                        alt={fileWithStatus.file.name}
                        className="w-12 h-12 rounded object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded flex items-center justify-center bg-gray-100">
                        <FileIcon className="w-6 h-6 text-gray-600" />
                      </div>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate" title={fileWithStatus.file.name}>
                      {fileWithStatus.file.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-500">
                        {formatFileSize(fileWithStatus.file.size)}
                      </p>
                      <span className="text-xs text-gray-400">•</span>
                      <div className="flex items-center gap-1">
                        {fileWithStatus.status === 'uploading' && (
                          <>
                            <Loader className={`w-3 h-3 animate-spin ${statusColors[fileWithStatus.status]}`} />
                            <span className={`text-xs ${statusColors[fileWithStatus.status]}`}>
                              Uploading {fileWithStatus.progress}%
                            </span>
                          </>
                        )}
                        {fileWithStatus.status === 'processing' && (
                          <>
                            <Loader className={`w-3 h-3 animate-spin ${statusColors[fileWithStatus.status]}`} />
                            <span className={`text-xs ${statusColors[fileWithStatus.status]}`}>Processing</span>
                          </>
                        )}
                        {fileWithStatus.status === 'ready' && (
                          <>
                            <CheckCircle className={`w-3 h-3 ${statusColors[fileWithStatus.status]}`} />
                            <span className={`text-xs ${statusColors[fileWithStatus.status]}`}>Ready</span>
                          </>
                        )}
                        {fileWithStatus.status === 'error' && (
                          <>
                            <AlertCircle className={`w-3 h-3 ${statusColors[fileWithStatus.status]}`} />
                            <span className={`text-xs ${statusColors[fileWithStatus.status]}`}>
                              {fileWithStatus.error || 'Error'}
                            </span>
                          </>
                        )}
                        {fileWithStatus.status === 'pending' && (
                          <span className={`text-xs ${statusColors[fileWithStatus.status]}`}>Pending</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => removeFile(fileWithStatus.id)}
                    disabled={disabled || fileWithStatus.status === 'uploading'}
                    className="flex-shrink-0 p-2 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Remove file"
                  >
                    <X className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};



