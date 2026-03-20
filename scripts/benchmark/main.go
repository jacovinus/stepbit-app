package main

import (
	"bufio"
	"fmt"
	"net/http"
	"strings"
	"time"
)

func main() {
	url := "http://localhost:8080/api/v1/chat/completions" // Corrected path
	
	// 1. Measure Health Latency
	start := time.Now()
	resp, err := http.Get("http://localhost:8080/api/health")
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}
	defer resp.Body.Close()
	fmt.Printf("Health Check Latency: %v\n", time.Since(start))

	// 2. Measure TTFT (Time To First Token) for Streaming Chat
	jsonBody := `{
		"model": "mistral-7b",
		"messages": [{"role": "user", "content": "Hi"}],
		"stream": true
	}`
	
	start = time.Now()
	req, _ := http.NewRequest("POST", url, strings.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer sk-dev-key-123") // Default key from config.yaml

	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("POST Error: %v\n", err)
		return
	}
	defer resp.Body.Close()

	fmt.Printf("POST Status: %s\n", resp.Status)
	if resp.StatusCode != http.StatusOK {
		return
	}

	reader := bufio.NewReader(resp.Body)
	firstTokenTime := time.Time{}

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			break
		}
		if strings.HasPrefix(line, "data: ") && !strings.Contains(line, "[DONE]") {
			if firstTokenTime.IsZero() {
				firstTokenTime = time.Now()
				fmt.Printf("Time To First Token (TTFT): %v\n", firstTokenTime.Sub(start))
			}
		}
	}
	fmt.Printf("Total duration: %v\n", time.Since(start))
}
