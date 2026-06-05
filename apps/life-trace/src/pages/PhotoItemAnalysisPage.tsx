import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  History,
  ImagePlus,
  PackageCheck,
  RefreshCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listHouseholds } from '@/api/household';
import {
  analyzePantryPhoto,
  type PantryPhotoAnalysisResponse,
  type PantryPhotoCropBox,
} from '@/api/pantry';
import { uploadLifeTraceImage } from '@/api/upload';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { FormItem } from '@/components/FormItem';
import { OptionPickerSheet } from '@/components/OptionPickerSheet';
import { PantryExpiryDateField } from '@/components/PantryExpiryDateField';
import { SectionHeader } from '@/components/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  buildPhotoItemAnalysisSmartSuggestions,
  buildPhotoItemMergedPantryInput,
  buildPhotoItemPantryInput,
  createPhotoItemAnalysisHistoryId,
  findPhotoItemAnalysisDuplicateCandidates,
  getLatestPhotoItemAnalysisDraft,
  getPhotoItemAnalysisReviewIssues,
  markPhotoItemAnalysisQualityFeedback,
  markPhotoItemAnalysisSaved,
  type PhotoItemAnalysisCoverMode,
  type PhotoItemAnalysisHistoryItem,
  type PhotoItemAnalysisQualityRating,
  type PhotoItemAnalysisReviewIssue,
  type PhotoItemAnalysisSmartSuggestion,
  type PhotoItemDraftForm,
  readPhotoItemAnalysisHistory,
  removePhotoItemAnalysisHistory,
  upsertPhotoItemAnalysisHistory,
} from '@/lib/photoItemAnalysis';
import { useAuthStore } from '@/store/useAuthStore';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { HouseholdSummary, PantryCategory, PantryLocation } from '@/types';

type CaptureState =
  | 'idle'
  | 'camera-ready'
  | 'captured'
  | 'uploading'
  | 'analyzing'
  | 'reviewing'
  | 'saving'
  | 'done'
  | 'error';

type DraftForm = PhotoItemDraftForm;

type CoverModeSelectorProps = {
  value: PhotoItemAnalysisCoverMode;
  disabled?: boolean;
  size?: 'md' | 'sm';
  onChange: (value: PhotoItemAnalysisCoverMode) => void;
};

const pantryCategories: PantryCategory[] = ['食品', '日用品', '药品', '宠物', '其他'];
const pantryLocations: PantryLocation[] = [
  '冷藏',
  '冷冻',
  '厨房',
  '储物柜',
  '卫生间',
  '玄关',
  '其他',
];
const categoryPickerOptions = pantryCategories.map((option) => ({ label: option, value: option }));
const locationPickerOptions = pantryLocations.map((option) => ({ label: option, value: option }));
const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];

const initialForm: DraftForm = {
  name: '',
  category: '食品',
  quantity: '1',
  unit: '件',
  location: '厨房',
  expiresAt: '',
  openedAt: '',
  note: '',
  householdId: '',
  reminderEnabled: true,
};

function buildAnalysisNote(result: PantryPhotoAnalysisResponse) {
  const parts = [
    result.summary,
    result.brand ? `品牌：${result.brand}` : '',
    result.spec ? `规格：${result.spec}` : '',
    result.tags?.length ? `标签：${result.tags.join('、')}` : '',
  ].filter(Boolean);
  return parts.join('\n');
}

function appendUniqueNoteLine(note: string, line: string) {
  const trimmed = note.trim();
  if (trimmed.includes(line)) {
    return note;
  }
  return [trimmed, line].filter(Boolean).join('\n');
}

function getFallbackFileName(file: File) {
  return file.name || `pantry-photo-${Date.now()}.jpg`;
}

function CoverModeSelector({
  value,
  disabled = false,
  size = 'md',
  onChange,
}: CoverModeSelectorProps) {
  const buttonClassName =
    size === 'sm'
      ? 'min-h-12 rounded-2xl border px-3 py-2 text-xs font-semibold transition'
      : 'min-h-14 rounded-2xl border px-3 py-2 text-sm font-semibold transition';

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        className={`${buttonClassName} flex flex-col items-center justify-center gap-0.5 ${
          value === 'crop'
            ? 'border-life-trace/40 bg-life-trace/10 text-life-trace'
            : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
        }`}
        disabled={disabled}
        onClick={() => onChange('crop')}
      >
        <span className="whitespace-nowrap">裁剪主体</span>
        <span className="whitespace-nowrap text-[10px] font-medium opacity-75">生成封面</span>
      </button>
      <button
        type="button"
        className={`${buttonClassName} flex flex-col items-center justify-center gap-0.5 ${
          value === 'original'
            ? 'border-life-ai/35 bg-life-ai/10 text-life-ai'
            : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
        }`}
        disabled={disabled}
        onClick={() => onChange('original')}
      >
        <span className="whitespace-nowrap">不裁剪</span>
        <span className="whitespace-nowrap text-[10px] font-medium opacity-75">使用原图</span>
      </button>
    </div>
  );
}

function clampRatio(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function normalizeCropBox(cropBox: PantryPhotoCropBox | undefined) {
  if (!cropBox) {
    return null;
  }

  const x = clampRatio(cropBox.x);
  const y = clampRatio(cropBox.y);
  const width = Math.min(1 - x, Math.max(0, cropBox.width));
  const height = Math.min(1 - y, Math.max(0, cropBox.height));
  if (width < 0.12 || height < 0.12) {
    return null;
  }
  return { x, y, width, height };
}

function isMeaningfulCropBox(cropBox: PantryPhotoCropBox | undefined) {
  const normalized = normalizeCropBox(cropBox);
  if (!normalized) {
    return false;
  }
  const area = normalized.width * normalized.height;
  const isGenericFallback =
    Math.abs(normalized.x - 0.1) < 0.035 &&
    Math.abs(normalized.y - 0.1) < 0.035 &&
    Math.abs(normalized.width - 0.8) < 0.05 &&
    Math.abs(normalized.height - 0.8) < 0.05;

  return (
    !isGenericFallback && area <= 0.58 && normalized.width <= 0.86 && normalized.height <= 0.86
  );
}

function buildCropBoxStyle(cropBox: PantryPhotoCropBox | undefined) {
  const normalized = normalizeCropBox(cropBox);
  if (!normalized) {
    return null;
  }
  return {
    left: `${normalized.x * 100}%`,
    top: `${normalized.y * 100}%`,
    width: `${normalized.width * 100}%`,
    height: `${normalized.height * 100}%`,
  };
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('裁剪预览生成失败，请保留原图后再保存。'));
    };
    image.src = url;
  });
}

async function createCroppedCoverFile(file: File, cropBox: PantryPhotoCropBox) {
  const normalized = normalizeCropBox(cropBox);
  if (!normalized) {
    throw new Error('AI 没有返回可用的主体裁剪区域。');
  }

  const image = await loadImageFromFile(file);
  const sourceX = Math.round(normalized.x * image.naturalWidth);
  const sourceY = Math.round(normalized.y * image.naturalHeight);
  const sourceWidth = Math.max(1, Math.round(normalized.width * image.naturalWidth));
  const sourceHeight = Math.max(1, Math.round(normalized.height * image.naturalHeight));
  const scale = Math.min(1, 960 / Math.max(sourceWidth, sourceHeight));
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('当前浏览器不支持生成裁剪封面。');
  }
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    targetWidth,
    targetHeight,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.88);
  });
  if (!blob) {
    throw new Error('裁剪封面生成失败，请保留原图后再保存。');
  }
  return new File([blob], `pantry-cover-${Date.now()}.jpg`, { type: 'image/jpeg' });
}

async function loadCoverSourceFile(imageFile: File | null, imageUrl: string) {
  if (imageFile) {
    return imageFile;
  }
  if (!imageUrl) {
    throw new Error('缺少原图，无法生成建议封面。');
  }
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error('原图读取失败，请改用原图保存。');
  }
  const blob = await response.blob();
  return new File([blob], `pantry-photo-source-${Date.now()}.jpg`, {
    type: blob.type || 'image/jpeg',
  });
}

function resolveSelectableHouseholdId(
  householdId: string | undefined,
  households: HouseholdSummary[],
) {
  const normalized = householdId?.trim() ?? '';
  if (!normalized) {
    return '';
  }
  return households.some((household) => household.kind === 'shared' && household.id === normalized)
    ? normalized
    : '';
}

function formatDraftUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '刚刚';
  }
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PhotoItemAnalysisPage() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const addPantryItem = useLifeTraceStore((state) => state.addPantryItem);
  const editPantryItem = useLifeTraceStore((state) => state.editPantryItem);
  const pantryItems = useLifeTraceStore((state) => state.pantryItems);
  const pantryListItems = useLifeTraceStore((state) => state.pantryListItems);
  const pantryLoaded = useLifeTraceStore((state) => state.pantryLoaded);
  const pantryLoading = useLifeTraceStore((state) => state.pantryLoading);
  const pantryPreferences = useLifeTraceStore((state) => state.pantryPreferences);
  const preferredPantryHouseholdId = useLifeTraceStore((state) => state.preferredPantryHouseholdId);
  const preferredPantryHouseholdName = useLifeTraceStore(
    (state) => state.preferredPantryHouseholdName,
  );
  const loadPantry = useLifeTraceStore((state) => state.loadPantry);
  const setActivePantryHousehold = useLifeTraceStore((state) => state.setActivePantryHousehold);
  const showToast = useFeedbackToastStore((state) => state.showToast);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<CaptureState>('idle');
  const [cameraError, setCameraError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [analysis, setAnalysis] = useState<PantryPhotoAnalysisResponse | null>(null);
  const [form, setForm] = useState<DraftForm>(initialForm);
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [householdsLoading, setHouseholdsLoading] = useState(false);
  const [error, setError] = useState('');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [activePicker, setActivePicker] = useState<'category' | 'location' | null>(null);
  const [expiryBaseDate, setExpiryBaseDate] = useState('');
  const [coverMode, setCoverMode] = useState<PhotoItemAnalysisCoverMode>('original');
  const [historyItems, setHistoryItems] = useState<PhotoItemAnalysisHistoryItem[]>(() =>
    readPhotoItemAnalysisHistory(),
  );
  const [currentHistoryId, setCurrentHistoryId] = useState('');

  const cameraActive = state === 'camera-ready';
  const busy = state === 'uploading' || state === 'analyzing' || state === 'saving';
  const visionProcessing = state === 'uploading' || state === 'analyzing';
  const reviewReady = Boolean(analysis);
  const scannerStatusLabel = state === 'done' ? '已入库' : busy ? '处理中' : '待确认';
  const visionStageLabel =
    state === 'uploading' ? '正在同步影像' : state === 'analyzing' ? '正在解析商品' : '视觉待命';
  const hasExpiryDate = Boolean(form.expiresAt.trim());
  const hasCropSuggestion = Boolean(normalizeCropBox(analysis?.cropBox));
  const hasMeaningfulCropSuggestion = isMeaningfulCropBox(analysis?.cropBox);
  const cropBoxStyle = useMemo(
    () => (hasMeaningfulCropSuggestion ? buildCropBoxStyle(analysis?.cropBox) : null),
    [analysis?.cropBox, hasMeaningfulCropSuggestion],
  );
  const latestDraft = useMemo(
    () =>
      currentHistoryId
        ? null
        : (historyItems.find((item) => item.status === 'draft') ??
          getLatestPhotoItemAnalysisDraft()),
    [currentHistoryId, historyItems],
  );
  const currentHistoryItem = useMemo(
    () => historyItems.find((item) => item.id === currentHistoryId) ?? null,
    [currentHistoryId, historyItems],
  );
  const reviewIssues = useMemo(
    () => (analysis ? getPhotoItemAnalysisReviewIssues(analysis, form) : []),
    [analysis, form],
  );
  const pantryHistoryItems = useMemo(() => {
    const byId = new Map(pantryItems.map((item) => [item.id, item]));
    pantryListItems.forEach((item) => {
      byId.set(item.id, item);
    });
    return [...byId.values()];
  }, [pantryItems, pantryListItems]);
  const smartSuggestions = useMemo(
    () =>
      analysis
        ? buildPhotoItemAnalysisSmartSuggestions({
            analysis,
            form,
            pantryItems: pantryHistoryItems,
            pantryPreferences,
            preferredHouseholdId: preferredPantryHouseholdId,
            preferredHouseholdName: preferredPantryHouseholdName,
          })
        : [],
    [
      analysis,
      form,
      pantryHistoryItems,
      pantryPreferences,
      preferredPantryHouseholdId,
      preferredPantryHouseholdName,
    ],
  );
  const duplicateCandidates = useMemo(
    () =>
      analysis
        ? findPhotoItemAnalysisDuplicateCandidates({
            analysis,
            form,
            pantryItems: pantryHistoryItems,
          })
        : [],
    [analysis, form, pantryHistoryItems],
  );
  const primaryDuplicateCandidate = duplicateCandidates[0] ?? null;
  const qualityRating = currentHistoryItem?.qualityFeedback?.rating;
  const selectedHouseholdName = useMemo(() => {
    if (!form.householdId) {
      return '我的空间';
    }
    const selected = households.find((item) => item.id === form.householdId);
    return (
      selected?.name ||
      (preferredPantryHouseholdId === form.householdId ? preferredPantryHouseholdName : '') ||
      '共享空间'
    );
  }, [form.householdId, households, preferredPantryHouseholdId, preferredPantryHouseholdName]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      householdId: current.householdId || preferredPantryHouseholdId,
      reminderEnabled: current.expiresAt ? pantryPreferences.defaultReminderEnabled : false,
    }));
  }, [pantryPreferences.defaultReminderEnabled, preferredPantryHouseholdId]);

  useEffect(() => {
    if (!token) {
      return;
    }

    setHouseholdsLoading(true);
    listHouseholds(token)
      .then((data) => {
        setHouseholds(data.list);
        setForm((current) => {
          if (current.householdId) {
            return current;
          }
          return {
            ...current,
            householdId: resolveSelectableHouseholdId(data.currentHouseholdId, data.list),
          };
        });
      })
      .catch(() => {
        setHouseholds([]);
      })
      .finally(() => setHouseholdsLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || !analysis || pantryLoaded || pantryLoading) {
      return;
    }
    void loadPantry();
  }, [analysis, loadPantry, pantryLoaded, pantryLoading, token]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  useEffect(() => {
    if (!currentHistoryId || !analysis || !uploadedImageUrl || state === 'done') {
      return;
    }

    const now = new Date().toISOString();
    const existing = readPhotoItemAnalysisHistory().find((item) => item.id === currentHistoryId);
    upsertPhotoItemAnalysisHistory({
      id: currentHistoryId,
      imageUrl: uploadedImageUrl,
      imageName: existing?.imageName,
      analysis,
      form,
      expiryBaseDate,
      householdName: selectedHouseholdName,
      status: 'draft',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      coverMode,
      qualityFeedback: existing?.qualityFeedback,
    });
    setHistoryItems(readPhotoItemAnalysisHistory());
  }, [
    analysis,
    currentHistoryId,
    coverMode,
    expiryBaseDate,
    form,
    selectedHouseholdName,
    state,
    uploadedImageUrl,
  ]);

  const stopCamera = useCallback(() => {
    setCameraStream((current) => {
      current?.getTracks().forEach((track) => {
        track.stop();
      });
      return null;
    });
    const stream = videoRef.current?.srcObject;
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (!cameraActive || !cameraStream || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    let cancelled = false;
    if (video.srcObject !== cameraStream) {
      video.srcObject = cameraStream;
    }

    void video.play().catch(() => {
      if (cancelled) {
        return;
      }
      cameraStream.getTracks().forEach((track) => {
        track.stop();
      });
      if (video.srcObject === cameraStream) {
        video.srcObject = null;
      }
      setCameraStream(null);
      setCameraError('摄像头画面启动失败，可以关闭后重试或改用相册上传。');
      setState('error');
    });

    return () => {
      cancelled = true;
    };
  }, [cameraActive, cameraStream]);

  const updateImageFile = (file: File) => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setUploadedImageUrl('');
    setAnalysis(null);
    setCoverMode('original');
    setCurrentHistoryId('');
    setReviewSheetOpen(false);
    setError('');
    setState('captured');
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('当前浏览器不支持直接拍照，可以改用相册上传。');
      setState('error');
      return;
    }

    setCameraError('');
    setError('');
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      setCameraStream(stream);
      setState('camera-ready');
    } catch (cameraAccessError) {
      setCameraError(
        cameraAccessError instanceof Error
          ? cameraAccessError.message
          : '摄像头权限不可用，可以改用相册上传。',
      );
      setState('error');
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setError('摄像头画面还没有准备好，请稍后再拍。');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setError('当前浏览器不支持拍照截图。');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('照片生成失败，请重试。');
          return;
        }
        stopCamera();
        updateImageFile(new File([blob], `pantry-photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.9,
    );
  };

  const handleLibraryChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (!acceptedImageTypes.includes(file.type)) {
      setError('请选择 JPG、PNG 或 WebP 图片。');
      return;
    }
    stopCamera();
    updateImageFile(file);
  };

  const analyzePhoto = async () => {
    if (!token) {
      setError('请先登录后再分析商品。');
      return;
    }
    if (!imageFile) {
      setError('请先拍照或选择一张商品图片。');
      return;
    }

    setState('uploading');
    setError('');
    try {
      const upload = await uploadLifeTraceImage(token, imageFile);
      setUploadedImageUrl(upload.url);
      setState('analyzing');
      const result = await analyzePantryPhoto(token, {
        imageUrl: upload.url,
        householdId: form.householdId || undefined,
      });
      const nextForm: DraftForm = {
        ...form,
        name: result.name || form.name,
        category: result.category || form.category,
        quantity: String(result.quantity || 1),
        unit: result.unit || form.unit,
        location: result.storageLocation || form.location,
        expiresAt: result.expiresAt || '',
        openedAt: '',
        note: buildAnalysisNote(result),
        householdId:
          resolveSelectableHouseholdId(result.householdId, households) || form.householdId,
        reminderEnabled: result.expiresAt ? pantryPreferences.defaultReminderEnabled : false,
      };
      const nextExpiryBaseDate = result.productionDate || result.purchaseDate || '';
      const historyId = createPhotoItemAnalysisHistoryId();
      const nextCoverMode: PhotoItemAnalysisCoverMode = isMeaningfulCropBox(result.cropBox)
        ? 'crop'
        : 'original';
      setAnalysis(result);
      setForm(nextForm);
      setExpiryBaseDate(nextExpiryBaseDate);
      setCoverMode(nextCoverMode);
      setCurrentHistoryId(historyId);
      upsertPhotoItemAnalysisHistory({
        id: historyId,
        imageUrl: upload.url,
        imageName: getFallbackFileName(imageFile),
        analysis: result,
        form: nextForm,
        expiryBaseDate: nextExpiryBaseDate,
        householdName: selectedHouseholdName,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        coverMode: nextCoverMode,
      });
      setHistoryItems(readPhotoItemAnalysisHistory());
      setState('reviewing');
      setReviewSheetOpen(true);
      showToast('商品识别完成，请确认后入库。', 'success');
    } catch (analysisError) {
      setState('captured');
      setError(
        analysisError instanceof Error ? analysisError.message : '商品分析失败，请稍后再试。',
      );
    }
  };

  const savePantryItem = async (mode: 'create' | 'merge' = 'create') => {
    if (!form.name.trim()) {
      setError('请先确认商品名称。');
      return;
    }

    setState('saving');
    setError('');
    try {
      const mergeCandidate = mode === 'merge' ? primaryDuplicateCandidate : null;
      let thumbnailUrl = '';
      if (!mergeCandidate && token && analysis && coverMode === 'crop') {
        const sourceFile = await loadCoverSourceFile(imageFile, uploadedImageUrl);
        const coverFile = await createCroppedCoverFile(sourceFile, analysis.cropBox);
        const coverUpload = await uploadLifeTraceImage(token, coverFile);
        thumbnailUrl = coverUpload.url;
      }
      const item = mergeCandidate
        ? await editPantryItem(
            mergeCandidate.item.id,
            buildPhotoItemMergedPantryInput({
              existingItem: mergeCandidate.item,
              form,
            }),
            form.householdId || undefined,
          )
        : await addPantryItem(
            buildPhotoItemPantryInput({
              form,
              pantryPreferences,
              uploadedImageUrl,
              thumbnailUrl,
            }),
            form.householdId || undefined,
          );
      if (!item) {
        throw new Error('入库失败，请稍后重试。');
      }
      void setActivePantryHousehold(
        form.householdId || '',
        form.householdId ? selectedHouseholdName : '',
        { silent: true },
      );
      if (currentHistoryId) {
        markPhotoItemAnalysisSaved(currentHistoryId, item.id);
        setHistoryItems(readPhotoItemAnalysisHistory());
      }
      setState('done');
      setReviewSheetOpen(true);
      showToast(
        mergeCandidate
          ? `已把数量合并到「${item.name}」。`
          : `「${item.name}」已加入${selectedHouseholdName}`,
        'success',
      );
    } catch (saveError) {
      setState('reviewing');
      setError(saveError instanceof Error ? saveError.message : '入库失败，请稍后再试。');
    }
  };

  const resetFlow = () => {
    stopCamera();
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setState('idle');
    setCameraError('');
    setImageFile(null);
    setImagePreviewUrl('');
    setUploadedImageUrl('');
    setAnalysis(null);
    setCoverMode('original');
    setCurrentHistoryId('');
    setReviewSheetOpen(false);
    setActivePicker(null);
    setExpiryBaseDate('');
    setForm((current) => ({
      ...initialForm,
      householdId: current.householdId,
      reminderEnabled: pantryPreferences.defaultReminderEnabled,
    }));
    setError('');
  };

  const restoreDraft = (draft: PhotoItemAnalysisHistoryItem) => {
    stopCamera();
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(null);
    setImagePreviewUrl(draft.imageUrl);
    setUploadedImageUrl(draft.imageUrl);
    setAnalysis(draft.analysis);
    setForm(draft.form);
    setExpiryBaseDate(draft.expiryBaseDate || draft.analysis.productionDate || '');
    setCoverMode(
      draft.coverMode === 'crop' && isMeaningfulCropBox(draft.analysis.cropBox)
        ? 'crop'
        : 'original',
    );
    setCurrentHistoryId(draft.id);
    setState('reviewing');
    setReviewSheetOpen(true);
    setActivePicker(null);
    setError('');
    showToast('已恢复上次未入库草稿。', 'success');
  };

  const dismissDraft = (draftId: string) => {
    removePhotoItemAnalysisHistory(draftId);
    setHistoryItems(readPhotoItemAnalysisHistory());
  };

  const handleReviewIssueAction = (issue: PhotoItemAnalysisReviewIssue) => {
    if (issue.action === 'open-sheet') {
      setReviewSheetOpen(true);
      return;
    }

    if (issue.action === 'clear-expiry') {
      setExpiryBaseDate('');
      setForm((current) => ({
        ...current,
        expiresAt: '',
        reminderEnabled: false,
        note: appendUniqueNoteLine(current.note, '用户复核：不记录保质期。'),
      }));
      showToast('已按普通物品处理，不记录保质期。', 'success');
      return;
    }

    if (issue.action === 'mark-brand-unknown') {
      setForm((current) => ({
        ...current,
        note: appendUniqueNoteLine(current.note, '用户复核：品牌未知。'),
      }));
      showToast('已标记品牌未知。', 'success');
      return;
    }

    if (issue.action === 'mark-spec-unknown') {
      setForm((current) => ({
        ...current,
        note: appendUniqueNoteLine(current.note, '用户复核：规格不记录。'),
      }));
      showToast('已标记规格不记录。', 'success');
    }
  };

  const handleQualityFeedback = (rating: PhotoItemAnalysisQualityRating) => {
    if (!currentHistoryId) {
      return;
    }
    markPhotoItemAnalysisQualityFeedback(currentHistoryId, rating);
    setHistoryItems(readPhotoItemAnalysisHistory());
    showToast(rating === 'accurate' ? '已记录：识别准确。' : '已记录：识别不准确。', 'success');
  };

  const handleSmartSuggestion = (suggestion: PhotoItemAnalysisSmartSuggestion) => {
    setForm((current) => ({
      ...current,
      ...suggestion.patch,
    }));
    showToast(`已应用${suggestion.label}。`, 'success');
  };

  return (
    <div className="space-y-6 pb-2">
      <header className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => navigate('/ai')}>
          <ArrowLeft className="size-5" />
        </Button>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-life-ai">Life AI</p>
          <h1 className="truncate text-2xl font-semibold tracking-tight">拍照分析商品</h1>
        </div>
      </header>

      {latestDraft ? (
        <Card className="border-life-ai/25 bg-life-ai/5 p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
              <History className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">发现未入库草稿</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {latestDraft.form.name || latestDraft.analysis.name || '待确认商品'} ·{' '}
                {formatDraftUpdatedAt(latestDraft.updatedAt)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ai"
                  size="sm"
                  onClick={() => restoreDraft(latestDraft)}
                >
                  继续编辑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissDraft(latestDraft.id)}
                >
                  忽略
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <section className="relative overflow-hidden rounded-[1.75rem] border border-life-ai/20 bg-card p-4 shadow-[0_24px_90px_rgba(0,0,0,0.28)]">
        <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(6,182,212,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.1)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-life-ai/80 to-transparent" />
        <div className="pointer-events-none absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-life-trace/45 to-transparent" />

        <div className="relative space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-life-ai">
                Vision Dock
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">AI 商品扫描舱</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                对准商品包装，系统会识别名称、分类、数量、位置和到期线索。
              </p>
            </div>
            <Badge
              tone={state === 'done' ? 'trace' : 'ai'}
              className="min-w-[4.75rem] shrink-0 justify-center whitespace-nowrap border border-life-ai/20 bg-background/50 px-3 py-1.5 font-semibold backdrop-blur"
            >
              {scannerStatusLabel}
            </Badge>
          </div>

          <div className="rounded-[1.15rem] border border-white/[0.06] bg-background/35 px-3 py-2.5 backdrop-blur">
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-[11px] font-semibold text-muted-foreground">
              <span className="inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap text-life-ai">
                <span className="size-1.5 shrink-0 rounded-full bg-life-ai shadow-[0_0_12px_rgba(6,182,212,0.9)]" />
                取景
              </span>
              <span className="h-px w-4 bg-border" />
              <span
                className={`inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap ${
                  visionProcessing ? 'text-life-ai' : 'text-muted-foreground'
                }`}
              >
                <span
                  className={`size-1.5 shrink-0 rounded-full ${
                    visionProcessing
                      ? 'animate-pulse bg-life-ai shadow-[0_0_12px_rgba(6,182,212,0.9)] motion-reduce:animate-none'
                      : 'bg-muted-foreground/45'
                  }`}
                />
                分析
              </span>
              <span className="h-px w-4 bg-border" />
              <span className="inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap text-life-trace">
                <span className="size-1.5 shrink-0 rounded-full bg-life-trace/80" />
                入库
              </span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[1.45rem] border border-life-ai/25 bg-background/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
            <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,transparent,rgba(6,182,212,0.08),transparent)] opacity-70" />
            <div
              className={`pointer-events-none absolute inset-x-8 z-20 h-px bg-life-ai/80 shadow-[0_0_24px_rgba(6,182,212,0.75)] motion-reduce:animate-none ${
                visionProcessing
                  ? 'top-0 animate-[life-vision-scan_1.9s_ease-in-out_infinite]'
                  : imagePreviewUrl || cameraActive
                    ? 'top-1/2 animate-pulse opacity-70'
                    : 'top-[28%] opacity-35'
              }`}
            />
            <span
              className={`pointer-events-none absolute top-3 left-3 z-20 size-7 border-t-2 border-l-2 border-life-ai ${
                visionProcessing ? 'shadow-[0_0_24px_rgba(6,182,212,0.85)]' : ''
              }`}
            />
            <span
              className={`pointer-events-none absolute top-3 right-3 z-20 size-7 border-t-2 border-r-2 border-life-ai ${
                visionProcessing ? 'shadow-[0_0_24px_rgba(6,182,212,0.85)]' : ''
              }`}
            />
            <span
              className={`pointer-events-none absolute bottom-3 left-3 z-20 size-7 border-b-2 border-l-2 border-life-trace ${
                visionProcessing ? 'shadow-[0_0_24px_rgba(16,185,129,0.75)]' : ''
              }`}
            />
            <span
              className={`pointer-events-none absolute right-3 bottom-3 z-20 size-7 border-r-2 border-b-2 border-life-trace ${
                visionProcessing ? 'shadow-[0_0_24px_rgba(16,185,129,0.75)]' : ''
              }`}
            />

            {cameraActive ? (
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-[4/3] w-full object-cover sm:aspect-[16/10]"
              />
            ) : imagePreviewUrl ? (
              <>
                <img
                  src={imagePreviewUrl}
                  alt="商品预览"
                  className={`aspect-[4/3] w-full object-contain transition duration-500 sm:aspect-[16/10] ${
                    visionProcessing
                      ? 'animate-[life-vision-drift_2.4s_ease-in-out_infinite] brightness-90 saturate-125 motion-reduce:animate-none'
                      : ''
                  }`}
                />
                {cropBoxStyle ? (
                  <div
                    className="pointer-events-none absolute z-30 rounded-[1rem] border-2 border-life-trace shadow-[0_0_0_9999px_rgba(0,0,0,0.36),0_0_28px_rgba(16,185,129,0.75)]"
                    style={cropBoxStyle}
                  >
                    <span className="absolute -top-8 left-0 rounded-full border border-life-trace/30 bg-background/65 px-2.5 py-1 text-[10px] font-semibold text-life-trace backdrop-blur">
                      建议封面
                    </span>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="grid aspect-[4/3] place-items-center px-5 py-10 text-center sm:aspect-[16/10]">
                <div className="max-w-xs space-y-6">
                  <div className="relative mx-auto grid size-24 place-items-center">
                    <span className="absolute inset-0 rounded-full border border-life-ai/20 bg-life-ai/5 animate-[life-vision-pulse_3.2s_ease-in-out_infinite] motion-reduce:animate-none" />
                    <span className="absolute inset-3 rounded-full border border-life-trace/20 bg-life-trace/5 animate-[life-vision-pulse_3.2s_ease-in-out_infinite] [animation-delay:420ms] motion-reduce:animate-none" />
                    <div className="relative grid size-16 place-items-center rounded-[1.35rem] border border-life-ai/25 bg-background/70 text-life-ai shadow-[0_0_42px_rgba(6,182,212,0.24)] backdrop-blur">
                      <Camera className="size-8" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-base font-semibold">等待商品进入取景框</p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      建议让包装正面占据画面中央，减少反光和遮挡。
                    </p>
                  </div>
                  <div className="mx-auto flex max-w-[12rem] items-center gap-2 pt-1">
                    <span className="h-px flex-1 bg-gradient-to-r from-transparent to-life-ai/40" />
                    <span className="size-1.5 rounded-full bg-life-ai/70 shadow-[0_0_14px_rgba(6,182,212,0.8)]" />
                    <span className="h-px flex-1 bg-gradient-to-l from-transparent to-life-trace/40" />
                  </div>
                </div>
              </div>
            )}
            {visionProcessing ? (
              <div className="pointer-events-none absolute inset-0 z-30">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_52%,rgba(6,182,212,0.12),transparent_42%),linear-gradient(180deg,rgba(6,182,212,0.05),rgba(16,185,129,0.04))]" />
                <div className="absolute inset-x-5 top-8 h-16 animate-[life-vision-scan_1.9s_ease-in-out_infinite] rounded-full bg-gradient-to-b from-life-ai/0 via-life-ai/24 to-life-trace/0 blur-md motion-reduce:animate-none" />
                <div className="absolute inset-x-6 top-1/2 h-px bg-gradient-to-r from-transparent via-life-ai/85 to-transparent shadow-[0_0_30px_rgba(6,182,212,0.85)]" />
                <div className="absolute inset-x-4 top-4 rounded-2xl border border-life-ai/20 bg-background/35 px-3 py-2.5 shadow-[0_14px_36px_rgba(0,0,0,0.2)] backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{visionStageLabel}</p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-life-ai/80">
                        Vision Analysis
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-life-trace/25 bg-life-trace/10 px-2.5 py-1 text-[10px] font-semibold text-life-trace">
                      <span className="size-1.5 animate-pulse rounded-full bg-life-trace shadow-[0_0_12px_rgba(16,185,129,0.9)] motion-reduce:animate-none" />
                      Live
                    </span>
                  </div>
                  <div className="mt-2 flex gap-1.5 overflow-hidden">
                    {['主体定位', '字段抽取', '库存匹配'].map((label, index) => (
                      <span
                        key={label}
                        className="min-w-0 flex-1 rounded-full border border-life-ai/20 bg-life-ai/10 px-2 py-1 text-center text-[10px] font-semibold text-life-ai/90"
                        style={{ animationDelay: `${index * 180}ms` }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {analysis && hasCropSuggestion ? (
            <div className="rounded-[1.25rem] border border-life-trace/25 bg-life-trace/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-life-trace">AI 已定位商品主体</p>
                  <p className="mt-1 truncate text-xs leading-5 text-muted-foreground">
                    {hasMeaningfulCropSuggestion
                      ? '可裁剪主体做封面；原图完整保留。'
                      : '主体框接近原图，默认不裁剪。'}
                  </p>
                </div>
                <Badge tone="trace" className="shrink-0 whitespace-nowrap">
                  {hasMeaningfulCropSuggestion
                    ? coverMode === 'crop'
                      ? '裁剪主体'
                      : '不裁剪'
                    : '接近原图'}
                </Badge>
              </div>
              {hasMeaningfulCropSuggestion ? (
                <div className="mt-3">
                  <CoverModeSelector value={coverMode} onChange={setCoverMode} />
                </div>
              ) : null}
            </div>
          ) : null}

          {cameraActive ? (
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full whitespace-nowrap bg-background/45 backdrop-blur"
                onClick={() => {
                  stopCamera();
                  setState('idle');
                }}
              >
                <X className="size-4 shrink-0" />
                <span className="whitespace-nowrap">关闭</span>
              </Button>
              <Button
                type="button"
                variant="ai"
                className="h-12 w-full whitespace-nowrap"
                onClick={capturePhoto}
              >
                <Camera className="size-4 shrink-0" />
                <span className="whitespace-nowrap">拍照</span>
              </Button>
            </div>
          ) : imagePreviewUrl ? (
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full whitespace-nowrap bg-background/45 backdrop-blur"
                disabled={busy}
                onClick={resetFlow}
              >
                <RefreshCcw className="size-4 shrink-0" />
                <span className="whitespace-nowrap">重拍</span>
              </Button>
              <Button
                type="button"
                variant="ai"
                className="h-12 w-full whitespace-nowrap"
                disabled={busy}
                onClick={() => void analyzePhoto()}
              >
                {busy ? (
                  <ActionLoadingIcon className="size-4 shrink-0 text-background" />
                ) : (
                  <Sparkles className="size-4 shrink-0" />
                )}
                <span className="whitespace-nowrap">
                  {state === 'uploading'
                    ? '上传中...'
                    : state === 'analyzing'
                      ? '分析中...'
                      : '开始分析'}
                </span>
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="ai"
                className="h-12 w-full whitespace-nowrap px-3"
                onClick={() => void startCamera()}
              >
                <Camera className="size-5 shrink-0" />
                <span className="whitespace-nowrap">打开摄像头</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full whitespace-nowrap bg-background/45 px-3 backdrop-blur"
                onClick={() => libraryInputRef.current?.click()}
              >
                <ImagePlus className="size-5 shrink-0" />
                <span className="whitespace-nowrap">从相册选择</span>
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs leading-5 text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span className="size-1.5 rounded-full bg-life-trace shadow-[0_0_14px_rgba(16,185,129,0.75)]" />
              本地拍摄预览
            </span>
            <span className="text-border">/</span>
            <span>确认后才会写入库存。</span>
          </div>

          <input
            ref={libraryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleLibraryChange}
          />
          <canvas ref={canvasRef} className="hidden" />

          {imageFile ? (
            <p className="mt-3 text-xs text-muted-foreground">
              当前图片：{getFallbackFileName(imageFile)}
            </p>
          ) : null}
          {cameraError ? (
            <p className="mt-3 rounded-2xl bg-life-alert/10 px-4 py-3 text-sm text-life-alert">
              {cameraError}
            </p>
          ) : null}
          {error ? (
            <p className="mt-3 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </section>

      {analysis ? (
        <section>
          <SectionHeader title="AI 识别结果" meta={`${Math.round(analysis.confidence * 100)}%`} />
          <Card className="space-y-4 p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold">{analysis.name}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{analysis.summary}</p>
              </div>
              <Badge tone="plan" className="shrink-0 whitespace-nowrap">
                {analysis.category}
              </Badge>
            </div>
            {analysis.warnings.length > 0 ? (
              <div className="space-y-2">
                {analysis.warnings.map((warning) => (
                  <p
                    key={warning}
                    className="rounded-2xl bg-life-alert/10 px-4 py-3 text-sm leading-6 text-life-alert"
                  >
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}
            {smartSuggestions.length > 0 ? (
              <div className="rounded-[1.25rem] border border-life-ai/20 bg-life-ai/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-life-ai">智能建议</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      根据当前家庭空间和历史库存，推荐更常用的入库字段。
                    </p>
                  </div>
                  <Badge tone="ai" className="shrink-0">
                    {smartSuggestions.length} 项
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2">
                  {smartSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="rounded-2xl border border-border bg-card/80 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{suggestion.label}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {suggestion.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded-full border border-life-ai/25 bg-life-ai/10 px-3 py-1.5 text-xs font-semibold text-life-ai transition hover:bg-life-ai/15"
                          onClick={() => handleSmartSuggestion(suggestion)}
                        >
                          {suggestion.actionLabel}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {primaryDuplicateCandidate ? (
              <div className="rounded-[1.25rem] border border-life-trace/25 bg-life-trace/5 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-life-trace">可能已有相同库存</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {primaryDuplicateCandidate.item.name} · 现有{' '}
                      {primaryDuplicateCandidate.item.quantity}{' '}
                      {primaryDuplicateCandidate.item.unit}，{primaryDuplicateCandidate.reason}。
                    </p>
                  </div>
                  <Badge tone="trace" className="shrink-0">
                    可合并
                  </Badge>
                </div>
              </div>
            ) : null}
            {reviewIssues.length > 0 ? (
              <div className="rounded-[1.25rem] border border-life-alert/20 bg-life-alert/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-life-alert">需要复核</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      这些字段不确定，保存前建议确认。
                    </p>
                  </div>
                  <Badge tone="alert" className="shrink-0">
                    {reviewIssues.length} 项
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2">
                  {reviewIssues.map((issue) => (
                    <div key={issue.id} className="rounded-2xl border border-border bg-card/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{issue.label}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {issue.description}
                          </p>
                        </div>
                        {issue.actionLabel ? (
                          <button
                            type="button"
                            className="shrink-0 rounded-full border border-life-alert/25 bg-life-alert/10 px-3 py-1.5 text-xs font-semibold text-life-alert transition hover:bg-life-alert/15"
                            onClick={() => handleReviewIssueAction(issue)}
                          >
                            {issue.actionLabel}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="rounded-[1.25rem] border border-border bg-secondary/45 p-3">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">本次识别是否准确</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    反馈会保存在本机识别历史里，后续用于优化提示词和字段兜底。
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition ${
                    qualityRating === 'accurate'
                      ? 'border-life-trace/40 bg-life-trace/10 text-life-trace'
                      : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                  onClick={() => handleQualityFeedback('accurate')}
                >
                  <ThumbsUp className="size-4" />
                  准确
                </button>
                <button
                  type="button"
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition ${
                    qualityRating === 'inaccurate'
                      ? 'border-life-alert/40 bg-life-alert/10 text-life-alert'
                      : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                  onClick={() => handleQualityFeedback('inaccurate')}
                >
                  <ThumbsDown className="size-4" />
                  不准确
                </button>
              </div>
            </div>
          </Card>
        </section>
      ) : null}

      {analysis ? (
        <section>
          <SectionHeader title="确认入库信息" meta={selectedHouseholdName} />
          <Card className="space-y-4 p-4">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-secondary/60 px-4 py-3">
                <p className="text-xs text-muted-foreground">商品</p>
                <p className="mt-1 truncate font-semibold">{form.name || analysis.name}</p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/60 px-4 py-3">
                <p className="text-xs text-muted-foreground">数量 / 位置</p>
                <p className="mt-1 truncate font-semibold">
                  {form.quantity || '1'} {form.unit || '件'} · {form.location}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ai"
              className="h-12 w-full whitespace-nowrap"
              onClick={() => setReviewSheetOpen(true)}
            >
              <Check className="size-4 shrink-0" />
              <span className="whitespace-nowrap">
                {state === 'done' ? '查看入库结果' : '打开入库确认'}
              </span>
            </Button>
          </Card>
        </section>
      ) : null}

      <BottomSheet
        open={reviewSheetOpen && reviewReady}
        onOpenChange={setReviewSheetOpen}
        overlayLabel="关闭入库确认"
        zIndexClassName="z-50"
        closeDisabled={state === 'saving'}
        portal
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">确认入库</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              AI 已经填好草稿，你可以改完再保存到库存。
            </p>
            <p className="mt-2 text-xs font-medium text-life-ai">保存到：{selectedHouseholdName}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={state === 'saving'}
            onClick={() => setReviewSheetOpen(false)}
          >
            <X className="size-5" />
          </Button>
        </div>

        {imagePreviewUrl ? (
          <div className="mb-4 rounded-[1.25rem] border border-border bg-card/95 p-3 shadow-lg shadow-background/35">
            <div className="flex items-center gap-3">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border bg-background">
                <img
                  src={imagePreviewUrl}
                  alt={form.name || analysis?.name || '商品图片'}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-muted-foreground">当前编辑图片</p>
                  {hasCropSuggestion ? (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        coverMode === 'crop' && hasMeaningfulCropSuggestion
                          ? 'border-life-trace/30 bg-life-trace/10 text-life-trace'
                          : 'border-life-ai/25 bg-life-ai/10 text-life-ai'
                      }`}
                    >
                      {coverMode === 'crop' && hasMeaningfulCropSuggestion
                        ? '封面：裁剪主体'
                        : hasMeaningfulCropSuggestion
                          ? '封面：不裁剪'
                          : '主体框接近原图'}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-sm font-semibold">
                  {form.name || analysis?.name || '待确认商品'}
                </p>
                <p className="mt-1 truncate text-xs leading-5 text-muted-foreground">
                  {coverMode === 'crop' && hasMeaningfulCropSuggestion
                    ? '保存时生成主体封面，原图保留。'
                    : imageFile
                      ? getFallbackFileName(imageFile)
                      : '商品图片'}
                </p>
              </div>
            </div>
            {hasMeaningfulCropSuggestion && state !== 'done' ? (
              <div className="mt-3">
                <CoverModeSelector
                  value={coverMode}
                  size="sm"
                  disabled={state === 'saving'}
                  onChange={setCoverMode}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {reviewIssues.length > 0 && state !== 'done' ? (
          <div className="mb-4 rounded-[1.25rem] border border-life-alert/20 bg-life-alert/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-life-alert">保存前还有字段建议复核</p>
              <Badge tone="alert" className="shrink-0">
                {reviewIssues.length} 项
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              已经可以入库，但建议先处理名称、品牌、规格或保质期的不确定项。
            </p>
          </div>
        ) : null}

        {smartSuggestions.length > 0 && state !== 'done' ? (
          <div className="mb-4 rounded-[1.25rem] border border-life-ai/20 bg-life-ai/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-life-ai">可套用智能建议</p>
              <Badge tone="ai" className="shrink-0">
                {smartSuggestions.length} 项
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {smartSuggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  className="rounded-full border border-life-ai/25 bg-life-ai/10 px-3 py-1.5 text-xs font-semibold text-life-ai transition hover:bg-life-ai/15"
                  onClick={() => handleSmartSuggestion(suggestion)}
                >
                  {suggestion.actionLabel}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {primaryDuplicateCandidate && state !== 'done' ? (
          <div className="mb-4 rounded-[1.25rem] border border-life-trace/25 bg-life-trace/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-life-trace">检测到相似库存</p>
              <Badge tone="trace" className="shrink-0">
                {duplicateCandidates.length} 项
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {primaryDuplicateCandidate.item.name} 当前数量为{' '}
              {primaryDuplicateCandidate.item.quantity} {primaryDuplicateCandidate.item.unit}。
              可以把本次数量追加到已有库存，也可以创建新条目。
            </p>
          </div>
        ) : null}

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (state !== 'done') {
              void savePantryItem();
            }
          }}
        >
          <FormItem label="商品名称" required>
            <input
              value={form.name}
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm text-foreground outline-none transition focus:border-ring"
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </FormItem>

          <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
            <FormItem label="分类">
              <button
                type="button"
                disabled={state === 'saving'}
                className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
                onClick={() => setActivePicker('category')}
              >
                <span className="flex items-center justify-between gap-3">
                  <span>{form.category}</span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                </span>
              </button>
            </FormItem>
            <FormItem label="位置">
              <button
                type="button"
                disabled={state === 'saving'}
                className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
                onClick={() => setActivePicker('location')}
              >
                <span className="flex items-center justify-between gap-3">
                  <span>{form.location}</span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                </span>
              </button>
            </FormItem>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3 max-[360px]:grid-cols-1">
            <FormItem label="数量" required>
              <input
                type="number"
                min="1"
                value={form.quantity}
                className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm text-foreground outline-none transition focus:border-ring"
                onChange={(event) =>
                  setForm((current) => ({ ...current, quantity: event.target.value }))
                }
              />
            </FormItem>
            <FormItem label="单位">
              <input
                value={form.unit}
                className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm text-foreground outline-none transition focus:border-ring"
                onChange={(event) =>
                  setForm((current) => ({ ...current, unit: event.target.value }))
                }
              />
            </FormItem>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3">
            <FormItem label="开封日期">
              <input
                type="date"
                value={form.openedAt}
                disabled={state === 'saving'}
                className="h-11 min-w-0 w-full appearance-none rounded-2xl border border-border bg-secondary px-4 text-sm text-foreground outline-none transition focus:border-ring disabled:opacity-60"
                onChange={(event) =>
                  setForm((current) => ({ ...current, openedAt: event.target.value }))
                }
              />
            </FormItem>
            <PantryExpiryDateField
              idPrefix="photo-item"
              expiresAt={form.expiresAt}
              initialBaseDate={expiryBaseDate}
              disabled={state === 'saving'}
              onBaseDateChange={setExpiryBaseDate}
              onExpiresAtChange={(value) =>
                setForm((current) => ({
                  ...current,
                  expiresAt: value,
                  reminderEnabled: value
                    ? current.reminderEnabled || pantryPreferences.defaultReminderEnabled
                    : false,
                }))
              }
            />
          </div>

          <FormItem label="家庭空间">
            <select
              value={form.householdId}
              disabled={householdsLoading || state === 'saving'}
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm text-foreground outline-none transition focus:border-ring disabled:opacity-60"
              onChange={(event) =>
                setForm((current) => ({ ...current, householdId: event.target.value }))
              }
            >
              <option value="">我的空间</option>
              {households
                .filter((household) => household.kind === 'shared')
                .map((household) => (
                  <option key={household.id} value={household.id}>
                    {household.name}
                  </option>
                ))}
            </select>
          </FormItem>

          <label className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-border bg-secondary/60 px-4 py-3 text-sm">
            <span>
              <span className="block font-semibold text-foreground">使用默认到期提醒</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {hasExpiryDate
                  ? '入库后按 Pantry 默认规则提醒。'
                  : '未设置保质期时，仅作为普通物品记录。'}
              </span>
            </span>
            <input
              type="checkbox"
              checked={hasExpiryDate && form.reminderEnabled}
              className="size-5 accent-life-ai"
              disabled={state === 'saving' || !hasExpiryDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, reminderEnabled: event.target.checked }))
              }
            />
          </label>

          <FormItem label="备注">
            <textarea
              value={form.note}
              rows={4}
              className="w-full resize-none rounded-2xl border border-border bg-secondary px-4 py-3 text-sm text-foreground outline-none transition focus:border-ring"
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            />
          </FormItem>

          {state === 'done' ? (
            <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
              <Button type="button" variant="outline" onClick={resetFlow}>
                <Camera className="size-4 shrink-0" />
                <span className="whitespace-nowrap">继续拍</span>
              </Button>
              <Button type="button" variant="ai" onClick={() => navigate('/pantry')}>
                <PackageCheck className="size-4 shrink-0" />
                <span className="whitespace-nowrap">查看库存</span>
              </Button>
            </div>
          ) : primaryDuplicateCandidate ? (
            <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
              <Button
                type="button"
                variant="outline"
                className="h-12 whitespace-nowrap"
                disabled={state === 'saving'}
                onClick={() => void savePantryItem('create')}
              >
                <Check className="size-4 shrink-0" />
                <span className="whitespace-nowrap">创建新条目</span>
              </Button>
              <Button
                type="button"
                variant="ai"
                className="h-12 whitespace-nowrap disabled:opacity-80"
                disabled={state === 'saving'}
                onClick={() => void savePantryItem('merge')}
              >
                {state === 'saving' ? (
                  <ActionLoadingIcon className="size-4 shrink-0 text-background" />
                ) : (
                  <PackageCheck className="size-4 shrink-0" />
                )}
                <span className="whitespace-nowrap">
                  {state === 'saving' ? '合并中...' : '合并数量'}
                </span>
              </Button>
            </div>
          ) : (
            <Button
              type="submit"
              variant="ai"
              className="h-12 w-full whitespace-nowrap disabled:opacity-80"
              disabled={state === 'saving'}
            >
              {state === 'saving' ? (
                <ActionLoadingIcon className="size-4 shrink-0 text-background" />
              ) : (
                <Check className="size-4 shrink-0" />
              )}
              <span className="whitespace-nowrap">
                {state === 'saving' ? '入库中...' : '确认入库'}
              </span>
            </Button>
          )}
        </form>
      </BottomSheet>
      <OptionPickerSheet<PantryCategory>
        open={activePicker === 'category'}
        title="选择分类"
        value={form.category}
        options={categoryPickerOptions}
        onOpenChange={(nextOpen) => setActivePicker(nextOpen ? 'category' : null)}
        onSelect={(value) => setForm((current) => ({ ...current, category: value }))}
      />
      <OptionPickerSheet<PantryLocation>
        open={activePicker === 'location'}
        title="选择位置"
        value={form.location}
        options={locationPickerOptions}
        onOpenChange={(nextOpen) => setActivePicker(nextOpen ? 'location' : null)}
        onSelect={(value) => setForm((current) => ({ ...current, location: value }))}
      />
    </div>
  );
}
