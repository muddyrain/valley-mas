package articlepackage

import (
	"context"
	"time"

	"valley-server/internal/utils"
)

type TOSStore struct {
	uploader *utils.TOSUploader
}

func NewTOSStore(uploader *utils.TOSUploader) *TOSStore {
	return &TOSStore{uploader: uploader}
}

func (s *TOSStore) SignPut(_ context.Context, key string, expires time.Duration) (UploadTicket, error) {
	ticket, err := s.uploader.PresignPrivatePut(key, expires)
	return UploadTicket{URL: ticket.URL, Headers: ticket.Headers}, err
}

func (s *TOSStore) Head(ctx context.Context, key string) (ObjectInfo, error) {
	info, err := s.uploader.HeadPrivateObject(ctx, key)
	return ObjectInfo{Size: info.Size, ETag: info.ETag}, err
}

func (s *TOSStore) ReadRange(ctx context.Context, key, etag string, start, end int64) ([]byte, error) {
	return s.uploader.ReadPrivateRange(ctx, key, etag, start, end)
}

func (s *TOSStore) Copy(ctx context.Context, sourceKey, destinationKey, etag string) (string, error) {
	return s.uploader.CopyPrivateObject(ctx, sourceKey, destinationKey, etag)
}

func (s *TOSStore) Delete(ctx context.Context, key string) error {
	return s.uploader.DeleteFileWithContext(ctx, key)
}

func (s *TOSStore) SignGet(_ context.Context, key string, expires time.Duration, disposition string) (string, error) {
	return s.uploader.PresignPrivateGet(key, expires, disposition)
}
