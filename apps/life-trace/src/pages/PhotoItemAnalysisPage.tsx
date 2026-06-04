import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  ImagePlus,
  PackageCheck,
  RefreshCcw,
  Sparkles,
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
import { OptionPickerSheet } from '@/components/OptionPickerSheet';
import { SectionHeader } from '@/components/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { buildDefaultPantryReminder } from '@/lib/pantry';
import { useAuthStore } from '@/store/useAuthStore';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { HouseholdSummary, NewPantryItemInput, PantryCategory, PantryLocation } from '@/types';

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

type DraftForm = {
  name: string;
  category: PantryCategory;
  quantity: string;
  unit: string;
  location: PantryLocation;
  expiresAt: string;
  openedAt: string;
  note: string;
  householdId: string;
  reminderEnabled: boolean;
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

function getTodayISODate() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function normalizeCropBox(box?: PantryPhotoCropBox): PantryPhotoCropBox {
  if (!box || box.width <= 0 || box.height <= 0) {
    return { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };
  }
  const width = Math.min(1, Math.max(0.1, box.width));
  const height = Math.min(1, Math.max(0.1, box.height));
  return {
    x: Math.min(1 - width, Math.max(0, box.x)),
    y: Math.min(1 - height, Math.max(0, box.y)),
    width,
    height,
  };
}

function cropBoxToInitialPercentages(box?: PantryPhotoCropBox): Area {
  const normalized = normalizeCropBox(box);
  return {
    x: normalized.x * 100,
    y: normalized.y * 100,
    width: normalized.width * 100,
    height: normalized.height * 100,
  };
}

function buildAnalysisNote(result: PantryPhotoAnalysisResponse) {
  const parts = [
    result.summary,
    result.brand ? `品牌：${result.brand}` : '',
    result.spec ? `规格：${result.spec}` : '',
    result.tags?.length ? `标签：${result.tags.join('、')}` : '',
  ].filter(Boolean);
  return parts.join('\n');
}

function createImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('图片读取失败')));
    image.src = src;
  });
}

async function createCroppedImageFile(imageSrc: string, cropPixels: Area) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(cropPixels.width));
  canvas.height = Math.max(1, Math.round(cropPixels.height));
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('当前浏览器不支持图片裁剪');
  }
  context.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (!value) {
          reject(new Error('裁剪图片生成失败'));
          return;
        }
        resolve(value);
      },
      'image/jpeg',
      0.88,
    );
  });

  return new File([blob], `pantry-item-${Date.now()}.jpg`, { type: 'image/jpeg' });
}

function getFallbackFileName(file: File) {
  return file.name || `pantry-photo-${Date.now()}.jpg`;
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

export function PhotoItemAnalysisPage() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const addPantryItem = useLifeTraceStore((state) => state.addPantryItem);
  const pantryPreferences = useLifeTraceStore((state) => state.pantryPreferences);
  const preferredPantryHouseholdId = useLifeTraceStore((state) => state.preferredPantryHouseholdId);
  const preferredPantryHouseholdName = useLifeTraceStore(
    (state) => state.preferredPantryHouseholdName,
  );
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
  const [croppedImageUrl, setCroppedImageUrl] = useState('');
  const [analysis, setAnalysis] = useState<PantryPhotoAnalysisResponse | null>(null);
  const [form, setForm] = useState<DraftForm>(initialForm);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [householdsLoading, setHouseholdsLoading] = useState(false);
  const [error, setError] = useState('');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [activePicker, setActivePicker] = useState<'category' | 'location' | null>(null);

  const cameraActive = state === 'camera-ready';
  const busy = state === 'uploading' || state === 'analyzing' || state === 'saving';
  const reviewReady = Boolean(analysis);
  const scannerStatusLabel = state === 'done' ? '已入库' : busy ? '处理中' : '待确认';
  const hasExpiryDate = Boolean(form.expiresAt.trim());
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
      householdId: preferredPantryHouseholdId,
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
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

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
    setCroppedImageUrl('');
    setAnalysis(null);
    setReviewSheetOpen(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
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
      setAnalysis(result);
      setForm((current) => ({
        ...current,
        name: result.name || current.name,
        category: result.category || current.category,
        quantity: String(result.quantity || 1),
        unit: result.unit || current.unit,
        location: result.storageLocation || current.location,
        expiresAt: result.expiresAt || '',
        openedAt: result.purchaseDate || getTodayISODate(),
        note: buildAnalysisNote(result),
        householdId:
          resolveSelectableHouseholdId(result.householdId, households) || current.householdId,
        reminderEnabled: Boolean(result.expiresAt) && pantryPreferences.defaultReminderEnabled,
      }));
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
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

  const savePantryItem = async () => {
    if (!form.name.trim()) {
      setError('请先确认商品名称。');
      return;
    }

    setState('saving');
    setError('');
    try {
      let thumbnailUrl = croppedImageUrl;
      if (token && imagePreviewUrl && croppedAreaPixels) {
        const croppedFile = await createCroppedImageFile(imagePreviewUrl, croppedAreaPixels);
        const upload = await uploadLifeTraceImage(token, croppedFile);
        thumbnailUrl = upload.url;
        setCroppedImageUrl(upload.url);
      }

      const expiresAt = form.expiresAt.trim();
      const openedAt = form.openedAt.trim();
      const shouldPersistActiveHousehold = form.householdId !== preferredPantryHouseholdId;
      const input: NewPantryItemInput = {
        householdId: form.householdId || undefined,
        name: form.name.trim(),
        category: form.category,
        quantity: Number.parseInt(form.quantity, 10) || 1,
        unit: form.unit.trim() || '件',
        location: form.location,
        expiresAt: expiresAt || undefined,
        openedAt: openedAt || undefined,
        note: form.note.trim(),
        imageUrl: uploadedImageUrl || undefined,
        thumbnailUrl: thumbnailUrl || uploadedImageUrl || undefined,
        status: 'normal',
        reminder: buildDefaultPantryReminder(
          pantryPreferences,
          Boolean(expiresAt) && form.reminderEnabled,
        ),
      };

      const item = await addPantryItem(input, form.householdId || undefined);
      if (!item) {
        throw new Error('入库失败，请稍后重试。');
      }
      if (shouldPersistActiveHousehold) {
        void setActivePantryHousehold(
          form.householdId || '',
          form.householdId ? selectedHouseholdName : '',
          { silent: true },
        );
      }
      setState('done');
      setReviewSheetOpen(true);
      showToast(`「${item.name}」已加入${selectedHouseholdName}`, 'success');
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
    setCroppedImageUrl('');
    setAnalysis(null);
    setReviewSheetOpen(false);
    setActivePicker(null);
    setForm((current) => ({
      ...initialForm,
      householdId: current.householdId,
      reminderEnabled: pantryPreferences.defaultReminderEnabled,
    }));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setError('');
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

          <div className="grid grid-cols-3 gap-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground min-[390px]:text-[10px] min-[390px]:tracking-[0.12em]">
            <span className="truncate whitespace-nowrap rounded-full border border-life-ai/20 bg-background/45 px-2 py-2 text-center text-life-ai min-[390px]:px-2.5">
              Vision Ready
            </span>
            <span className="truncate whitespace-nowrap rounded-full border border-life-trace/20 bg-background/45 px-2 py-2 text-center text-life-trace min-[390px]:px-2.5">
              Pantry Sync
            </span>
            <span className="truncate whitespace-nowrap rounded-full border border-border bg-background/45 px-2 py-2 text-center min-[390px]:px-2.5">
              Manual Edit
            </span>
          </div>

          <div className="relative overflow-hidden rounded-[1.45rem] border border-life-ai/25 bg-background/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
            <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,transparent,rgba(6,182,212,0.08),transparent)] opacity-70" />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 z-20 h-px animate-pulse bg-life-ai/80 shadow-[0_0_24px_rgba(6,182,212,0.75)] motion-reduce:animate-none" />
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
              <img
                src={imagePreviewUrl}
                alt="商品预览"
                className="aspect-[4/3] w-full object-cover sm:aspect-[16/10]"
              />
            ) : (
              <div className="grid aspect-[4/3] place-items-center px-5 text-center sm:aspect-[16/10]">
                <div className="max-w-xs space-y-4">
                  <div className="mx-auto grid size-16 place-items-center rounded-[1.35rem] border border-life-ai/25 bg-life-ai/10 text-life-ai shadow-[0_0_38px_rgba(6,182,212,0.18)]">
                    <Camera className="size-8" />
                  </div>
                  <div>
                    <p className="text-base font-semibold">等待商品进入取景框</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      建议让包装正面占据画面中央，减少反光和遮挡。
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

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
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold">{analysis.name}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{analysis.summary}</p>
              </div>
              <Badge tone="plan">{analysis.category}</Badge>
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
          </Card>
        </section>
      ) : null}

      {analysis && imagePreviewUrl ? (
        <section>
          <SectionHeader title="裁剪商品封面" meta="可拖动缩放" />
          <Card className="space-y-4 p-4">
            <div className="relative h-72 overflow-hidden rounded-[1.25rem] border border-border bg-black">
              <Cropper
                image={imagePreviewUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                showGrid={false}
                initialCroppedAreaPercentages={cropBoxToInitialPercentages(analysis.cropBox)}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
              />
            </div>
            <label className="block space-y-2 text-sm">
              <span className="text-muted-foreground">缩放</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                className="w-full accent-life-ai"
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
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

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (state !== 'done') {
              void savePantryItem();
            }
          }}
        >
          <label className="block space-y-2">
            <span className="text-sm font-medium">
              商品名称 <span className="text-life-alert">*</span>
            </span>
            <input
              value={form.name}
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm text-foreground outline-none transition focus:border-ring"
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>

          <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
            <div className="block space-y-2">
              <span className="text-sm font-medium">分类</span>
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
            </div>
            <div className="block space-y-2">
              <span className="text-sm font-medium">位置</span>
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
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3 max-[360px]:grid-cols-1">
            <label className="block space-y-2">
              <span className="text-sm font-medium">
                数量 <span className="text-life-alert">*</span>
              </span>
              <input
                type="number"
                min="1"
                value={form.quantity}
                className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm text-foreground outline-none transition focus:border-ring"
                onChange={(event) =>
                  setForm((current) => ({ ...current, quantity: event.target.value }))
                }
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">单位</span>
              <input
                value={form.unit}
                className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm text-foreground outline-none transition focus:border-ring"
                onChange={(event) =>
                  setForm((current) => ({ ...current, unit: event.target.value }))
                }
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
            <label className="block space-y-2">
              <span className="text-sm font-medium">购买</span>
              <input
                type="date"
                value={form.openedAt}
                className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm text-foreground outline-none transition focus:border-ring"
                onChange={(event) =>
                  setForm((current) => ({ ...current, openedAt: event.target.value }))
                }
              />
            </label>
            <label className="block space-y-2">
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">保质期</span>
                {form.expiresAt ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-life-ai"
                    disabled={state === 'saving'}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        expiresAt: '',
                        reminderEnabled: false,
                      }))
                    }
                  >
                    无保质期
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">可不填</span>
                )}
              </span>
              <input
                type="date"
                value={form.expiresAt}
                className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm text-foreground outline-none transition focus:border-ring"
                onChange={(event) =>
                  setForm((current) => {
                    const nextExpiresAt = event.target.value;
                    return {
                      ...current,
                      expiresAt: nextExpiresAt,
                      reminderEnabled: nextExpiresAt
                        ? current.reminderEnabled || pantryPreferences.defaultReminderEnabled
                        : false,
                    };
                  })
                }
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium">家庭空间</span>
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
          </label>

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

          <label className="block space-y-2">
            <span className="text-sm font-medium">备注</span>
            <textarea
              value={form.note}
              rows={4}
              className="w-full resize-none rounded-2xl border border-border bg-secondary px-4 py-3 text-sm text-foreground outline-none transition focus:border-ring"
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            />
          </label>

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
