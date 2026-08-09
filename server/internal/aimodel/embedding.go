package aimodel

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
	"valley-server/internal/model"

	"gorm.io/gorm"
)

var (
	ErrEmbeddingModelUnavailable     = errors.New("no verified embedding model is available")
	ErrEmbeddingMetadataUnavailable  = errors.New("stored vectors have no embedding model identity")
	ErrEmbeddingIdentityMismatch     = errors.New("stored vectors use different embedding models")
	ErrEmbeddingDimensionUnavailable = errors.New("no verified embedding model matches the stored vector dimension")
	ErrEmbeddingProviderUnavailable  = errors.New("embedding provider is unavailable")
	ErrEmbeddingRequestFailed        = errors.New("embedding provider request failed")
)

// FindVerifiedEmbeddingModel selects a catalog model that has passed a real
// embedding probe. Existing vectors pin the required dimension so retrieval
// never mixes incompatible vector spaces.
func FindVerifiedEmbeddingModel(db *gorm.DB, requiredDimension int) (model.AIModel, error) {
	items, err := ListEnabledModels(db, "embedding")
	if err != nil {
		return model.AIModel{}, err
	}
	foundVerified := false
	for _, item := range items {
		if !HasVerifiedCapability(item, "embedding") || item.EmbeddingDimension <= 0 {
			continue
		}
		foundVerified = true
		if requiredDimension == 0 || item.EmbeddingDimension == requiredDimension {
			return item, nil
		}
	}
	if requiredDimension > 0 && foundVerified {
		return model.AIModel{}, fmt.Errorf("%w: %d", ErrEmbeddingDimensionUnavailable, requiredDimension)
	}
	return model.AIModel{}, ErrEmbeddingModelUnavailable
}

func ResolveDefaultEmbeddingInvocation(db *gorm.DB, timeout time.Duration) (Invocation, error) {
	selected, err := FindVerifiedEmbeddingModel(db, 0)
	if err != nil {
		return Invocation{}, err
	}
	return resolveEmbeddingInvocation(selected, timeout)
}

func ResolveStoredEmbeddingInvocation(
	db *gorm.DB,
	modelID model.Int64String,
	requiredDimension int,
	timeout time.Duration,
) (Invocation, error) {
	if modelID == 0 || requiredDimension <= 0 {
		return Invocation{}, ErrEmbeddingMetadataUnavailable
	}
	var selected model.AIModel
	if err := db.Where("id = ? AND enabled = ?", modelID, true).First(&selected).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return Invocation{}, ErrEmbeddingModelUnavailable
		}
		return Invocation{}, err
	}
	if !HasCapabilities(selected, []string{"embedding"}) ||
		!HasVerifiedCapability(selected, "embedding") ||
		selected.EmbeddingDimension <= 0 {
		return Invocation{}, ErrEmbeddingModelUnavailable
	}
	if selected.EmbeddingDimension != requiredDimension {
		return Invocation{}, fmt.Errorf(
			"%w: catalog=%d stored=%d",
			ErrEmbeddingDimensionUnavailable,
			selected.EmbeddingDimension,
			requiredDimension,
		)
	}
	return resolveEmbeddingInvocation(selected, timeout)
}

func resolveEmbeddingInvocation(selected model.AIModel, timeout time.Duration) (Invocation, error) {
	invocation, err := newInvocation(selected, timeout)
	if err != nil {
		return Invocation{}, fmt.Errorf("%w: %v", ErrEmbeddingProviderUnavailable, err)
	}
	return invocation, nil
}

// CreateEmbeddingsWithProgress keeps provider-specific transport behind the
// compatible client while preserving input order and bounded concurrency.
func CreateEmbeddingsWithProgress(
	ctx context.Context,
	invocation Invocation,
	inputs []string,
	onProgress func(completed, total int),
) ([][]float32, error) {
	if len(inputs) == 0 {
		return nil, fmt.Errorf("%w: empty input", ErrEmbeddingRequestFailed)
	}
	if invocation.Client == nil || invocation.Model.ModelID == "" || invocation.Model.EmbeddingDimension <= 0 {
		return nil, ErrEmbeddingModelUnavailable
	}

	vectors := make([][]float32, len(inputs))
	embeddingCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	jobs := make(chan int)
	errCh := make(chan error, 1)
	workerCount := min(len(inputs), 4)
	var workers sync.WaitGroup
	var completed atomic.Int64
	for range workerCount {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for index := range jobs {
				response, err := invocation.Client.Embeddings(
					embeddingCtx,
					invocation.Model.ModelID,
					[]string{inputs[index]},
				)
				if err != nil || len(response.Data) != 1 || len(response.Data[0].Embedding) == 0 {
					if err == nil {
						err = errors.New("embedding provider returned an empty vector")
					}
					select {
					case errCh <- fmt.Errorf("%w: %w", ErrEmbeddingRequestFailed, err):
					default:
					}
					cancel()
					return
				}
				vector := response.Data[0].Embedding
				if len(vector) != invocation.Model.EmbeddingDimension {
					select {
					case errCh <- fmt.Errorf(
						"%w: catalog=%d provider=%d",
						ErrEmbeddingDimensionUnavailable,
						invocation.Model.EmbeddingDimension,
						len(vector),
					):
					default:
					}
					cancel()
					return
				}
				vectors[index] = vector
				if onProgress != nil {
					onProgress(int(completed.Add(1)), len(inputs))
				}
			}
		}()
	}

dispatch:
	for index := range inputs {
		select {
		case jobs <- index:
		case <-embeddingCtx.Done():
			break dispatch
		}
	}
	close(jobs)
	workers.Wait()
	select {
	case err := <-errCh:
		return nil, err
	default:
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	for _, vector := range vectors {
		if len(vector) == 0 {
			return nil, fmt.Errorf("%w: missing vector", ErrEmbeddingRequestFailed)
		}
	}
	return vectors, nil
}
