import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Image as ImageIcon, FileText, X, Download, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';

interface AttachmentViewerProps {
  attachments: string[];
  title?: string;
}

export function AttachmentViewer({ attachments, title = 'Attachments' }: AttachmentViewerProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const handleImageClick = (url: string) => {
    if (!url || typeof url !== 'string') {
      console.error('Invalid URL provided:', url);
      return;
    }
    
    if (url.startsWith('data:image') || url.startsWith('data:image/')) {
      setSelectedImage(url);
      setPreviewOpen(true);
    } else if (url.startsWith('data:application/pdf') || url.startsWith('data:application/pdf;base64') || url.endsWith('.pdf')) {
      // For PDFs, open in new tab
      try {
        window.open(url, '_blank');
      } catch (error) {
        console.error('Error opening PDF:', error);
        // Fallback: try to download
        handleDownload(url, 0);
      }
    } else {
      // For other files, try to open or download
      try {
        window.open(url, '_blank');
      } catch (error) {
        console.error('Error opening file:', error);
      }
    }
  };

  const handleDownload = (url: string, index: number) => {
    if (!url || typeof url !== 'string') {
      console.error('Invalid URL for download:', url);
      return;
    }
    
    try {
      const link = document.createElement('a');
      link.href = url;
      
      // Determine file extension
      let extension = 'pdf';
      if (url.startsWith('data:image') || url.startsWith('data:image/')) {
        const match = url.match(/data:image\/(\w+);/);
        extension = match ? match[1] : 'png';
      } else if (url.startsWith('data:application/pdf')) {
        extension = 'pdf';
      } else if (url.match(/\.(jpg|jpeg|png|gif|webp|bmp|pdf)$/i)) {
        const match = url.match(/\.(\w+)$/i);
        extension = match ? match[1] : 'pdf';
      }
      
      link.download = `attachment-${index + 1}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  return (
    <>
      <div className="mt-2">
        <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">{title}</p>
        <div className="flex flex-wrap gap-3">
          {attachments.filter(url => url && typeof url === 'string').map((url, idx) => {
            // Better detection for base64 data URLs
            const isBase64Image = url.startsWith('data:image') || url.startsWith('data:image/');
            const isBase64PDF = url.startsWith('data:application/pdf') || url.startsWith('data:application/pdf;base64');
            const isImageFile = url.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i);
            const isPDFFile = url.endsWith('.pdf') || url.includes('application/pdf');
            
            const isImage = isBase64Image || !!isImageFile;
            const isPDF = isBase64PDF || isPDFFile;
            
            return (
              <div
                key={idx}
                className="relative group border rounded-lg overflow-hidden bg-gray-50 hover:shadow-md transition-shadow"
              >
                {isImage ? (
                  <div className="relative w-32 h-32">
                    <img
                      src={url}
                      alt={`Attachment ${idx + 1}`}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => handleImageClick(url)}
                      onError={(e) => {
                        // Fallback if image fails to load
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity flex items-center justify-center pointer-events-none">
                      <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {/* Download button - always visible, top-right with high z-index */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1 h-7 w-7 p-0 bg-blue-600 hover:bg-blue-700 text-white shadow-lg z-20 rounded-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleDownload(url, idx);
                      }}
                      title="Download Image"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    {/* Download button at bottom - always visible */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 z-20">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-6 px-2 text-white hover:text-white hover:bg-white/20 text-xs font-medium flex items-center justify-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleDownload(url, idx);
                        }}
                        title="Download Image"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </Button>
                    </div>
                  </div>
                ) : isPDF ? (
                  <div className="w-32 h-32 flex flex-col items-center justify-center p-4 cursor-pointer" onClick={() => handleImageClick(url)}>
                    <FileText className="w-12 h-12 text-blue-600 mb-2" />
                    <span className="text-xs text-gray-600 text-center">PDF File</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(url, idx);
                      }}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                  </div>
                ) : (
                  <div className="w-32 h-32 flex flex-col items-center justify-center p-4 cursor-pointer border border-gray-300 rounded" onClick={() => handleImageClick(url)}>
                    <FileText className="w-12 h-12 text-gray-600 mb-2" />
                    <span className="text-xs text-gray-600 text-center">File</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(url, idx);
                      }}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                  </div>
                )}
                {/* Attachment number label - only show if not image (images have download button at bottom) */}
                {!isImage && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center">
                    Attachment {idx + 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <div className="flex items-center justify-between">
              <DialogTitle>Image Preview</DialogTitle>
              {selectedImage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const index = attachments.findIndex(url => url === selectedImage);
                    if (index >= 0) {
                      handleDownload(selectedImage, index);
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Image
                </Button>
              )}
            </div>
          </DialogHeader>
          {selectedImage && (
            <div className="relative p-6 flex items-center justify-center bg-gray-100">
              <img
                src={selectedImage}
                alt="Preview"
                className="max-w-full max-h-[70vh] object-contain"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => setPreviewOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

