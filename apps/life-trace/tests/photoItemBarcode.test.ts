import { describe, expect, it } from 'vitest';
import {
  getManualPhotoItemBarcode,
  scanPhotoItemBarcodeFromImage,
} from '../src/lib/photoItemBarcode';

describe('photo item barcode helpers', () => {
  it('uses native BarcodeDetector when available and normalizes the first readable code', async () => {
    class FakeBarcodeDetector {
      static getSupportedFormats() {
        return Promise.resolve(['ean_13', 'qr_code']);
      }

      detect() {
        return Promise.resolve([
          { rawValue: ' 6901234567890 ', format: 'EAN_13' },
          { rawValue: 'https://example.com', format: 'QR_CODE' },
        ]);
      }
    }

    const result = await scanPhotoItemBarcodeFromImage({
      source: {},
      BarcodeDetector: FakeBarcodeDetector,
    });

    expect(result).toEqual({
      value: '6901234567890',
      format: 'ean_13',
      source: 'native',
    });
  });

  it('returns a manual barcode result without preserving empty values', () => {
    expect(getManualPhotoItemBarcode('  123456  ', 'QR_CODE')).toEqual({
      value: '123456',
      format: 'qr_code',
      source: 'manual',
    });
    expect(getManualPhotoItemBarcode('   ', 'ean_13')).toBeNull();
  });
});
