package chattools

import (
	"bytes"
	"context"
	stdjson "encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/google/uuid"
)

const quantlabToolName = "quantlab_execute"

type quantlabToolArgs struct {
	Command          string         `json:"command"`
	Params           map[string]any `json:"params"`
	QuantLabRoot     string         `json:"quantlab_root,omitempty"`
	PythonExecutable string         `json:"python_executable,omitempty"`
	SignalFile       string         `json:"signal_file,omitempty"`
	RequestID        string         `json:"request_id,omitempty"`
	TimeoutSeconds   int            `json:"timeout_seconds,omitempty"`
}

type quantlabCommandRunner interface {
	Run(ctx context.Context, command string, args []string, workdir string, env []string) (stdout string, stderr string, exitCode int, err error)
}

type execQuantLabRunner struct{}

func (r *execQuantLabRunner) Run(
	ctx context.Context,
	command string,
	args []string,
	workdir string,
	env []string,
) (stdout string, stderr string, exitCode int, err error) {
	cmd := exec.CommandContext(ctx, command, args...)
	cmd.Dir = workdir
	cmd.Env = env

	var stdoutBuf bytes.Buffer
	var stderrBuf bytes.Buffer
	cmd.Stdout = &stdoutBuf
	cmd.Stderr = &stderrBuf

	runErr := cmd.Run()
	if runErr != nil {
		exitCode = -1
		var exitErr *exec.ExitError
		if errors.As(runErr, &exitErr) {
			exitCode = exitErr.ExitCode()
		}
		return stdoutBuf.String(), stderrBuf.String(), exitCode, runErr
	}

	return stdoutBuf.String(), stderrBuf.String(), 0, nil
}

type QuantLabTool struct {
	runner quantlabCommandRunner
}

func NewQuantLabTool() *QuantLabTool {
	return newQuantLabToolWithRunner(&execQuantLabRunner{})
}

func newQuantLabToolWithRunner(runner quantlabCommandRunner) *QuantLabTool {
	if runner == nil {
		runner = &execQuantLabRunner{}
	}
	return &QuantLabTool{runner: runner}
}

func (t *QuantLabTool) Definition() ToolDefinition {
	return ToolDefinition{
		Name:        quantlabToolName,
		Description: "Invoke a local QuantLab checkout via main.py --json-request and return canonical execution artifacts and machine_contract data.",
		Parameters:  `{"type":"object","properties":{"command":{"type":"string","enum":["run","sweep"],"description":"QuantLab CLI command to invoke."},"params":{"type":"object","description":"QuantLab JSON-request params passed through to the CLI."},"quantlab_root":{"type":"string","description":"Optional path to the local QuantLab checkout."},"python_executable":{"type":"string","description":"Optional explicit Python interpreter to use."},"signal_file":{"type":"string","description":"Optional lifecycle signal file to pass through to QuantLab."},"request_id":{"type":"string","description":"Optional request id forwarded to QuantLab."},"timeout_seconds":{"type":"integer","minimum":1,"description":"Optional process timeout in seconds."}},"required":["command","params"]}`,
	}
}

func (t *QuantLabTool) Call(ctx context.Context, arguments string, sessionID uuid.UUID, store ToolResultStore) (string, error) {
	var args quantlabToolArgs
	if err := stdjson.Unmarshal([]byte(arguments), &args); err != nil {
		return "", fmt.Errorf("error parsing arguments: %w", err)
	}

	command := strings.TrimSpace(strings.ToLower(args.Command))
	if command != "run" && command != "sweep" {
		return "", fmt.Errorf("unsupported command %q: valid commands are run and sweep", args.Command)
	}

	params := args.Params
	if params == nil {
		params = map[string]any{}
	}

	quantlabRoot, err := resolveQuantLabRoot(args.QuantLabRoot)
	if err != nil {
		return "", err
	}

	pythonExecutable, err := resolveQuantLabPythonExecutable(quantlabRoot, args.PythonExecutable)
	if err != nil {
		return "", err
	}

	signalFile := strings.TrimSpace(args.SignalFile)
	if signalFile == "" {
		tempFile, tempErr := os.CreateTemp("", "stepbit-quantlab-*.jsonl")
		if tempErr != nil {
			return "", fmt.Errorf("prepare signal file: %w", tempErr)
		}
		signalFile = tempFile.Name()
		_ = tempFile.Close()
	}
	if err := ensureEmptyFile(signalFile); err != nil {
		return "", fmt.Errorf("prepare signal file: %w", err)
	}

	requestID := strings.TrimSpace(args.RequestID)
	if requestID == "" {
		requestID = "stepbit-" + uuid.NewString()
	}

	requestPayload := map[string]any{
		"schema_version": "1.0",
		"request_id":     requestID,
		"command":        command,
		"params":         params,
	}
	requestJSON, err := stdjson.Marshal(requestPayload)
	if err != nil {
		return "", fmt.Errorf("build json request payload: %w", err)
	}

	processCtx := ctx
	var cancel context.CancelFunc
	if args.TimeoutSeconds > 0 {
		processCtx, cancel = context.WithTimeout(ctx, time.Duration(args.TimeoutSeconds)*time.Second)
		defer cancel()
	}

	processArgs := []string{"main.py", "--json-request", string(requestJSON), "--signal-file", signalFile}
	stdout, stderr, exitCode, runErr := t.runner.Run(
		processCtx,
		pythonExecutable,
		processArgs,
		quantlabRoot,
		os.Environ(),
	)

	result := map[string]any{
		"adapter":           "quantlab",
		"status":            "failed",
		"command":           command,
		"request_id":        requestID,
		"quantlab_root":     quantlabRoot,
		"python_executable": pythonExecutable,
		"signal_file":       signalFile,
		"exit_code":         exitCode,
		"process_error":     errorString(runErr),
		"stdout":            strings.TrimSpace(stdout),
		"stderr":            strings.TrimSpace(stderr),
		"machine_contract":  nil,
		"summary":           nil,
		"run_id":            "",
		"mode":              "",
		"artifacts_path":    "",
		"report_path":       "",
		"signal_event":      nil,
		"json_request":      requestPayload,
	}

	signalEvent, signalErr := readLatestSignalEvent(signalFile)
	if signalErr == nil {
		result["signal_event"] = signalEvent
		mergeSignalEventIntoResult(result, signalEvent)
	} else {
		result["signal_error"] = signalErr.Error()
	}

	status := strings.ToLower(fmt.Sprint(result["status"]))
	if status != "success" && status != "failed" && status != "aborted" {
		result["status"] = "failed"
	}

	if result["status"] == "success" {
		report, reportPath, reportErr := loadQuantLabReport(result)
		if reportErr != nil {
			result["status"] = "failed"
			result["error"] = reportErr.Error()
		} else {
			result["report_path"] = reportPath
			if machineContract, ok := report["machine_contract"]; ok {
				result["machine_contract"] = machineContract
			}
			if summary, ok := report["summary"]; ok {
				result["summary"] = summary
			}
		}
	}

	if result["status"] == "success" && result["machine_contract"] == nil {
		result["status"] = "failed"
		result["error"] = "missing machine_contract in report.json"
	}

	if strings.ToLower(fmt.Sprint(result["status"])) != "success" {
		if signalErr == nil && signalEvent != nil && result["error"] == nil {
			if message, ok := signalEvent["message"].(string); ok && strings.TrimSpace(message) != "" {
				result["error"] = message
			}
		}
		if result["error"] == nil && strings.TrimSpace(stderr) != "" {
			result["error"] = strings.TrimSpace(stderr)
		}
		if result["error"] == nil && runErr != nil {
			result["error"] = runErr.Error()
		}
	}

	if store != nil {
		if payload, marshalErr := stdjson.MarshalIndent(result, "", "  "); marshalErr == nil {
			_, _ = store.InsertToolResult(&ToolResultRecord{
				SessionID: sessionID,
				SourceURL: fmt.Sprintf("quantlab://%s", command),
				Content:   string(payload),
			})
		}
	}

	output, marshalErr := stdjson.MarshalIndent(result, "", "  ")
	if marshalErr != nil {
		return "", marshalErr
	}

	return string(output), nil
}

func resolveQuantLabRoot(explicit string) (string, error) {
	candidates := []string{
		strings.TrimSpace(explicit),
		strings.TrimSpace(os.Getenv("STEPBIT_QUANTLAB_ROOT")),
		strings.TrimSpace(os.Getenv("QUANTLAB_ROOT")),
	}

	if cwd, err := os.Getwd(); err == nil {
		candidates = append(candidates,
			filepath.Join(cwd, "..", "quant_lab"),
			filepath.Join(cwd, "..", "quantlab"),
		)
	}

	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		if abs, err := filepath.Abs(candidate); err == nil {
			if info, statErr := os.Stat(abs); statErr == nil && info.IsDir() {
				if _, mainErr := os.Stat(filepath.Join(abs, "main.py")); mainErr == nil {
					return filepath.Clean(abs), nil
				}
			}
		}
	}

	return "", fmt.Errorf("quantlab root not found; set STEPBIT_QUANTLAB_ROOT or pass quantlab_root")
}

func resolveQuantLabPythonExecutable(root, explicit string) (string, error) {
	candidates := []string{
		strings.TrimSpace(explicit),
		strings.TrimSpace(os.Getenv("STEPBIT_QUANTLAB_PYTHON")),
		strings.TrimSpace(os.Getenv("QUANTLAB_PYTHON")),
	}

	if runtime.GOOS == "windows" {
		candidates = append(candidates, filepath.Join(root, ".venv", "Scripts", "python.exe"))
		candidates = append(candidates, filepath.Join(root, ".venv", "Scripts", "python"))
	} else {
		candidates = append(candidates, filepath.Join(root, ".venv", "bin", "python"))
		candidates = append(candidates, filepath.Join(root, ".venv", "bin", "python3"))
	}
	candidates = append(candidates, "python")
	candidates = append(candidates, "python3")

	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		if filepath.IsAbs(candidate) || strings.Contains(candidate, string(os.PathSeparator)) {
			if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
				return candidate, nil
			}
			continue
		}
		if resolved, err := exec.LookPath(candidate); err == nil {
			return resolved, nil
		}
	}

	return "", fmt.Errorf("unable to resolve python executable for QuantLab")
}

func ensureEmptyFile(path string) error {
	dir := filepath.Dir(path)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return err
		}
	}
	return os.WriteFile(path, []byte{}, 0o600)
}

func readLatestSignalEvent(signalFile string) (map[string]any, error) {
	content, err := os.ReadFile(signalFile)
	if err != nil {
		return nil, err
	}

	var latest map[string]any
	lines := strings.Split(strings.TrimSpace(string(content)), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var payload map[string]any
		if err := stdjson.Unmarshal([]byte(line), &payload); err == nil {
			latest = payload
		}
	}

	if latest == nil {
		return nil, fmt.Errorf("no valid signal events found in %s", signalFile)
	}

	return latest, nil
}

func mergeSignalEventIntoResult(result map[string]any, event map[string]any) {
	if event == nil {
		return
	}

	if status, ok := event["status"].(string); ok && strings.TrimSpace(status) != "" {
		result["status"] = strings.ToLower(strings.TrimSpace(status))
	}

	for _, key := range []string{
		"mode",
		"run_id",
		"artifacts_path",
		"report_path",
		"summary",
		"request_id",
		"runs_index_root",
	} {
		if value, ok := event[key]; ok && value != nil {
			result[key] = value
		}
	}

	if errorType, ok := event["error_type"].(string); ok && strings.TrimSpace(errorType) != "" {
		result["error_type"] = errorType
	}
	if message, ok := event["message"].(string); ok && strings.TrimSpace(message) != "" {
		result["message"] = message
	}
}

func loadQuantLabReport(result map[string]any) (map[string]any, string, error) {
	candidates := make([]string, 0, 2)

	if reportPath, _ := result["report_path"].(string); strings.TrimSpace(reportPath) != "" {
		candidates = append(candidates, reportPath)
	}
	if artifactsPath, _ := result["artifacts_path"].(string); strings.TrimSpace(artifactsPath) != "" {
		candidates = append(candidates, filepath.Join(artifactsPath, "report.json"))
	}

	var lastErr error
	for _, candidate := range candidates {
		report, err := loadJSONFile(candidate)
		if err != nil {
			lastErr = err
			continue
		}
		return report, candidate, nil
	}

	if lastErr == nil {
		lastErr = errors.New("report.json not found")
	}
	return nil, "", lastErr
}

func loadJSONFile(path string) (map[string]any, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var payload map[string]any
	if err := stdjson.Unmarshal(content, &payload); err != nil {
		return nil, err
	}
	return payload, nil
}

func errorString(err error) any {
	if err == nil {
		return nil
	}
	return err.Error()
}
