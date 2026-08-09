package handler

import (
	"context"
	"strings"
	"time"

	"valley-server/internal/model"
)

const (
	aiKnowledgeStatusNotUsed  = "not_used"
	aiKnowledgeStatusUsed     = "used"
	aiKnowledgeStatusDegraded = "degraded"

	aiKnowledgeAugmentationTimeout = 12 * time.Second
)

type aiKnowledgeAugmentation struct {
	Context    string
	References []aiKnowledgeReference
	Status     string
	ErrorCode  string
	Cause      error
}

type aiKnowledgeRetriever func(context.Context) (string, []aiKnowledgeReference, error)

func resolveAIKnowledgeAugmentation(ctx context.Context, retrieve aiKnowledgeRetriever) (aiKnowledgeAugmentation, error) {
	if err := ctx.Err(); err != nil {
		return aiKnowledgeAugmentation{}, err
	}
	retrievalContext, cancel := context.WithTimeout(ctx, aiKnowledgeAugmentationTimeout)
	defer cancel()

	knowledgeContext, references, err := retrieve(retrievalContext)
	if parentErr := ctx.Err(); parentErr != nil {
		return aiKnowledgeAugmentation{}, parentErr
	}
	if err != nil {
		code, _ := aiKnowledgeRetrievalFailure(err)
		return aiKnowledgeAugmentation{
			Status:    aiKnowledgeStatusDegraded,
			ErrorCode: code,
			Cause:     err,
		}, nil
	}
	if strings.TrimSpace(knowledgeContext) == "" {
		return aiKnowledgeAugmentation{Status: aiKnowledgeStatusNotUsed}, nil
	}
	return aiKnowledgeAugmentation{
		Context:    knowledgeContext,
		References: references,
		Status:     aiKnowledgeStatusUsed,
	}, nil
}

func retrieveAIKnowledgeAugmentation(
	ctx context.Context,
	userID model.Int64String,
	version model.AIAppVersion,
	message string,
) (aiKnowledgeAugmentation, error) {
	return resolveAIKnowledgeAugmentation(ctx, func(retrievalContext context.Context) (string, []aiKnowledgeReference, error) {
		return retrieveAIKnowledgeContext(retrievalContext, userID, version, message)
	})
}
