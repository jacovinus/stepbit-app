package services

import (
	"context"
	"io"
	"stepbit-app/internal/core"
)

type LlmService struct {
	coreClient *core.StepbitCoreClient
}

func NewLlmService(coreClient *core.StepbitCoreClient) *LlmService {
	return &LlmService{coreClient: coreClient}
}

func (s *LlmService) GetMCPTools(ctx context.Context) (interface{}, error) {
	return s.coreClient.GetMCPTools(ctx)
}

func (s *LlmService) GetMCPProviders(ctx context.Context) (interface{}, error) {
	return s.coreClient.GetMCPProviders(ctx)
}

func (s *LlmService) UpdateMCPProviderState(ctx context.Context, name string, enabled bool) (interface{}, error) {
	return s.coreClient.UpdateMCPProviderState(ctx, name, enabled)
}

func (s *LlmService) GetCoreHealthReport(ctx context.Context) (core.CoreHealthReport, error) {
	return s.coreClient.GetHealthReport(ctx)
}

func (s *LlmService) GetCoreReadinessReport(ctx context.Context) (core.CoreReadinessReport, error) {
	return s.coreClient.GetReadinessReport(ctx)
}

func (s *LlmService) GetCoreSystemRuntime(ctx context.Context) (core.CoreSystemRuntime, error) {
	return s.coreClient.GetSystemRuntime(ctx)
}

func (s *LlmService) GetCoreCronStatus(ctx context.Context) (core.CoreCronStatus, error) {
	return s.coreClient.GetCronStatus(ctx)
}

func (s *LlmService) GetCoreRecentEvents(ctx context.Context, limit int) ([]core.CoreRecentEvent, error) {
	return s.coreClient.ListRecentEvents(ctx, limit)
}

func (s *LlmService) ExecuteMCPTool(ctx context.Context, tool string, input interface{}) (map[string]interface{}, error) {
	return s.coreClient.ExecuteMCPTool(ctx, tool, input)
}

func (s *LlmService) ExecuteReasoning(ctx context.Context, graph interface{}) (interface{}, error) {
	return s.coreClient.ExecuteReasoning(ctx, graph)
}

func (s *LlmService) ExecuteReasoningStream(ctx context.Context, graph interface{}) (io.ReadCloser, error) {
	return s.coreClient.ExecuteReasoningStream(ctx, graph)
}

func (s *LlmService) CheckCoreHealth(ctx context.Context) (bool, string) {
	return s.coreClient.CheckHealth(ctx)
}

func (s *LlmService) GetCoreStatus(ctx context.Context) core.CoreStatus {
	return s.coreClient.GetCoreStatus(ctx)
}

func (s *LlmService) DiscoverModels(ctx context.Context) ([]string, error) {
	return s.coreClient.DiscoverModels(ctx)
}
