import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { socialPostApi } from '@/api/socialPostApi';
import { generatePostImage, PLATFORM_FORMATS } from '@/utils/generatePostImage';
import ImageSelector from './ImageSelector';
import PostPreview from './PostPreview';
import CaptionBox from './CaptionBox';
import { ROLES } from '@/utils/rolePermissions';

const generateCaption = (clinicianName = 'Clinician') => `Smile transformation ✨\n\nPatient presented with functional and aesthetic concerns.\n\nTreatment followed a structured restorative workflow focused on long-term oral health outcomes.\n\nPre-operative condition → compromised function and appearance\nPost-treatment result → improved function and esthetics\n\nTreatment by Dr. ${clinicianName}\n\n#Dentistry #SmileTransformation #DentalCare`;

export default function SocialPostGenerator({ caseId, caseData, activeRole }) {
  const [loading, setLoading] = useState(true);
  const [selectedFormat, setSelectedFormat] = useState('instagram_portrait');
  const [files, setFiles] = useState({});
  const [selectedPreOp, setSelectedPreOp] = useState(null);
  const [selectedPostOp, setSelectedPostOp] = useState(null);
  const [generated, setGenerated] = useState(null);
  const [caption, setCaption] = useState(generateCaption(caseData?.clinician?.name));
  const [generating, setGenerating] = useState(false);

  const canGenerate = activeRole === ROLES.CLINICIAN;

  const loadFiles = async () => {
    setLoading(true);
    try {
      const grouped = await socialPostApi.getCaseImages(caseId);
      setFiles(grouped);
    } catch (error) {
      toast.error('Failed to load case images');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFiles(); }, [caseId]);

  const preOpImages = useMemo(() => files.PRE_OP || [], [files]);
  const postOpImages = useMemo(() => files.POST_OP || [], [files]);

  const handleGenerate = async () => {
    if (!selectedPreOp || !selectedPostOp) {
      toast.error('Please select one Pre-Op and one Post-Op image');
      return;
    }
    setGenerating(true);
    try {
      if (generated?.url) URL.revokeObjectURL(generated.url);
      const result = await generatePostImage({
        preOpUrl: selectedPreOp.storageUrl,
        postOpUrl: selectedPostOp.storageUrl,
        format: selectedFormat,
        clinicName: caseData?.clinicName || 'Dental Clinic',
        clinicianName: caseData?.clinician?.name || 'Clinician',
      });
      setGenerated(result);
      setCaption(generateCaption(caseData?.clinician?.name));
      await socialPostApi.saveGenerationMeta({ caseId, generatedBy: caseData?.clinician?.id || 'clinician', imageUrl: result.url });
      toast.success('Post generated successfully');
    } catch (error) {
      toast.error(error.message || 'Image generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generated?.url) return;
    const link = document.createElement('a');
    link.href = generated.url;
    link.download = `case-${caseId}-${selectedFormat}.png`;
    link.click();
  };

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      toast.success('Caption copied');
    } catch {
      toast.error('Unable to copy caption');
    }
  };

  if (activeRole === ROLES.ASSISTANT) {
    return <div className="card-clinical">Assistant role does not have access to social media post generation.</div>;
  }

  if (loading) {
    return <div className="card-clinical">Loading social post assets...</div>;
  }

  if (!preOpImages.length || !postOpImages.length) {
    return (
      <div className="card-clinical">
        Please upload at least one Pre-Op and one Post-Op image in the Files section.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card-clinical space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-semibold">Social Media Post</h3>
          {!canGenerate && <span className="text-xs" style={{ color: 'var(--t3)' }}>View-only access for this role</span>}
        </div>

        <ImageSelector
          preOpImages={preOpImages}
          postOpImages={postOpImages}
          selectedPreOp={selectedPreOp}
          selectedPostOp={selectedPostOp}
          onSelectPreOp={setSelectedPreOp}
          onSelectPostOp={setSelectedPostOp}
        />

        <div className="space-y-2">
          <h4 className="font-medium">Generate Post For</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(PLATFORM_FORMATS).map(([key, cfg]) => (
              <label key={key} className="border rounded-lg p-3 flex items-center gap-2" style={{ borderColor: selectedFormat === key ? 'var(--green)' : 'var(--border)' }}>
                <input type="radio" checked={selectedFormat === key} onChange={() => setSelectedFormat(key)} />
                <span className="text-sm">{cfg.label} ({cfg.width} x {cfg.height})</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleGenerate} disabled={!canGenerate || generating}>{generating ? 'Generating...' : 'Generate Post'}</Button>
          <Button variant="outline" onClick={handleDownload} disabled={!canGenerate || !generated?.url}>Download Image</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card-clinical">
          <PostPreview imageUrl={generated?.url} aspectRatio={generated?.aspectRatio || PLATFORM_FORMATS[selectedFormat].aspectRatio} />
        </div>
        <div className="card-clinical">
          <CaptionBox
            caption={caption}
            onCopy={handleCopyCaption}
            onRegenerate={() => setCaption(generateCaption(caseData?.clinician?.name))}
            canGenerate={canGenerate}
          />
        </div>
      </div>
    </div>
  );
}
