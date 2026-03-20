package core

import (
	"context"
	"fmt"
	"testing"
	"time"
)

// This benchmark matches the logic in scripts/benchmark.go but for the internal client
// It uses the same mock_core setup for a fair comparison.
func TestBenchmarkGoClient(t *testing.T) {
	// 1. Health check baseline (though here it's just the client overhead)
	client := NewStepbitCoreClient("http://localhost:3000", "master-key", "mistral-7b")

	// Ensure mock core is running (we assume it is for this manual benchmark test)
	// In a real automated bench, we would start it here.
	
	// 1. Measure Health (Ready)
	start := time.Now()
	resp, err := client.client.Get("http://localhost:3000/ready")
	if err != nil {
		t.Skip("Mock core not running at :3000. Skipping performance benchmark.")
		return
	}
	resp.Body.Close()
	fmt.Printf("Go Client Ready Latency: %v\n", time.Since(start))

	// 2. Measure TTFT
	tokenChan := make(chan StreamMessage, 100)
	ctx := context.Background()
	
	start = time.Now()
	var ttft time.Duration
	
	go func() {
		err := client.ChatStreaming(ctx, []Message{{Role: "user", Content: "Hi"}}, ChatOptions{}, tokenChan)
		if err != nil {
			fmt.Printf("Stream Error: %v\n", err)
		}
		close(tokenChan)
	}()

	for range tokenChan {
		if ttft == 0 {
			ttft = time.Since(start)
			fmt.Printf("Go Client TTFT: %v\n", ttft)
		}
	}
	fmt.Printf("Go Client Total Stream Duration: %v\n", time.Since(start))
}
