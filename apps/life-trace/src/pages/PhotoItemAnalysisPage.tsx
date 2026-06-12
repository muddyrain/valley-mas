import {
  Camera,
  Check,
  History,
  ImagePlus,
  PackageCheck,
  RefreshCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listHouseholds } from '@/api/household';
import {
  analyzePantryPhoto,
  lookupPantryBarcodeMatch,
  type PantryBarcodeMatchResponse,
  type PantryPhotoAnalysisResponse,
  type PantryPhotoCropBox,
  type PantryPhotoDetectedItem,
} from '@/api/pantry';
import { uploadLifeTraceImage } from '@/api/upload';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { FormItem, PickerFieldButton, SheetSelectField } from '@/components/FormItem';
import { OptionPickerSheet } from '@/components/OptionPickerSheet';
import { PantryExpiryDateField } from '@/components/PantryExpiryDateField';
import { SectionHeader } from '@/components/SectionHeader';
import { SubPageShell } from '@/components/SubPageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  generatePantryTransparentCoverWithFallback,
  getPantryTransparentCoverTechLabel,
} from '@/lib/pantryTransparentCover';
import {
  applyPhotoItemBarcodeMatchToDraftForm,
  buildPhotoItemAnalysisSmartSuggestions,
  buildPhotoItemCropBoxStyle,
  buildPhotoItemDraftFormFromDetectedItem,
  buildPhotoItemMergedPantryInput,
  buildPhotoItemPantryInput,
  calculatePhotoItemCropPreviewLayout,
  createPhotoItemAnalysisHistoryId,
  findPhotoItemAnalysisDuplicateCandidates,
  getLatestPhotoItemAnalysisDraft,
  getNextUnprocessedDetectedItemId,
  getPhotoItemAnalysisDraftById,
  getPhotoItemAnalysisReviewIssues,
  getPhotoItemDetectedItems,
  getPhotoItemModelTag,
  getPhotoItemSelectedDetectedItem,
  isMeaningfulPhotoItemCropBox,
  normalizePhotoItemCropBox,
  type PhotoItemAnalysisCoverMode,
  type PhotoItemAnalysisHistoryItem,
  type PhotoItemAnalysisQualityRating,
  type PhotoItemAnalysisReviewIssue,
  type PhotoItemAnalysisSmartSuggestion,
  type PhotoItemCropPreviewLayout,
  type PhotoItemDraftForm,
  type PhotoItemManualEditedField,
  type PhotoItemOCRSummary,
  readPhotoItemAnalysisHistory,
  summarizePhotoItemOCRHints,
} from '@/lib/photoItemAnalysis';
import {
  loadPhotoItemAnalysisHistory,
  markPhotoItemAnalysisHistoryQualityFeedback,
  markPhotoItemAnalysisHistorySaved,
  persistPhotoItemAnalysisHistoryItem,
  removePhotoItemAnalysisHistoryItem,
} from '@/lib/photoItemAnalysisCloud';
import {
  getManualPhotoItemBarcode,
  type PhotoItemBarcodeResult,
  scanPhotoItemBarcodeFromFile,
} from '@/lib/photoItemBarcode';
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
  cropReady?: boolean;
  transparentReady?: boolean;
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
const barcodeFormatOptions = [
  { label: '自动', value: '' },
  { label: 'EAN-13', value: 'ean_13' },
  { label: 'EAN-8', value: 'ean_8' },
  { label: 'UPC-A', value: 'upc_a' },
  { label: 'UPC-E', value: 'upc_e' },
  { label: 'Code 128', value: 'code_128' },
  { label: 'QR Code', value: 'qr_code' },
  { label: '其他', value: 'unknown' },
];

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
  barcodeValue: '',
  barcodeFormat: '',
};

function buildAnalysisNote(
  result: PantryPhotoAnalysisResponse,
  detectedItem?: PantryPhotoDetectedItem | null,
) {
  const target = detectedItem ?? getPhotoItemSelectedDetectedItem(result) ?? null;
  const parts = [
    result.summary,
    target?.brand ? `品牌：${target.brand}` : '',
    target?.spec ? `规格：${target.spec}` : '',
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

function isPhotoItemAnalysisAbortError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return error.name === 'AbortError' || message.includes('abort') || message.includes('aborted');
}

type CropPreviewImageProps = {
  src: string;
  alt: string;
  cropBox?: PantryPhotoCropBox;
  cropEnabled: boolean;
};

function CropPreviewImage({ src, alt, cropBox, cropEnabled }: CropPreviewImageProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const cropKey = cropBox ? `${cropBox.x}:${cropBox.y}:${cropBox.width}:${cropBox.height}` : 'none';
  const previewKey = `${src}:${cropEnabled ? 'crop' : 'original'}:${cropKey}`;
  const [layoutState, setLayoutState] = useState<{
    key: string;
    layout: PhotoItemCropPreviewLayout | null;
  } | null>(null);
  const layout = layoutState?.key === previewKey ? layoutState.layout : null;

  const updateCropLayout = useCallback(() => {
    if (!cropEnabled) {
      setLayoutState({ key: previewKey, layout: null });
      return;
    }

    const frameElement = frameRef.current;
    const imageElement = imageRef.current;
    if (!frameElement || !imageElement || !imageElement.naturalWidth) {
      return;
    }

    const bounds = frameElement.getBoundingClientRect();
    setLayoutState({
      key: previewKey,
      layout: calculatePhotoItemCropPreviewLayout({
        containerWidth: bounds.width,
        containerHeight: bounds.height,
        naturalWidth: imageElement.naturalWidth,
        naturalHeight: imageElement.naturalHeight,
        cropBox,
      }),
    });
  }, [cropBox, cropEnabled, previewKey]);

  useEffect(() => {
    if (!cropEnabled) {
      return;
    }

    updateCropLayout();
    const frameElement = frameRef.current;
    if (!frameElement || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateCropLayout);
    observer.observe(frameElement);
    return () => observer.disconnect();
  }, [cropEnabled, updateCropLayout]);

  const cropStyle = layout
    ? {
        width: `${layout.width}px`,
        height: `${layout.height}px`,
        transform: `translate3d(${layout.left}px, ${layout.top}px, 0)`,
      }
    : undefined;

  return (
    <div ref={frameRef} className="relative h-full w-full overflow-hidden">
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        className={
          layout
            ? 'absolute left-0 top-0 max-w-none select-none'
            : 'h-full w-full select-none object-cover'
        }
        style={cropStyle}
        onLoad={updateCropLayout}
      />
    </div>
  );
}

function CoverModeSelector({
  value,
  disabled = false,
  cropReady = true,
  transparentReady = false,
  size = 'md',
  onChange,
}: CoverModeSelectorProps) {
  const buttonClassName =
    size === 'sm'
      ? 'min-h-12 rounded-2xl border px-3 py-2 text-xs font-semibold transition'
      : 'min-h-14 rounded-2xl border px-3 py-2 text-sm font-semibold transition';

  return (
    <div className="grid grid-cols-3 gap-2">
      <button
        type="button"
        className={`${buttonClassName} flex flex-col items-center justify-center gap-0.5 ${
          value === 'crop'
            ? 'border-life-trace/40 bg-life-trace/10 text-life-trace'
            : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
        }`}
        disabled={disabled || !cropReady}
        onClick={() => onChange('crop')}
      >
        <span className="whitespace-nowrap">裁剪主体</span>
        <span className="whitespace-nowrap text-[10px] font-medium opacity-75">
          {cropReady ? '生成封面' : '无裁剪'}
        </span>
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
      <button
        type="button"
        className={`${buttonClassName} flex flex-col items-center justify-center gap-0.5 ${
          value === 'transparent'
            ? 'border-life-health/40 bg-life-health/10 text-life-health'
            : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
        }`}
        disabled={disabled || !transparentReady}
        onClick={() => onChange('transparent')}
      >
        <span className="whitespace-nowrap">透明封面</span>
        <span className="whitespace-nowrap text-[10px] font-medium opacity-75">
          {transparentReady ? '已生成' : '先生成'}
        </span>
      </button>
    </div>
  );
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
  const normalized = normalizePhotoItemCropBox(cropBox);
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
  const [searchParams] = useSearchParams();
  const requestedDraftId = searchParams.get('draftId') || '';
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
  const handledRequestedDraftIdRef = useRef('');
  const barcodeLookupKeyRef = useRef('');
  const analysisAbortRef = useRef<AbortController | null>(null);
  const manualEditedFieldsRef = useRef<Set<PhotoItemManualEditedField>>(new Set());
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
  const [transparentCoverUrl, setTransparentCoverUrl] = useState('');
  const [transparentCoverTechLabel, setTransparentCoverTechLabel] = useState('');
  const [transparentCoverGenerating, setTransparentCoverGenerating] = useState(false);
  const [transparentCoverError, setTransparentCoverError] = useState('');
  const [historyItems, setHistoryItems] = useState<PhotoItemAnalysisHistoryItem[]>(() =>
    readPhotoItemAnalysisHistory(),
  );
  const [currentHistoryId, setCurrentHistoryId] = useState('');
  const [selectedDetectedItemId, setSelectedDetectedItemId] = useState('');
  const [processedDetectedItemIds, setProcessedDetectedItemIds] = useState<string[]>([]);
  const [barcodeScanning, setBarcodeScanning] = useState(false);
  const [barcodeMatching, setBarcodeMatching] = useState(false);
  const [barcodeMatch, setBarcodeMatch] = useState<PantryBarcodeMatchResponse | null>(null);
  const [barcodeStatusText, setBarcodeStatusText] = useState('');
  const householdOptions = useMemo(
    () => [
      { label: '我的空间', value: '' },
      ...households
        .filter((household) => household.kind === 'shared')
        .map((household) => ({ label: household.name, value: household.id })),
    ],
    [households],
  );

  const cameraActive = state === 'camera-ready';
  const busy = state === 'uploading' || state === 'analyzing' || state === 'saving';
  const visionProcessing = state === 'uploading' || state === 'analyzing';
  const reviewReady = Boolean(analysis);
  const scannerStatusLabel = state === 'done' ? '已入库' : busy ? '处理中' : '待确认';
  const visionStageLabel =
    state === 'uploading' ? '正在同步影像' : state === 'analyzing' ? '正在解析商品' : '视觉待命';
  const detectedItems = useMemo(
    () => (analysis ? getPhotoItemDetectedItems(analysis) : []),
    [analysis],
  );
  const modelTag = useMemo(() => (analysis ? getPhotoItemModelTag(analysis) : ''), [analysis]);
  const selectedDetectedItem = useMemo(
    () => (analysis ? getPhotoItemSelectedDetectedItem(analysis, selectedDetectedItemId) : null),
    [analysis, selectedDetectedItemId],
  );
  const activeCropBox = selectedDetectedItem?.cropBox ?? analysis?.cropBox;
  const hasExpiryDate = Boolean(form.expiresAt.trim());
  const barcodeResult = getManualPhotoItemBarcode(form.barcodeValue ?? '', form.barcodeFormat);
  const barcodeLookupValue = barcodeResult?.value ?? '';
  const barcodeLookupFormat = barcodeResult?.format ?? '';
  const hasCropSuggestion = Boolean(normalizePhotoItemCropBox(activeCropBox));
  const hasMeaningfulCropSuggestion = isMeaningfulPhotoItemCropBox(activeCropBox);
  const cropBoxStyle = useMemo(
    () => (hasMeaningfulCropSuggestion ? buildPhotoItemCropBoxStyle(activeCropBox) : null),
    [activeCropBox, hasMeaningfulCropSuggestion],
  );
  const latestDraft = useMemo(
    () =>
      currentHistoryId || requestedDraftId
        ? null
        : (historyItems.find((item) => item.status === 'draft') ??
          getLatestPhotoItemAnalysisDraft()),
    [currentHistoryId, historyItems, requestedDraftId],
  );
  const requestedDraft = useMemo(
    () =>
      requestedDraftId
        ? (historyItems.find((item) => item.id === requestedDraftId && item.status === 'draft') ??
          getPhotoItemAnalysisDraftById(requestedDraftId))
        : null,
    [historyItems, requestedDraftId],
  );
  const currentHistoryItem = useMemo(
    () => historyItems.find((item) => item.id === currentHistoryId) ?? null,
    [currentHistoryId, historyItems],
  );
  const remainingDetectedItemCount = useMemo(
    () => detectedItems.filter((item) => !processedDetectedItemIds.includes(item.id)).length,
    [detectedItems, processedDetectedItemIds],
  );
  const batchDetectedItems = useMemo(() => {
    const processed = new Set(processedDetectedItemIds);
    const pendingItems = detectedItems.filter((item) => !processed.has(item.id));
    if (!selectedDetectedItem || processed.has(selectedDetectedItem.id)) {
      return pendingItems;
    }
    return [
      selectedDetectedItem,
      ...pendingItems.filter((item) => item.id !== selectedDetectedItem.id),
    ];
  }, [detectedItems, processedDetectedItemIds, selectedDetectedItem]);
  const batchDetectedItemCount = batchDetectedItems.length;
  const ocrSummary = useMemo<PhotoItemOCRSummary | null>(
    () => summarizePhotoItemOCRHints(analysis?.ocrHints ?? [], selectedDetectedItem),
    [analysis?.ocrHints, selectedDetectedItem],
  );
  const canRemoveCurrentDraft = currentHistoryItem?.status === 'draft';
  const reviewIssues = useMemo(
    () =>
      analysis ? getPhotoItemAnalysisReviewIssues(analysis, form, selectedDetectedItemId) : [],
    [analysis, form, selectedDetectedItemId],
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

  const persistHistoryItem = useCallback(
    (item: PhotoItemAnalysisHistoryItem) => {
      void persistPhotoItemAnalysisHistoryItem(token, item).then(setHistoryItems);
      setHistoryItems(readPhotoItemAnalysisHistory());
    },
    [token],
  );

  useEffect(() => {
    setForm((current) => ({
      ...current,
      householdId: current.householdId || preferredPantryHouseholdId,
      reminderEnabled: current.expiresAt ? pantryPreferences.defaultReminderEnabled : false,
    }));
  }, [pantryPreferences.defaultReminderEnabled, preferredPantryHouseholdId]);

  useEffect(() => {
    let cancelled = false;
    void loadPhotoItemAnalysisHistory(token).then((items) => {
      if (!cancelled) {
        setHistoryItems(items);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

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
    if (!token || !barcodeLookupValue) {
      barcodeLookupKeyRef.current = '';
      setBarcodeMatch(null);
      setBarcodeMatching(false);
      return;
    }

    const lookupKey = [barcodeLookupValue, barcodeLookupFormat, form.householdId].join('|');
    barcodeLookupKeyRef.current = lookupKey;
    let cancelled = false;
    setBarcodeMatching(true);

    lookupPantryBarcodeMatch(token, {
      barcodeValue: barcodeLookupValue,
      barcodeFormat: barcodeLookupFormat,
      householdId: form.householdId || undefined,
    })
      .then((match) => {
        if (cancelled || barcodeLookupKeyRef.current !== lookupKey) {
          return;
        }
        setBarcodeMatch(match.matched ? match : null);
        if (match.matched) {
          setForm((current) =>
            applyPhotoItemBarcodeMatchToDraftForm(current, match, manualEditedFieldsRef.current),
          );
          setBarcodeStatusText(`来自历史确认：${match.name || '已保存商品'}。`);
        }
      })
      .catch(() => {
        if (cancelled || barcodeLookupKeyRef.current !== lookupKey) {
          return;
        }
        setBarcodeMatch(null);
      })
      .finally(() => {
        if (!cancelled && barcodeLookupKeyRef.current === lookupKey) {
          setBarcodeMatching(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [barcodeLookupFormat, barcodeLookupValue, form.householdId, token]);

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
    persistHistoryItem({
      id: currentHistoryId,
      imageUrl: uploadedImageUrl,
      imageName: existing?.imageName,
      analysis,
      form,
      selectedDetectedItemId,
      processedDetectedItemIds,
      ocrHints: analysis.ocrHints,
      expiryBaseDate,
      householdName: selectedHouseholdName,
      status: 'draft',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      coverMode,
      transparentCoverUrl,
      transparentCoverTechLabel,
      qualityFeedback: existing?.qualityFeedback,
    });
  }, [
    analysis,
    currentHistoryId,
    coverMode,
    expiryBaseDate,
    form,
    processedDetectedItemIds,
    persistHistoryItem,
    selectedDetectedItemId,
    selectedHouseholdName,
    state,
    transparentCoverTechLabel,
    transparentCoverUrl,
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

  useEffect(
    () => () => {
      analysisAbortRef.current?.abort();
    },
    [],
  );

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

  const markManualEditedField = useCallback((field: PhotoItemManualEditedField) => {
    manualEditedFieldsRef.current.add(field);
  }, []);

  const applyBarcodeResult = useCallback((result: PhotoItemBarcodeResult) => {
    setForm((current) => ({
      ...current,
      barcodeValue: result.value,
      barcodeFormat: result.format,
    }));
    setBarcodeStatusText(result.source === 'native' ? '已识别包装编码。' : '已填写包装编码。');
  }, []);

  const scanBarcodeForFile = useCallback(
    async (file: File) => {
      setBarcodeScanning(true);
      setBarcodeStatusText('');
      try {
        const result = await scanPhotoItemBarcodeFromFile(file);
        if (result) {
          applyBarcodeResult(result);
        } else {
          setBarcodeStatusText('未识别到包装编码，可手动填写。');
        }
      } catch {
        setBarcodeStatusText('当前浏览器不支持自动识别，可手动填写。');
      } finally {
        setBarcodeScanning(false);
      }
    },
    [applyBarcodeResult],
  );

  const updateImageFile = (file: File) => {
    analysisAbortRef.current?.abort();
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setUploadedImageUrl('');
    setAnalysis(null);
    setCoverMode('original');
    setTransparentCoverUrl('');
    setTransparentCoverTechLabel('');
    setTransparentCoverGenerating(false);
    setTransparentCoverError('');
    setForm((current) => ({ ...current, barcodeValue: '', barcodeFormat: '' }));
    setBarcodeMatch(null);
    setBarcodeMatching(false);
    setBarcodeStatusText('');
    manualEditedFieldsRef.current = new Set();
    setCurrentHistoryId('');
    setSelectedDetectedItemId('');
    setProcessedDetectedItemIds([]);
    setReviewSheetOpen(false);
    setError('');
    setState('captured');
    void scanBarcodeForFile(file);
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
    analysisAbortRef.current?.abort();
    const analysisAbortController = new AbortController();
    analysisAbortRef.current = analysisAbortController;
    try {
      const upload = await uploadLifeTraceImage(token, imageFile, {
        signal: analysisAbortController.signal,
      });
      if (
        analysisAbortController.signal.aborted ||
        analysisAbortRef.current !== analysisAbortController
      ) {
        return;
      }
      setUploadedImageUrl(upload.url);
      setState('analyzing');
      const result = await analyzePantryPhoto(
        token,
        {
          imageUrl: upload.url,
          householdId: form.householdId || undefined,
          barcodeValue: barcodeResult?.value,
          barcodeFormat: barcodeResult?.format,
          barcodeSource: barcodeResult?.source,
        },
        { signal: analysisAbortController.signal },
      );
      if (
        analysisAbortController.signal.aborted ||
        analysisAbortRef.current !== analysisAbortController
      ) {
        return;
      }
      const selectedItem =
        getPhotoItemSelectedDetectedItem(result) ?? getPhotoItemDetectedItems(result)[0];
      const nextNote = buildAnalysisNote(result, selectedItem);
      const nextForm: DraftForm = selectedItem
        ? {
            ...buildPhotoItemDraftFormFromDetectedItem(
              selectedItem,
              {
                ...form,
                householdId:
                  resolveSelectableHouseholdId(result.householdId, households) || form.householdId,
              },
              pantryPreferences,
              nextNote,
              {
                barcodeMatch,
                manualEditedFields: manualEditedFieldsRef.current,
              },
            ),
            openedAt: '',
            householdId:
              resolveSelectableHouseholdId(result.householdId, households) || form.householdId,
          }
        : {
            ...form,
            note: nextNote,
            householdId:
              resolveSelectableHouseholdId(result.householdId, households) || form.householdId,
          };
      const nextSelectedDetectedItemId = selectedItem?.id || '';
      const nextExpiryBaseDate = selectedItem?.productionDate || selectedItem?.purchaseDate || '';
      const historyId = createPhotoItemAnalysisHistoryId();
      const nextCoverMode: PhotoItemAnalysisCoverMode = isMeaningfulPhotoItemCropBox(
        selectedItem?.cropBox ?? result.cropBox,
      )
        ? 'crop'
        : 'original';
      setAnalysis(result);
      setForm(
        applyPhotoItemBarcodeMatchToDraftForm(
          nextForm,
          barcodeMatch,
          manualEditedFieldsRef.current,
        ),
      );
      setExpiryBaseDate(nextExpiryBaseDate);
      setCoverMode(nextCoverMode);
      setCurrentHistoryId(historyId);
      setSelectedDetectedItemId(nextSelectedDetectedItemId);
      setProcessedDetectedItemIds([]);
      persistHistoryItem({
        id: historyId,
        imageUrl: upload.url,
        imageName: getFallbackFileName(imageFile),
        analysis: result,
        form: applyPhotoItemBarcodeMatchToDraftForm(
          nextForm,
          barcodeMatch,
          manualEditedFieldsRef.current,
        ),
        selectedDetectedItemId: nextSelectedDetectedItemId,
        processedDetectedItemIds: [],
        ocrHints: result.ocrHints,
        expiryBaseDate: nextExpiryBaseDate,
        householdName: selectedHouseholdName,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        coverMode: nextCoverMode,
      });
      setState('reviewing');
      setReviewSheetOpen(true);
      showToast('商品识别完成，请确认后入库。', 'success');
    } catch (analysisError) {
      if (analysisAbortController.signal.aborted || isPhotoItemAnalysisAbortError(analysisError)) {
        return;
      }
      setState('captured');
      setError(
        analysisError instanceof Error ? analysisError.message : '商品分析失败，请稍后再试。',
      );
    } finally {
      if (analysisAbortRef.current === analysisAbortController) {
        analysisAbortRef.current = null;
      }
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
      const currentDetectedItem = selectedDetectedItem;
      let thumbnailUrl = '';
      if (!mergeCandidate && coverMode === 'transparent' && transparentCoverUrl) {
        thumbnailUrl = transparentCoverUrl;
      } else if (!mergeCandidate && token && currentDetectedItem && coverMode === 'crop') {
        const sourceFile = await loadCoverSourceFile(imageFile, uploadedImageUrl);
        const coverFile = await createCroppedCoverFile(
          sourceFile,
          currentDetectedItem.cropBox ??
            analysis?.cropBox ?? { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
        );
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
        const nextProcessedDetectedItemIds = currentDetectedItem
          ? [...processedDetectedItemIds, currentDetectedItem.id]
          : processedDetectedItemIds;
        const nextDetectedItemId = analysis
          ? getNextUnprocessedDetectedItemId(
              analysis,
              nextProcessedDetectedItemIds,
              currentDetectedItem?.id,
            )
          : '';

        if (nextDetectedItemId) {
          const nextDetectedItem = analysis
            ? getPhotoItemSelectedDetectedItem(analysis, nextDetectedItemId)
            : null;
          if (analysis && nextDetectedItem) {
            const nextNote = buildAnalysisNote(analysis, nextDetectedItem);
            void markPhotoItemAnalysisHistorySaved(token, currentHistoryId, item.id).then(
              setHistoryItems,
            );
            const nextHistoryId = createPhotoItemAnalysisHistoryId();
            const nextDraftForm = {
              ...buildPhotoItemDraftFormFromDetectedItem(
                nextDetectedItem,
                { ...form, householdId: form.householdId },
                pantryPreferences,
                nextNote,
                {
                  barcodeMatch,
                  manualEditedFields: manualEditedFieldsRef.current,
                },
              ),
              householdId: form.householdId,
              openedAt: '',
            };
            setProcessedDetectedItemIds(nextProcessedDetectedItemIds);
            setSelectedDetectedItemId(nextDetectedItemId);
            setCurrentHistoryId(nextHistoryId);
            setForm(nextDraftForm);
            setExpiryBaseDate(
              nextDetectedItem.productionDate || nextDetectedItem.purchaseDate || '',
            );
            persistHistoryItem({
              id: nextHistoryId,
              imageUrl: uploadedImageUrl,
              imageName:
                currentHistoryItem?.imageName ??
                (imageFile ? getFallbackFileName(imageFile) : undefined),
              analysis,
              form: nextDraftForm,
              selectedDetectedItemId: nextDetectedItemId,
              processedDetectedItemIds: nextProcessedDetectedItemIds,
              ocrHints: analysis.ocrHints,
              expiryBaseDate:
                nextDetectedItem.productionDate || nextDetectedItem.purchaseDate || '',
              householdName: selectedHouseholdName,
              status: 'draft',
              coverMode,
              transparentCoverUrl,
              transparentCoverTechLabel,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            setState('reviewing');
            setReviewSheetOpen(true);
            showToast(`已保存一件，继续确认下一件：${nextDetectedItem.name}`, 'success');
            return;
          }
        }

        void markPhotoItemAnalysisHistorySaved(token, currentHistoryId, item.id).then(
          setHistoryItems,
        );
      }
      setState('done');
      setCurrentHistoryId('');
      setReviewSheetOpen(false);
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

  const saveBatchPantryItems = async () => {
    if (!analysis || batchDetectedItems.length <= 1) {
      return;
    }
    if (!form.name.trim()) {
      setError('请先确认当前商品名称。');
      return;
    }

    setState('saving');
    setError('');
    const createdItems: Array<{ id: string; name: string }> = [];
    const savedDetectedItemIds: string[] = [];

    try {
      let currentThumbnailUrl = '';
      if (coverMode === 'transparent' && transparentCoverUrl) {
        currentThumbnailUrl = transparentCoverUrl;
      } else if (token && selectedDetectedItem && coverMode === 'crop') {
        const sourceFile = await loadCoverSourceFile(imageFile, uploadedImageUrl);
        const coverFile = await createCroppedCoverFile(
          sourceFile,
          selectedDetectedItem.cropBox ??
            analysis.cropBox ?? { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
        );
        const coverUpload = await uploadLifeTraceImage(token, coverFile);
        currentThumbnailUrl = coverUpload.url;
      }

      for (const detectedItem of batchDetectedItems) {
        const isCurrentItem = detectedItem.id === selectedDetectedItem?.id;
        const nextNote = buildAnalysisNote(analysis, detectedItem);
        const draftForm = isCurrentItem
          ? form
          : {
              ...buildPhotoItemDraftFormFromDetectedItem(
                detectedItem,
                {
                  ...form,
                  openedAt: '',
                  householdId: form.householdId,
                },
                pantryPreferences,
                nextNote,
              ),
              householdId: form.householdId,
              openedAt: '',
            };
        if (!draftForm.name.trim()) {
          throw new Error(`第 ${createdItems.length + 1} 件缺少商品名称，请逐个确认后再入库。`);
        }

        const item = await addPantryItem(
          buildPhotoItemPantryInput({
            form: draftForm,
            pantryPreferences,
            uploadedImageUrl,
            thumbnailUrl: isCurrentItem ? currentThumbnailUrl : '',
          }),
          form.householdId || undefined,
        );
        if (!item) {
          throw new Error('批量入库失败，请稍后重试。');
        }
        createdItems.push({ id: item.id, name: item.name });
        savedDetectedItemIds.push(detectedItem.id);
      }

      void setActivePantryHousehold(
        form.householdId || '',
        form.householdId ? selectedHouseholdName : '',
        { silent: true },
      );

      if (currentHistoryId) {
        const nextProcessedDetectedItemIds = [
          ...new Set([...processedDetectedItemIds, ...savedDetectedItemIds]),
        ];
        const now = new Date().toISOString();
        persistHistoryItem({
          id: currentHistoryId,
          imageUrl: uploadedImageUrl,
          imageName:
            currentHistoryItem?.imageName ??
            (imageFile ? getFallbackFileName(imageFile) : undefined),
          analysis,
          form,
          selectedDetectedItemId,
          processedDetectedItemIds: nextProcessedDetectedItemIds,
          ocrHints: analysis.ocrHints,
          expiryBaseDate,
          householdName: selectedHouseholdName,
          status: 'saved',
          coverMode,
          transparentCoverUrl,
          transparentCoverTechLabel,
          createdAt: currentHistoryItem?.createdAt ?? now,
          updatedAt: now,
          savedAt: now,
          savedItemId: createdItems[0]?.id,
          qualityFeedback: currentHistoryItem?.qualityFeedback,
        });
        setProcessedDetectedItemIds(nextProcessedDetectedItemIds);
      }

      setState('done');
      setCurrentHistoryId('');
      setReviewSheetOpen(false);
      showToast(`已批量入库 ${createdItems.length} 件商品。`, 'success');
    } catch (saveError) {
      const nextProcessedDetectedItemIds = [
        ...new Set([...processedDetectedItemIds, ...savedDetectedItemIds]),
      ];
      if (savedDetectedItemIds.length > 0 && currentHistoryId) {
        const now = new Date().toISOString();
        setProcessedDetectedItemIds(nextProcessedDetectedItemIds);
        persistHistoryItem({
          id: currentHistoryId,
          imageUrl: uploadedImageUrl,
          imageName:
            currentHistoryItem?.imageName ??
            (imageFile ? getFallbackFileName(imageFile) : undefined),
          analysis,
          form,
          selectedDetectedItemId,
          processedDetectedItemIds: nextProcessedDetectedItemIds,
          ocrHints: analysis.ocrHints,
          expiryBaseDate,
          householdName: selectedHouseholdName,
          status: 'draft',
          coverMode,
          transparentCoverUrl,
          transparentCoverTechLabel,
          createdAt: currentHistoryItem?.createdAt ?? now,
          updatedAt: now,
          qualityFeedback: currentHistoryItem?.qualityFeedback,
        });
      }
      setState('reviewing');
      setError(
        savedDetectedItemIds.length > 0
          ? `已入库 ${savedDetectedItemIds.length} 件，剩余商品未完成，请重试。`
          : saveError instanceof Error
            ? saveError.message
            : '批量入库失败，请稍后再试。',
      );
    }
  };

  const handleGenerateTransparentCover = async () => {
    if (!token) {
      setTransparentCoverError('请先登录后再生成透明封面。');
      return;
    }
    if (!imageFile && !uploadedImageUrl) {
      setTransparentCoverError('请先拍照或选择商品图片。');
      return;
    }
    if (transparentCoverGenerating || state === 'saving') {
      return;
    }

    setTransparentCoverGenerating(true);
    setTransparentCoverError('');
    setTransparentCoverTechLabel('');
    setError('');
    try {
      let sourceImageUrl = uploadedImageUrl;
      if (!sourceImageUrl && imageFile) {
        const uploaded = await uploadLifeTraceImage(token, imageFile);
        sourceImageUrl = uploaded.url;
        setUploadedImageUrl(uploaded.url);
      }
      if (!sourceImageUrl) {
        throw new Error('缺少原图，无法生成透明封面。');
      }
      const result = await generatePantryTransparentCoverWithFallback(
        token,
        { imageUrl: sourceImageUrl },
        { sourceImage: imageFile ?? sourceImageUrl },
      );
      setTransparentCoverUrl(result.thumbnailUrl);
      setTransparentCoverTechLabel(getPantryTransparentCoverTechLabel(result));
      setTransparentCoverError('');
      setCoverMode('transparent');
      showToast('透明封面已生成。', 'success');
    } catch (coverError) {
      setTransparentCoverError(
        coverError instanceof Error ? coverError.message : '透明封面生成失败，请稍后再试。',
      );
    } finally {
      setTransparentCoverGenerating(false);
    }
  };

  const resetFlow = () => {
    analysisAbortRef.current?.abort();
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
    setTransparentCoverUrl('');
    setTransparentCoverTechLabel('');
    setTransparentCoverGenerating(false);
    setTransparentCoverError('');
    setCurrentHistoryId('');
    setSelectedDetectedItemId('');
    setProcessedDetectedItemIds([]);
    setReviewSheetOpen(false);
    setActivePicker(null);
    setExpiryBaseDate('');
    setBarcodeScanning(false);
    setBarcodeMatching(false);
    setBarcodeMatch(null);
    setBarcodeStatusText('');
    manualEditedFieldsRef.current = new Set();
    setForm((current) => ({
      ...initialForm,
      householdId: current.householdId,
      reminderEnabled: pantryPreferences.defaultReminderEnabled,
    }));
    setError('');
  };

  const restoreDraft = useCallback(
    (
      draft: PhotoItemAnalysisHistoryItem,
      options: { openSheet?: boolean; silent?: boolean } = {},
    ) => {
      const shouldOpenSheet = options.openSheet ?? true;
      stopCamera();
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      setImageFile(null);
      setImagePreviewUrl(draft.imageUrl);
      setUploadedImageUrl(draft.imageUrl);
      setAnalysis(draft.analysis);
      setForm(draft.form);
      setTransparentCoverUrl(draft.transparentCoverUrl ?? '');
      setTransparentCoverTechLabel(draft.transparentCoverTechLabel ?? '');
      setTransparentCoverGenerating(false);
      setTransparentCoverError('');
      setBarcodeMatch(null);
      manualEditedFieldsRef.current = new Set();
      const restoredSelectedDetectedItem =
        getPhotoItemSelectedDetectedItem(draft.analysis, draft.selectedDetectedItemId) ??
        getPhotoItemDetectedItems(draft.analysis)[0] ??
        null;
      setExpiryBaseDate(
        draft.expiryBaseDate ||
          restoredSelectedDetectedItem?.productionDate ||
          restoredSelectedDetectedItem?.purchaseDate ||
          draft.analysis.productionDate ||
          '',
      );
      setCoverMode(
        draft.coverMode === 'transparent' && draft.transparentCoverUrl
          ? 'transparent'
          : draft.coverMode === 'crop' &&
              isMeaningfulPhotoItemCropBox(
                restoredSelectedDetectedItem?.cropBox ?? draft.analysis.cropBox,
              )
            ? 'crop'
            : 'original',
      );
      setCurrentHistoryId(draft.id);
      setSelectedDetectedItemId(
        restoredSelectedDetectedItem?.id || draft.selectedDetectedItemId || '',
      );
      setProcessedDetectedItemIds(draft.processedDetectedItemIds ?? []);
      setBarcodeScanning(false);
      setBarcodeMatching(false);
      setBarcodeStatusText(draft.form.barcodeValue ? '已恢复包装编码。' : '');
      setState('reviewing');
      setReviewSheetOpen(shouldOpenSheet);
      setActivePicker(null);
      setError('');
      if (!options.silent) {
        showToast('已恢复上次未入库草稿。', 'success');
      }
    },
    [imagePreviewUrl, showToast, stopCamera],
  );

  useEffect(() => {
    if (!requestedDraftId) {
      return;
    }

    if (handledRequestedDraftIdRef.current === requestedDraftId) {
      return;
    }
    handledRequestedDraftIdRef.current = requestedDraftId;

    if (!requestedDraft) {
      showToast('这个拍照草稿已经不存在或已入库。', 'error');
      return;
    }

    restoreDraft(requestedDraft, { openSheet: false, silent: true });
  }, [requestedDraft, requestedDraftId, restoreDraft, showToast]);

  const dismissDraft = (draftId: string) => {
    void removePhotoItemAnalysisHistoryItem(token, draftId).then(setHistoryItems);
    setHistoryItems(readPhotoItemAnalysisHistory());
  };

  const removeCurrentDraft = () => {
    if (!currentHistoryId || currentHistoryItem?.status !== 'draft') {
      return;
    }

    void removePhotoItemAnalysisHistoryItem(token, currentHistoryId).then(setHistoryItems);
    setHistoryItems(readPhotoItemAnalysisHistory());
    showToast('已移除拍照草稿。', 'success');
    navigate('/ai', { replace: true });
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
    void markPhotoItemAnalysisHistoryQualityFeedback(token, currentHistoryId, rating).then(
      setHistoryItems,
    );
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

  const handleSelectDetectedItem = (itemId: string) => {
    if (!analysis) {
      return;
    }

    const nextDetectedItem = getPhotoItemSelectedDetectedItem(analysis, itemId);
    if (!nextDetectedItem) {
      return;
    }

    const nextNote = buildAnalysisNote(analysis, nextDetectedItem);
    setSelectedDetectedItemId(nextDetectedItem.id);
    setCoverMode(isMeaningfulPhotoItemCropBox(nextDetectedItem.cropBox) ? 'crop' : 'original');
    setTransparentCoverUrl('');
    setTransparentCoverTechLabel('');
    setTransparentCoverError('');
    setExpiryBaseDate(nextDetectedItem.productionDate || nextDetectedItem.purchaseDate || '');
    setForm((current) => ({
      ...buildPhotoItemDraftFormFromDetectedItem(
        nextDetectedItem,
        {
          ...current,
          householdId: current.householdId,
          openedAt: '',
        },
        pantryPreferences,
        nextNote,
        {
          barcodeMatch,
          manualEditedFields: manualEditedFieldsRef.current,
        },
      ),
      householdId: current.householdId,
      openedAt: '',
    }));
  };

  const handleBackToAi = () => {
    analysisAbortRef.current?.abort();
    navigate('/ai', { replace: true });
  };

  return (
    <SubPageShell
      title="拍照分析商品"
      eyebrow="Life AI"
      onBack={handleBackToAi}
      contentClassName="space-y-6 pb-2"
    >
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
            {visionProcessing ? (
              <div className="mt-3 border-t border-white/[0.08] pt-3">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-life-ai/25 bg-life-ai/10 text-life-ai">
                      <span className="size-2 animate-pulse rounded-full bg-life-ai shadow-[0_0_16px_rgba(6,182,212,0.9)] motion-reduce:animate-none" />
                    </span>
                    <p className="truncate text-sm font-semibold text-foreground">
                      {visionStageLabel}
                    </p>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-life-trace/25 bg-life-trace/10 px-2.5 py-1 text-[10px] font-semibold text-life-trace">
                      <span className="size-1.5 animate-pulse rounded-full bg-life-trace shadow-[0_0_12px_rgba(16,185,129,0.9)] motion-reduce:animate-none" />
                      处理中
                    </span>
                  </div>
                  <div className="flex w-full justify-center gap-1.5 overflow-hidden">
                    {['主体定位', '字段抽取', '库存匹配'].map((label) => (
                      <span
                        key={label}
                        className="min-w-0 rounded-full border border-life-ai/18 bg-life-ai/10 px-2.5 py-1 text-center text-[10px] font-semibold text-life-ai/90"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative overflow-hidden rounded-[1.45rem] border border-life-ai/25 bg-background/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
            <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,transparent,rgba(6,182,212,0.08),transparent)] opacity-70" />
            <div
              className={`pointer-events-none absolute inset-x-8 z-20 h-px bg-life-ai/80 motion-reduce:animate-none ${
                visionProcessing
                  ? 'top-0 animate-[life-vision-scan_1.9s_ease-in-out_infinite]'
                  : imagePreviewUrl || cameraActive
                    ? 'top-1/2 animate-pulse opacity-70'
                    : 'top-[28%] opacity-35'
              }`}
            />
            <span className="pointer-events-none absolute top-3 left-3 z-20 size-7 border-t-2 border-l-2 border-life-ai" />
            <span className="pointer-events-none absolute top-3 right-3 z-20 size-7 border-t-2 border-r-2 border-life-ai" />
            <span className="pointer-events-none absolute bottom-3 left-3 z-20 size-7 border-b-2 border-l-2 border-life-trace" />
            <span className="pointer-events-none absolute right-3 bottom-3 z-20 size-7 border-r-2 border-b-2 border-life-trace" />

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
                    className="pointer-events-none absolute z-30 rounded-[1rem] border-2 border-life-trace"
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
                  <CoverModeSelector
                    value={coverMode}
                    cropReady={hasMeaningfulCropSuggestion}
                    transparentReady={Boolean(transparentCoverUrl)}
                    onChange={setCoverMode}
                  />
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
          <SectionHeader
            title="AI 识别结果"
            meta={`${Math.round((selectedDetectedItem?.confidence ?? analysis.confidence) * 100)}%`}
          />
          <Card className="space-y-4 p-4">
            {modelTag ? (
              <div className="flex justify-end">
                <Badge tone="ai" className="shrink-0 whitespace-nowrap">
                  {modelTag}
                </Badge>
              </div>
            ) : null}
            {detectedItems.length > 1 ? (
              <div className="rounded-[1.25rem] border border-life-ai/20 bg-life-ai/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-life-ai">候选商品</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      同一张图里识别到 {detectedItems.length} 个候选，当前还剩{' '}
                      {remainingDetectedItemCount} 个待确认。
                    </p>
                  </div>
                  <Badge tone="ai" className="shrink-0">
                    {detectedItems.length} 件
                  </Badge>
                </div>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {detectedItems.map((item, index) => {
                    const active = item.id === selectedDetectedItemId;
                    const processed = processedDetectedItemIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`min-w-[11rem] shrink-0 rounded-2xl border px-3 py-3 text-left transition ${
                          active
                            ? 'border-life-ai/35 bg-life-ai/12 text-foreground'
                            : 'border-border bg-card/80 text-muted-foreground hover:bg-secondary'
                        }`}
                        onClick={() => handleSelectDetectedItem(item.id)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold">
                            候选 {index + 1}
                            {processed ? ' · 已处理' : ''}
                          </span>
                          <span className="text-[11px] font-semibold">
                            {Math.round(item.confidence * 100)}%
                          </span>
                        </div>
                        <p className="mt-2 truncate text-sm font-semibold text-foreground">
                          {item.name}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {[item.brand, item.spec].filter(Boolean).join(' · ') || item.category}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold">
                  {form.name || selectedDetectedItem?.name || analysis.name}
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{analysis.summary}</p>
                {selectedDetectedItem?.brand || selectedDetectedItem?.spec ? (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {[selectedDetectedItem.brand, selectedDetectedItem.spec]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : null}
              </div>
              <Badge tone="plan" className="shrink-0 whitespace-nowrap">
                {selectedDetectedItem?.category || analysis.category}
              </Badge>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-secondary/60 px-4 py-3">
                <p className="text-xs text-muted-foreground">数量</p>
                <p className="mt-1 font-semibold">
                  {selectedDetectedItem?.quantity || analysis.quantity}{' '}
                  {selectedDetectedItem?.unit || analysis.unit}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/60 px-4 py-3">
                <p className="text-xs text-muted-foreground">位置建议</p>
                <p className="mt-1 truncate font-semibold">
                  {selectedDetectedItem?.storageLocation || analysis.storageLocation}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/60 px-4 py-3">
                <p className="text-xs text-muted-foreground">保质期</p>
                <p className="mt-1 truncate font-semibold">
                  {selectedDetectedItem?.expiresAt || analysis.expiresAt || '待确认'}
                </p>
              </div>
            </div>
            {(selectedDetectedItem?.warnings.length || analysis.warnings.length) > 0 ? (
              <div className="space-y-2">
                {(selectedDetectedItem?.warnings.length
                  ? selectedDetectedItem.warnings
                  : analysis.warnings
                ).map((warning) => (
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
                    反馈会保存在云端识别历史里，帮助后续识别更稳定，也方便你继续复核。
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
              onClick={() => {
                if (state === 'done') {
                  navigate('/pantry');
                  return;
                }
                setReviewSheetOpen(true);
              }}
            >
              <Check className="size-4 shrink-0" />
              <span className="whitespace-nowrap">
                {state === 'done' ? '查看库存' : '打开入库确认'}
              </span>
            </Button>
            {canRemoveCurrentDraft ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full border-life-alert/25 text-life-alert hover:bg-life-alert/10 hover:text-life-alert"
                onClick={removeCurrentDraft}
              >
                <Trash2 className="size-4 shrink-0" />
                <span className="whitespace-nowrap">移除草稿</span>
              </Button>
            ) : null}
          </Card>
        </section>
      ) : null}

      <BottomSheet
        open={state !== 'done' && reviewSheetOpen && reviewReady}
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
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border bg-background bg-[linear-gradient(45deg,rgba(255,255,255,0.08)_25%,transparent_25%),linear-gradient(-45deg,rgba(255,255,255,0.08)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,rgba(255,255,255,0.08)_75%),linear-gradient(-45deg,transparent_75%,rgba(255,255,255,0.08)_75%)] bg-[length:12px_12px] bg-[position:0_0,0_6px,6px_-6px,-6px_0px]">
                <CropPreviewImage
                  src={
                    coverMode === 'transparent' && transparentCoverUrl
                      ? transparentCoverUrl
                      : imagePreviewUrl
                  }
                  alt={form.name || analysis?.name || '商品图片'}
                  cropBox={activeCropBox}
                  cropEnabled={coverMode === 'crop' && hasMeaningfulCropSuggestion}
                />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-muted-foreground">当前编辑图片</p>
                  {hasCropSuggestion ? (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        coverMode === 'transparent' && transparentCoverUrl
                          ? 'border-life-health/30 bg-life-health/10 text-life-health'
                          : coverMode === 'crop' && hasMeaningfulCropSuggestion
                            ? 'border-life-trace/30 bg-life-trace/10 text-life-trace'
                            : 'border-life-ai/25 bg-life-ai/10 text-life-ai'
                      }`}
                    >
                      {coverMode === 'transparent' && transparentCoverUrl
                        ? '封面：透明'
                        : coverMode === 'crop' && hasMeaningfulCropSuggestion
                          ? '封面：裁剪主体'
                          : hasMeaningfulCropSuggestion
                            ? '封面：不裁剪'
                            : '主体框接近原图'}
                    </span>
                  ) : null}
                  {coverMode === 'transparent' &&
                  transparentCoverUrl &&
                  transparentCoverTechLabel ? (
                    <span className="rounded-full border border-life-health/30 bg-life-health/10 px-2 py-0.5 text-[10px] font-semibold text-life-health">
                      {transparentCoverTechLabel}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-sm font-semibold">
                  {form.name || analysis?.name || '待确认商品'}
                </p>
                <p className="mt-1 truncate text-xs leading-5 text-muted-foreground">
                  {coverMode === 'transparent' && transparentCoverUrl
                    ? '保存时使用透明封面，原图保留。'
                    : coverMode === 'crop' && hasMeaningfulCropSuggestion
                      ? '保存时生成主体封面，原图保留。'
                      : imageFile
                        ? getFallbackFileName(imageFile)
                        : '商品图片'}
                </p>
              </div>
            </div>
            {state !== 'done' ? (
              <div className="mt-3">
                {hasMeaningfulCropSuggestion || transparentCoverUrl ? (
                  <CoverModeSelector
                    value={coverMode}
                    size="sm"
                    disabled={state === 'saving'}
                    cropReady={hasMeaningfulCropSuggestion}
                    transparentReady={Boolean(transparentCoverUrl)}
                    onChange={setCoverMode}
                  />
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full"
                  disabled={transparentCoverGenerating || state === 'saving'}
                  onClick={() => void handleGenerateTransparentCover()}
                >
                  {transparentCoverGenerating ? (
                    <ActionLoadingIcon className="size-4" tone="ai" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {transparentCoverGenerating
                    ? '生成中...'
                    : transparentCoverUrl
                      ? '重新生成透明封面'
                      : '生成透明封面'}
                </Button>
                {transparentCoverError ? (
                  <p className="mt-2 rounded-2xl border border-life-alert/20 bg-life-alert/10 px-3 py-2 text-xs leading-5 text-life-alert">
                    {transparentCoverError}
                  </p>
                ) : null}
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
            <Input
              value={form.name}
              onChange={(event) => {
                markManualEditedField('name');
                setForm((current) => ({ ...current, name: event.target.value }));
              }}
            />
          </FormItem>

          <div className="rounded-[1.25rem] border border-life-ai/20 bg-life-ai/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-life-ai">包装编码</p>
              <Badge tone={form.barcodeValue ? 'ai' : 'default'} className="shrink-0">
                {barcodeScanning
                  ? '识别中'
                  : barcodeMatching
                    ? '匹配中'
                    : barcodeMatch
                      ? '历史确认'
                      : form.barcodeValue
                        ? '已填写'
                        : '可选'}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {barcodeStatusText || '条码或二维码可帮助确认品牌和规格。'}
            </p>
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_7.25rem] gap-3 max-[360px]:grid-cols-1">
              <FormItem label="编码">
                <Input
                  value={form.barcodeValue ?? ''}
                  disabled={state === 'saving'}
                  placeholder="手动填写"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, barcodeValue: event.target.value }))
                  }
                />
              </FormItem>
              <SheetSelectField
                label="格式"
                value={form.barcodeFormat ?? ''}
                options={barcodeFormatOptions}
                disabled={state === 'saving'}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, barcodeFormat: value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
            <FormItem label="分类">
              <PickerFieldButton
                disabled={state === 'saving'}
                onClick={() => setActivePicker('category')}
              >
                {form.category}
              </PickerFieldButton>
            </FormItem>
            <FormItem label="位置">
              <PickerFieldButton
                disabled={state === 'saving'}
                onClick={() => setActivePicker('location')}
              >
                {form.location}
              </PickerFieldButton>
            </FormItem>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3 max-[360px]:grid-cols-1">
            <FormItem label="数量" required>
              <Input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(event) =>
                  setForm((current) => ({ ...current, quantity: event.target.value }))
                }
              />
            </FormItem>
            <FormItem label="单位">
              <Input
                value={form.unit}
                onChange={(event) => {
                  markManualEditedField('unit');
                  setForm((current) => ({ ...current, unit: event.target.value }));
                }}
              />
            </FormItem>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3">
            <FormItem label="开封日期">
              <Input
                type="date"
                value={form.openedAt}
                disabled={state === 'saving'}
                className="appearance-none"
                onChange={(event) =>
                  setForm((current) => ({ ...current, openedAt: event.target.value }))
                }
              />
            </FormItem>
            {ocrSummary ? (
              <div
                className={`rounded-[1.25rem] border p-3 ${
                  ocrSummary.state === 'auto'
                    ? 'border-life-trace/25 bg-life-trace/5'
                    : ocrSummary.state === 'missing-production'
                      ? 'border-life-alert/25 bg-life-alert/5'
                      : 'border-life-ai/20 bg-life-ai/5'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{ocrSummary.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {ocrSummary.detail}
                    </p>
                  </div>
                  <Badge
                    tone={
                      ocrSummary.state === 'auto'
                        ? 'trace'
                        : ocrSummary.state === 'missing-production'
                          ? 'alert'
                          : 'ai'
                    }
                    className="shrink-0"
                  >
                    OCR
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ocrSummary.entries.map((entry) => (
                    <span
                      key={entry.id}
                      className="rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs text-muted-foreground"
                    >
                      {entry.label}：{entry.normalizedValue || entry.text}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
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

          <SheetSelectField
            label="家庭空间"
            value={form.householdId}
            options={householdOptions}
            disabled={householdsLoading || state === 'saving'}
            onValueChange={(value) => setForm((current) => ({ ...current, householdId: value }))}
          />

          <div className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-border bg-secondary/60 px-4 py-3 text-sm">
            <span>
              <span className="block font-semibold text-foreground">使用默认到期提醒</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {hasExpiryDate
                  ? '入库后按 Pantry 默认规则提醒。'
                  : '未设置保质期时，仅作为普通物品记录。'}
              </span>
            </span>
            <Switch
              size="sm"
              checked={hasExpiryDate && form.reminderEnabled}
              disabled={state === 'saving' || !hasExpiryDate}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, reminderEnabled: checked }))
              }
            />
          </div>

          <FormItem label="备注">
            <Textarea
              value={form.note}
              rows={4}
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
            <div className="grid gap-2">
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
              {batchDetectedItemCount > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full whitespace-nowrap"
                  disabled={state === 'saving'}
                  onClick={() => void saveBatchPantryItems()}
                >
                  {state === 'saving' ? (
                    <ActionLoadingIcon className="size-4 shrink-0" />
                  ) : (
                    <PackageCheck className="size-4 shrink-0" />
                  )}
                  <span className="whitespace-nowrap">
                    {state === 'saving' ? '批量入库中...' : `批量入库 ${batchDetectedItemCount} 件`}
                  </span>
                </Button>
              ) : null}
            </div>
          )}
        </form>
      </BottomSheet>
      <OptionPickerSheet<PantryCategory>
        open={activePicker === 'category'}
        title="选择分类"
        value={form.category}
        options={categoryPickerOptions}
        onOpenChange={(nextOpen) => setActivePicker(nextOpen ? 'category' : null)}
        onSelect={(value) => {
          markManualEditedField('category');
          setForm((current) => ({ ...current, category: value }));
        }}
      />
      <OptionPickerSheet<PantryLocation>
        open={activePicker === 'location'}
        title="选择位置"
        value={form.location}
        options={locationPickerOptions}
        onOpenChange={(nextOpen) => setActivePicker(nextOpen ? 'location' : null)}
        onSelect={(value) => {
          markManualEditedField('location');
          setForm((current) => ({ ...current, location: value }));
        }}
      />
    </SubPageShell>
  );
}
