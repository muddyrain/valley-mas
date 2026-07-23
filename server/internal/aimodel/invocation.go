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
