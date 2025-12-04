import { useState } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface FileUploadProps {
  label: string;
  accept?: string;
  multiple?: boolean;
  files: string[];
  onFilesChange: (files: string[]) => void;
}

export function FileUpload({ label, accept = '.png,.jpg,.jpeg,.pdf', multiple = true, files, onFilesChange }: FileUploadProps) {
  const [previews, setPreviews] = useState<Array<{ type: string; data: string }>>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    if (selectedFiles.length === 0) return;

    const readers = selectedFiles.map(file => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve(event.target?.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers)
      .then(results => {
        const newFiles = [...files, ...results];
        onFilesChange(newFiles);
        
        const newPreviews = results.map(data => ({
          type: data.startsWith('data:image') ? 'image' : 'pdf',
          data
        }));
        setPreviews([...previews, ...newPreviews]);
        
        toast.success(`${selectedFiles.length} file(s) uploaded`);
      })
      .catch(error => {
        console.error('File upload error:', error);
        toast.error('Failed to upload files');
      });
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    onFilesChange(newFiles);
    setPreviews(newPreviews);
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2">
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileChange}
          className="hidden"
          id={`file-upload-${label}`}
        />
        <label htmlFor={`file-upload-${label}`}>
          <Button type="button" variant="outline" className="w-full" asChild>
            <span>
              <Upload className="w-4 h-4 mr-2" />
              Upload Files (PNG, JPG, PDF)
            </span>
          </Button>
        </label>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, index) => {
            const isImage = file.startsWith('data:image');
            return (
              <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                {isImage ? (
                  <ImageIcon className="w-4 h-4 text-blue-600" />
                ) : (
                  <FileText className="w-4 h-4 text-red-600" />
                )}
                <span className="flex-1 text-sm truncate">
                  {isImage ? 'Image' : 'PDF'} file {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveFile(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
