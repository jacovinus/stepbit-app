package chattools

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/uuid"
)

type quantlabRunnerFunc func(ctx context.Context, command string, args []string, workdir string, env []string) (stdout string, stderr string, exitCode int, err error)

func (f quantlabRunnerFunc) Run(ctx context.Context, command string, args []string, workdir string, env []string) (stdout string, stderr string, exitCode int, err error) {
	return f(ctx, command, args, workdir, env)
}

type quantlabToolStore struct {
	records []*ToolResultRecord
}

func (s *quantlabToolStore) InsertToolResult(result *ToolResultRecord) (*ToolResultRecord, error) {
	s.records = append(s.records, result)
	return result, nil
}

func (s *quantlabToolStore) GetToolResult(id int64) (*ToolResultRecord, error) {
	return nil, os.ErrNotExist
}

func TestRegistryIncludesQuantLabTool(t *testing.T) {
	registry := NewRegistry()
	definitions := registry.Definitions()

	found := false
	for _, def := range definitions {
		if def.Name == quantlabToolName {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected registry to include %s", quantlabToolName)
	}
}

func TestQuantLabToolCallRunReturnsCanonicalPayload(t *testing.T) {
	root := t.TempDir()
	prepareQuantLabCheckout(t, root)

	store := &quantlabToolStore{}
	tool := newQuantLabToolWithRunner(quantlabRunnerFunc(func(ctx context.Context, command string, args []string, workdir string, env []string) (string, string, int, error) {
		if command != filepath.Join(root, ".venv", "Scripts", "python.exe") {
			t.Fatalf("unexpected interpreter: %s", command)
		}
		if workdir != root {
			t.Fatalf("unexpected workdir: %s", workdir)
		}

		request := decodeRequestPayload(t, args)
		if got := request["command"]; got != "run" {
			t.Fatalf("unexpected request command: %v", got)
		}
		params := request["params"].(map[string]any)
		if got := params["ticker"]; got != "ETH-USD" {
			t.Fatalf("unexpected request ticker: %v", got)
		}

		signalFile := extractFlagValue(t, args, "--signal-file")
		runID := "run_local_001"
		artifactsPath := filepath.Join(root, "outputs", "runs", runID)
		if err := os.MkdirAll(artifactsPath, 0o755); err != nil {
			t.Fatal(err)
		}
		writeJSONFile(t, filepath.Join(artifactsPath, "report.json"), map[string]any{
			"status": "success",
			"summary": map[string]any{
				"total_return": 0.12,
			},
			"machine_contract": map[string]any{
				"contract_type": "quantlab.run.result",
				"summary": map[string]any{
					"total_return": 0.12,
				},
			},
		})
		writeSignalFile(t, signalFile, []map[string]any{
			{
				"event":          "SESSION_STARTED",
				"status":         "running",
				"request_id":     request["request_id"],
				"mode":           "run",
				"run_id":         runID,
				"artifacts_path": artifactsPath,
				"report_path":    filepath.Join(artifactsPath, "report.json"),
			},
			{
				"event":          "SESSION_COMPLETED",
				"status":         "success",
				"request_id":     request["request_id"],
				"mode":           "run",
				"run_id":         runID,
				"artifacts_path": artifactsPath,
				"report_path":    filepath.Join(artifactsPath, "report.json"),
				"summary": map[string]any{
					"total_return": 0.12,
				},
			},
		})

		return "run completed", "", 0, nil
	}))

	output, err := tool.Call(context.Background(), buildQuantLabRequestJSON(t, map[string]any{
		"command":       "run",
		"quantlab_root": root,
		"params": map[string]any{
			"ticker":   "ETH-USD",
			"start":    "2023-01-01",
			"end":      "2023-01-10",
			"interval": "1d",
		},
	}), uuid.New(), store)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	var result map[string]any
	if err := json.Unmarshal([]byte(output), &result); err != nil {
		t.Fatalf("failed to decode tool output: %v\n%s", err, output)
	}

	if result["status"] != "success" {
		t.Fatalf("expected success status, got %v", result["status"])
	}
	if result["command"] != "run" {
		t.Fatalf("expected run command, got %v", result["command"])
	}
	if result["run_id"] != "run_local_001" {
		t.Fatalf("unexpected run_id: %v", result["run_id"])
	}
	if result["artifacts_path"] != filepath.Join(root, "outputs", "runs", "run_local_001") {
		t.Fatalf("unexpected artifacts_path: %v", result["artifacts_path"])
	}

	machineContract := result["machine_contract"].(map[string]any)
	if machineContract["contract_type"] != "quantlab.run.result" {
		t.Fatalf("unexpected machine_contract: %v", machineContract)
	}
	if len(store.records) != 1 {
		t.Fatalf("expected one stored tool result, got %d", len(store.records))
	}
	if !strings.Contains(store.records[0].Content, `"quantlab.run.result"`) {
		t.Fatalf("stored tool result does not contain canonical machine contract")
	}
}

func TestQuantLabToolCallSweepReturnsCanonicalPayload(t *testing.T) {
	root := t.TempDir()
	prepareQuantLabCheckout(t, root)

	tool := newQuantLabToolWithRunner(quantlabRunnerFunc(func(ctx context.Context, command string, args []string, workdir string, env []string) (string, string, int, error) {
		request := decodeRequestPayload(t, args)
		if got := request["command"]; got != "sweep" {
			t.Fatalf("unexpected request command: %v", got)
		}
		params := request["params"].(map[string]any)
		if got := params["config_path"]; got != "configs/experiments/eth.yaml" {
			t.Fatalf("unexpected config_path: %v", got)
		}
		if got := params["out_dir"]; got != "outputs/stepbit" {
			t.Fatalf("unexpected out_dir: %v", got)
		}

		signalFile := extractFlagValue(t, args, "--signal-file")
		runID := "sweep_local_001"
		artifactsPath := filepath.Join(root, "outputs", "runs", runID)
		if err := os.MkdirAll(artifactsPath, 0o755); err != nil {
			t.Fatal(err)
		}
		writeJSONFile(t, filepath.Join(artifactsPath, "report.json"), map[string]any{
			"status": "success",
			"summary": map[string]any{
				"best_score": 0.88,
			},
			"machine_contract": map[string]any{
				"contract_type": "quantlab.sweep.result",
				"summary": map[string]any{
					"best_score": 0.88,
				},
			},
		})
		writeSignalFile(t, signalFile, []map[string]any{
			{
				"event":          "SESSION_STARTED",
				"status":         "running",
				"request_id":     request["request_id"],
				"mode":           "sweep",
				"run_id":         runID,
				"artifacts_path": artifactsPath,
				"report_path":    filepath.Join(artifactsPath, "report.json"),
			},
			{
				"event":          "SESSION_COMPLETED",
				"status":         "success",
				"request_id":     request["request_id"],
				"mode":           "sweep",
				"run_id":         runID,
				"artifacts_path": artifactsPath,
				"report_path":    filepath.Join(artifactsPath, "report.json"),
				"summary": map[string]any{
					"best_score": 0.88,
				},
			},
		})

		return "sweep completed", "", 0, nil
	}))

	output, err := tool.Call(context.Background(), buildQuantLabRequestJSON(t, map[string]any{
		"command":       "sweep",
		"quantlab_root": root,
		"params": map[string]any{
			"config_path": "configs/experiments/eth.yaml",
			"out_dir":     "outputs/stepbit",
		},
	}), uuid.New(), nil)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	var result map[string]any
	if err := json.Unmarshal([]byte(output), &result); err != nil {
		t.Fatalf("failed to decode tool output: %v\n%s", err, output)
	}

	if result["status"] != "success" {
		t.Fatalf("expected success status, got %v", result["status"])
	}
	if result["command"] != "sweep" {
		t.Fatalf("expected sweep command, got %v", result["command"])
	}
	if result["run_id"] != "sweep_local_001" {
		t.Fatalf("unexpected run_id: %v", result["run_id"])
	}

	machineContract := result["machine_contract"].(map[string]any)
	if machineContract["contract_type"] != "quantlab.sweep.result" {
		t.Fatalf("unexpected machine_contract: %v", machineContract)
	}
}

func TestQuantLabToolCallFailedRunReturnsDeterministicPayload(t *testing.T) {
	root := t.TempDir()
	prepareQuantLabCheckout(t, root)

	tool := newQuantLabToolWithRunner(quantlabRunnerFunc(func(ctx context.Context, command string, args []string, workdir string, env []string) (string, string, int, error) {
		request := decodeRequestPayload(t, args)
		signalFile := extractFlagValue(t, args, "--signal-file")
		writeSignalFile(t, signalFile, []map[string]any{
			{
				"event":      "SESSION_STARTED",
				"status":     "running",
				"request_id": request["request_id"],
				"mode":       "run",
			},
			{
				"event":      "SESSION_FAILED",
				"status":     "failed",
				"request_id": request["request_id"],
				"mode":       "run",
				"error_type": "ConfigError",
				"message":    "missing config_path",
			},
		})

		return "", "missing config_path", 1, context.DeadlineExceeded
	}))

	output, err := tool.Call(context.Background(), buildQuantLabRequestJSON(t, map[string]any{
		"command":       "run",
		"quantlab_root": root,
		"params": map[string]any{
			"ticker": "ETH-USD",
		},
	}), uuid.New(), nil)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	var result map[string]any
	if err := json.Unmarshal([]byte(output), &result); err != nil {
		t.Fatalf("failed to decode tool output: %v\n%s", err, output)
	}

	if result["status"] != "failed" {
		t.Fatalf("expected failed status, got %v", result["status"])
	}
	if result["error_type"] != "ConfigError" {
		t.Fatalf("unexpected error_type: %v", result["error_type"])
	}
	if result["error"] != "missing config_path" {
		t.Fatalf("unexpected error message: %v", result["error"])
	}
}

func prepareQuantLabCheckout(t *testing.T, root string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Join(root, ".venv", "Scripts"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "main.py"), []byte("# quantlab"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, ".venv", "Scripts", "python.exe"), []byte("python"), 0o600); err != nil {
		t.Fatal(err)
	}
}

func decodeRequestPayload(t *testing.T, args []string) map[string]any {
	t.Helper()
	payload := extractFlagValue(t, args, "--json-request")

	var request map[string]any
	if err := json.Unmarshal([]byte(payload), &request); err != nil {
		t.Fatalf("failed to parse json request: %v", err)
	}
	return request
}

func extractFlagValue(t *testing.T, args []string, flag string) string {
	t.Helper()
	for i := 0; i < len(args)-1; i++ {
		if args[i] == flag {
			return args[i+1]
		}
	}
	t.Fatalf("flag %s not found in args: %v", flag, args)
	return ""
}

func writeSignalFile(t *testing.T, path string, events []map[string]any) {
	t.Helper()

	lines := make([]string, 0, len(events))
	for _, event := range events {
		data, err := json.Marshal(event)
		if err != nil {
			t.Fatal(err)
		}
		lines = append(lines, string(data))
	}
	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
}

func writeJSONFile(t *testing.T, path string, payload map[string]any) {
	t.Helper()

	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
}

func buildQuantLabRequestJSON(t *testing.T, payload map[string]any) string {
	t.Helper()

	data, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}
