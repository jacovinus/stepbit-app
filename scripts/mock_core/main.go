package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

func main() {
	// Health check for core
	http.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ready"))
	})

	// OpenAI-compatible Chat Completions (Mock)
	http.HandleFunc("/v1/chat/completions", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)

		stream, _ := body["stream"].(bool)

		if stream {
			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("Connection", "keep-alive")
			w.Header().Set("X-Next-Token", "mock-rotating-token-123")

			flusher, ok := w.(http.Flusher)
			if !ok {
				http.Error(w, "Streaming not supported", http.StatusInternalServerError)
				return
			}

			tokens := []string{"Hello", " from", " the", " mock", " core!"}
			for _, token := range tokens {
				data := map[string]interface{}{
					"choices": []interface{}{
						map[string]interface{}{
							"delta": map[string]interface{}{
								"content": token,
							},
						},
					},
				}
				jsonBytes, _ := json.Marshal(data)
				fmt.Fprintf(w, "data: %s\n\n", jsonBytes)
				flusher.Flush()
				time.Sleep(10 * time.Millisecond) // Simulated inference latency per token
			}
			fmt.Fprintf(w, "data: [DONE]\n\n")
			flusher.Flush()
		} else {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Next-Token", "mock-rotating-token-456")
			data := map[string]interface{}{
				"choices": []interface{}{
					map[string]interface{}{
						"message": map[string]interface{}{
							"content": "Hello from the mock core!",
						},
					},
				},
			}
			json.NewEncoder(w).Encode(data)
		}
	})

	log.Println("Mock stepbit-core running on :3000")
	log.Fatal(http.ListenAndServe(":3000", nil))
}
