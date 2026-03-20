package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"os"
	"time"

	"github.com/gorilla/websocket"
)

type WsClientMessage struct {
	Type    string `json:"type"`
	Content string `json:"content"`
	Search  bool   `json:"search"`
	Reason  bool   `json:"reason"`
}

type WsServerMessage struct {
	Type    string `json:"type"`
	Content string `json:"content"`
}

func main() {
	sessionID := os.Getenv("SESSION_ID")
	if sessionID == "" {
		sessionID = "6581038a-79ee-4a50-a4b9-a574e68c3a75"
	}
	u := url.URL{Scheme: "ws", Host: "localhost:8080", Path: "/api/ws/chat/" + sessionID}
	log.Printf("connecting to %s", u.String())

	c, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		log.Fatal("dial:", err)
	}
	defer c.Close()

	done := make(chan struct{})

	go func() {
		defer close(done)
		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				log.Println("read:", err)
				return
			}
			var serverMsg WsServerMessage
			json.Unmarshal(message, &serverMsg)
			fmt.Printf("[%s]: %s\n", serverMsg.Type, serverMsg.Content)
			if serverMsg.Type == "done" {
				return
			}
		}
	}()

	// Send a message
	msg := WsClientMessage{
		Type:    "message",
		Content: "Hello, how are you?",
		Search:  false,
		Reason:  true,
	}
	msgBytes, _ := json.Marshal(msg)
	err = c.WriteMessage(websocket.TextMessage, msgBytes)
	if err != nil {
		log.Println("write:", err)
		return
	}

	// Wait a bit and then cancel
	time.Sleep(1 * time.Second)
	log.Println("Sending cancel...")
	cancelMsg := WsClientMessage{Type: "cancel"}
	cancelBytes, _ := json.Marshal(cancelMsg)
	c.WriteMessage(websocket.TextMessage, cancelBytes)

	<-done
}
