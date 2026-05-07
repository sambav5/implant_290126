import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, FileText, Eye, Download, Trash2, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { caseFilesApi } from '@/services/api';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'PRE_OP', label: 'PRE-OP IMAGES' },
  { value: 'POST_OP', label: 'POST-OP IMAGES' },
  { value: 'XRAY', label: 'XRAY' },
  { value: 'CBCT', label: 'CBCT' },
  { value: 'MEDICAL_RECORD', label: 'MEDICAL RECORDS' },
  { value: 'LAB_FILE', label: 'LAB FILES' },
  { value: 'OTHER', label: 'OTHER' },
];

const PREVIEWABLE_IMAGES = ['jpg', 'jpeg', 'png'];

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function CaseFilesTab({ caseId, canDeleteFiles }) {
  const [filesByCategory, setFilesByCategory] = useState({});
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('XRAY');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const fileInputRef = useRef(null);
  
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

  const loadFiles = async () => {
    try {
      const response = await caseFilesApi.getByCase(caseId);
      setFilesByCategory(response.data.files || {});
    } catch (e) {
      toast.error('Failed to load case files');
    }
  };

  useEffect(() => {
    loadFiles();
  }, [caseId]);

  const handleUpload = async (fileList) => {
    if (!fileList?.length) return;
    
    // Client-side validation
    const oversizedFiles = [];
    const validFiles = [];
    
    for (const file of fileList) {
      if (file.size > MAX_FILE_SIZE) {
        oversizedFiles.push(file.name);
      } else {
        validFiles.push(file);
      }
    }
    
    if (oversizedFiles.length > 0) {
      toast.error(`Files exceed 50MB limit: ${oversizedFiles.join(', ')}`);
      if (validFiles.length === 0) return;
    }
    
    setUploading(true);
    const results = { success: [], failed: [] };
    
    try {
      for (const file of validFiles) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('category', selectedCategory);
          await caseFilesApi.upload(caseId, formData);
          results.success.push(file.name);
        } catch (e) {
          results.failed.push({ name: file.name, error: e?.response?.data?.detail || 'Unknown error' });
        }
      }
      
      if (results.success.length > 0) {
        toast.success(`${results.success.length} file(s) uploaded successfully`);
      }
      if (results.failed.length > 0) {
        toast.error(`Failed to upload: ${results.failed.map(f => f.name).join(', ')}`);
      }
      
      loadFiles();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const allGroups = useMemo(() => {
    const groups = {};
    CATEGORIES.forEach((c) => {
      groups[c.value] = filesByCategory[c.value] || [];
    });
    return groups;
  }, [filesByCategory]);

  const confirmDelete = (file) => {
    setFileToDelete(file);
    setDeleteConfirmOpen(true);
  };

  const deleteFile = async () => {
    if (!fileToDelete) return;
    
    try {
      await caseFilesApi.delete(fileToDelete.id);
      toast.success('File deleted successfully');
      loadFiles();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to delete file');
    } finally {
      setDeleteConfirmOpen(false);
      setFileToDelete(null);
    }
  };

  const onDrop = (event) => {
    event.preventDefault();
    handleUpload(event.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      <div className="card-clinical">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <h3 className="font-medium">Case File Hub</h3>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-[#E5E7EB] rounded-md bg-white text-[#1A1A1A] text-sm focus:outline-none focus:ring-2 focus:ring-[#1F7A63]"
            >
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="h-4 w-4 mr-2" /> Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => handleUpload(e.target.files)}
            />
          </div>
        </div>

        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className="mt-4 border-2 border-dashed border-[#E5E7EB] rounded-xl p-8 text-center bg-[#F9FAFB] hover:bg-[#F3F4F6] transition-colors"
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <Upload className="h-8 w-8 text-[#9CA3AF]" />
            <p className="text-sm font-medium text-[#4B5563]">Drag & drop files here, or use Upload button</p>
            <p className="text-xs text-[#9CA3AF]">Maximum file size: 50MB</p>
          </div>
        </div>
      </div>

      {CATEGORIES.map((category) => (
        <div key={category.value} className="card-clinical">
          <h4 className="font-semibold text-lg text-[#1A1A1A] mb-4">{category.label}</h4>
          {(allGroups[category.value] || []).length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">No files uploaded.</p>
          ) : (
            <div className="space-y-3">
              {allGroups[category.value].map((item) => {
                const lowerType = (item.fileType || '').toLowerCase();
                const canPreviewImage = PREVIEWABLE_IMAGES.includes(lowerType);
                return (
                  <div key={item.id} className="p-4 rounded-xl border border-[#E5E7EB] flex flex-wrap items-center justify-between gap-4 bg-white hover:border-[#D1D5DB] transition-colors">
                    <div className="min-w-0">
                      <div className="font-medium text-[#1A1A1A] truncate">{item.fileName}</div>
                      <div className="text-xs text-[#6B7280] mt-1">
                        {new Date(item.uploadedAt).toLocaleString()} • {item.uploadedByName} • {formatBytes(item.fileSize)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canPreviewImage ? (
                        <Button size="sm" variant="outline" onClick={() => setPreviewUrl(item.storageUrl)}>
                          <ImageIcon className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                      ) : lowerType === 'pdf' ? (
                        <Button size="sm" variant="outline" onClick={() => window.open(item.storageUrl, '_blank')}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                      ) : null}
                      <Button size="sm" variant="outline" onClick={() => window.open(item.storageUrl, '_blank')}>
                        <Download className="h-3.5 w-3.5 mr-1" /> Download
                      </Button>
                      {canDeleteFiles && (
                        <Button size="sm" variant="destructive" onClick={() => confirmDelete(item)}>
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {previewUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <button className="absolute top-6 right-6 text-white hover:text-gray-300 transition-colors" onClick={() => setPreviewUrl(null)}>
            <X className="h-8 w-8" />
          </button>
          <img src={previewUrl} alt="preview" className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl" />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-xl font-semibold text-[#1A1A1A] mb-2">Delete File?</h3>
            <p className="text-sm text-[#6B7280] mb-6">
              Are you sure you want to delete <strong className="text-[#1A1A1A] font-medium">{fileToDelete?.fileName}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setFileToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button 
                className="bg-red-600 hover:bg-red-700 text-white" 
                onClick={deleteFile}
              >
                Delete File
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
