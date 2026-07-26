package aimodel

import (
	"time"
	"valley-server/internal/aiclient"
	"valley-server/internal/model"

	"gorm.io/gorm"
)

// Invocation binds a validated catalog model to its configured compatible
// provider client. Handlers should resolve this once per user request instead
// of reading legacy model environment variables.
type Invocation struct {
	Model    model.AIModel
	Provider ProviderConfig
	Client   *aiclient.CompatibleClient
}

func ResolveInvocation(db *gorm.DB, modelID, capability string, timeout time.Duration) (Invocation, error) {
	selected, err := FindEnabledModel(db, modelID, capability)
	if err != nil {
		return Invocation{}, err
	}
	return newInvocation(selected, timeout)
}

// ResolveFastTextInvocation resolves the enabled text model with the smallest
// declared context window. It is intended for short, disposable AI work such
// as generating ideas or titles, and keeps that policy reusable by handlers.
func ResolveFastTextInvocation(db *gorm.DB, timeout time.Duration) (Invocation, error) {
	selected, err := FindFastTextModel(db)
	if err != nil {
		return Invocation{}, err
	}
	return newInvocation(selected, timeout)
}

func newInvocation(selected model.AIModel, timeout time.Duration) (Invocation, error) {
	provider, err := ProviderFromEnv(selected.Provider)
	if err != nil {
		return Invocation{}, err
	}
	client := aiclient.NewProviderCompatibleClient(
		provider.Provider,
		provider.BaseURL,
		provider.APIKey,
		timeout,
	)
	client.ImageProtocol = selected.ImageProtocol
	return Invocation{
		Model:    selected,
		Provider: provider,
		Client:   client,
	}, nil
}
