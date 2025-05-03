import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface MultiFileUploadProps {
  onFilesSelect: (files: File[]) => void;
  acceptedFileTypes?: string;
  maxSize?: number; // in bytes
  className?: string;
  children?: React.ReactNode;
  dropzoneText?: string;
  fileTypeText?: string;
}

export function MultiFileUpload({
  onFilesSelect,
  acceptedFileTypes = 'image/*',
  maxSize = 10 * 1024 * 1024, // 10MB default
  className,
  children,
  dropzoneText = 'Drag and drop your files here',
  fileTypeText = 'PNG, JPG, GIF up to 10MB',
}: MultiFileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<{
    file: File;
    preview: string;
  }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    
    if (acceptedFiles.length > 0) {
      // Process each file and create previews
      const newFiles = acceptedFiles.map(file => {
        // Create and store the preview URL
        const previewUrl = URL.createObjectURL(file);
        return { file, preview: previewUrl };
      });
      
      // Update state with new files
      setSelectedFiles(prev => [...prev, ...newFiles]);
      
      // Call the parent callback with all files
      onFilesSelect([...selectedFiles.map(f => f.file), ...acceptedFiles]);
    }
  }, [onFilesSelect, selectedFiles]);

  // Remove a file from the selection
  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      // Clean up the preview URL to prevent memory leaks
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      
      // Update the parent with the new files list
      onFilesSelect(newFiles.map(f => f.file));
      
      return newFiles;
    });
  };
  
  // Clean up preview URLs when component unmounts
  React.useEffect(() => {
    return () => {
      selectedFiles.forEach(file => {
        URL.revokeObjectURL(file.preview);
      });
    };
  }, [selectedFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      [acceptedFileTypes]: []
    },
    maxSize,
    multiple: true, // Allow multiple file selection
    onDropRejected: (fileRejections) => {
      const messages = fileRejections.map(rejection => {
        if (rejection.errors[0].code === 'file-too-large') {
          return `${rejection.file.name} is too large. Maximum size is ${maxSize / (1024 * 1024)}MB.`;
        } else if (rejection.errors[0].code === 'file-invalid-type') {
          return `${rejection.file.name} has an invalid file type. Accepted types: ${acceptedFileTypes}`;
        } else {
          return `${rejection.file.name}: ${rejection.errors[0].message}`;
        }
      });
      
      setError(messages.join(", "));
    }
  });

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={cn(
          'flex justify-center px-6 py-6 border-2 border-dashed rounded-md transition-colors',
          isDragActive 
            ? 'border-primary bg-blue-100/80 text-primary-dark' 
            : 'border-primary/40 hover:border-primary bg-blue-50/80 text-primary-dark',
          'cursor-pointer'
        )}
      >
        <div className="space-y-1 text-center">
          <svg className="mx-auto h-12 w-12 text-primary/60" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex text-sm text-neutral-700">
            <label className="relative cursor-pointer rounded-md font-medium text-primary hover:text-primary-light">
              <span>Upload files</span>
              <input {...getInputProps()} />
            </label>
            <p className="pl-1">or drag and drop</p>
          </div>
          <p className="text-xs text-neutral-600">{fileTypeText}</p>
          {error && <p className="text-xs text-destructive mt-2">{error}</p>}
        </div>
      </div>
      
      {/* Preview area for selected files */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium">Selected files ({selectedFiles.length})</h4>
          <div className="flex flex-wrap gap-3">
            {selectedFiles.map((file, index) => (
              <div key={index} className="relative w-20 h-20 rounded overflow-hidden border">
                <img
                  src={file.preview}
                  alt={file.file.name}
                  className="h-full w-full object-cover"
                />
                <button
                  onClick={() => removeFile(index)}
                  className="absolute top-0 right-0 bg-black/70 text-white p-1 w-6 h-6 flex items-center justify-center"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-1 py-0.5 truncate">
                  {file.file.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {children}
    </div>
  );
}

export default MultiFileUpload;