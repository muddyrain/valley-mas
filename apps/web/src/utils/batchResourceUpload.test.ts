import { limitBatchResourceFiles, MAX_BATCH_RESOURCE_UPLOAD_IMAGES } from './batchResourceUpload';

const files = Array.from({ length: 12 }, (_, index) => ({ name: `image-${index}.png` }));
const result = limitBatchResourceFiles(files, 3);

if (MAX_BATCH_RESOURCE_UPLOAD_IMAGES !== 10) {
  throw new Error('batch resource upload limit should be 10 images');
}

if (result.accepted.length !== 7) {
  throw new Error('should only accept files up to the remaining batch slots');
}

if (result.rejectedCount !== 5) {
  throw new Error('should report files skipped by the batch image limit');
}

if (!result.exceededLimit || result.alreadyAtLimit) {
  throw new Error('should distinguish exceeding the limit from already being full');
}
