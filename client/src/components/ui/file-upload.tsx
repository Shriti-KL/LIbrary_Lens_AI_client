import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  acceptedFileTypes?: string;
  maxSize?: number; // in bytes
  className?: string;
  children?: React.ReactNode;
  dropzoneText?: string;
  fileTypeText?: string;
}

export function FileUpload({
  onFileSelect,
  acceptedFileTypes = 'image/*',
  maxSize = 10 * 1024 * 1024, // 10MB default
  className,
  children,
  dropzoneText = 'Drag and drop your file here',
  fileTypeText = 'PNG, JPG, GIF up to 10MB',
}: FileUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      onFileSelect(file);
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPreview(null);
      }
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      [acceptedFileTypes]: []
    },
    maxSize,
    multiple: false,
    onDropRejected: (fileRejections) => {
      const rejection = fileRejections[0];
      if (rejection.errors[0].code === 'file-too-large') {
        setError(`File is too large. Maximum size is ${maxSize / (1024 * 1024)}MB.`);
      } else if (rejection.errors[0].code === 'file-invalid-type') {
        setError(`Invalid file type. Accepted types: ${acceptedFileTypes}`);
      } else {
        setError(rejection.errors[0].message);
      }
    }
  });

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={cn(
          'flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors',
          isDragActive 
            ? 'border-primary bg-primary/5' 
            : 'border-neutral-100 hover:border-primary/50',
          'cursor-pointer'
        )}
      >
        <div className="space-y-1 text-center">
          {preview ? (
            <div className="mx-auto h-24 w-24 mb-2 relative">
              <img 
                src={preview} 
                alt="File preview" 
                className="h-full w-full object-cover rounded-md"
              />
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setPreview(null);
                }}
                className="absolute -top-2 -right-2 bg-primary text-white rounded-full p-1 w-6 h-6 flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ) : (
            <svg className="mx-auto h-12 w-12 text-neutral-300" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <div className="flex text-sm text-neutral-500">
            <label className="relative cursor-pointer rounded-md font-medium text-primary hover:text-primary-light">
              <span>Upload a file</span>
              <input {...getInputProps()} />
            </label>
            <p className="pl-1">or drag and drop</p>
          </div>
          <p className="text-xs text-neutral-500">{fileTypeText}</p>
          {error && <p className="text-xs text-destructive mt-2">{error}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export default FileUpload;
