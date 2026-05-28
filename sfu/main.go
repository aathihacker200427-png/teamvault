package main

import (
	"encoding/json"
	"net/http"
	"os"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

type Room struct {
	ID        string
	Peers     map[string]*Peer
	mu        sync.RWMutex
}

type Peer struct {
	ID       string
	Conn     *websocket.Conn
	RoomID   string
	Tracks   []string
}

type RoomManager struct {
	rooms map[string]*Room
	mu    sync.RWMutex
}

type SignalMessage struct {
	Type    string          `json:"type"`
	RoomID  string          `json:"room_id"`
	PeerID  string          `json:"peer_id"`
	Payload json.RawMessage `json:"payload"`
}

var (
	roomManager = &RoomManager{
		rooms: make(map[string]*Room),
	}
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}
)

func main() {
	zerolog.SetGlobalLevel(zerolog.InfoLevel)
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout})

	port := os.Getenv("SFU_HTTP_PORT")
	if port == "" {
		port = "8080"
	}

	http.HandleFunc("/ws", handleWebSocket)
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	http.HandleFunc("/api/rooms", handleCreateRoom)

	log.Info().Str("port", port).Msg("SFU server starting")
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal().Err(err).Msg("Server failed")
	}
}

func handleCreateRoom(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		RoomID string `json:"room_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	room := roomManager.getOrCreateRoom(req.RoomID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"room_id": room.ID,
		"status":  "created",
	})
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Msg("WebSocket upgrade failed")
		return
	}
	defer conn.Close()

	peerID := r.URL.Query().Get("peer_id")
	roomID := r.URL.Query().Get("room_id")

	if peerID == "" || roomID == "" {
		log.Error().Msg("Missing peer_id or room_id")
		return
	}

	room := roomManager.getOrCreateRoom(roomID)
	peer := &Peer{
		ID:     peerID,
		Conn:   conn,
		RoomID: roomID,
	}

	room.addPeer(peer)
	defer room.removePeer(peerID)

	log.Info().Str("peer", peerID).Str("room", roomID).Msg("Peer connected")

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Debug().Err(err).Str("peer", peerID).Msg("Peer disconnected")
			break
		}

		var signal SignalMessage
		if err := json.Unmarshal(message, &signal); err != nil {
			log.Error().Err(err).Msg("Invalid signal message")
			continue
		}

		signal.PeerID = peerID
		signal.RoomID = roomID

		room.broadcast(peerID, message)
	}
}

func (rm *RoomManager) getOrCreateRoom(id string) *Room {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	if room, ok := rm.rooms[id]; ok {
		return room
	}

	room := &Room{
		ID:    id,
		Peers: make(map[string]*Peer),
	}
	rm.rooms[id] = room
	log.Info().Str("room", id).Msg("Room created")
	return room
}

func (r *Room) addPeer(peer *Peer) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Peers[peer.ID] = peer

	r.broadcastSystem("peer.joined", peer.ID)
}

func (r *Room) removePeer(peerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.Peers, peerID)

	r.broadcastSystem("peer.left", peerID)

	if len(r.Peers) == 0 {
		roomManager.mu.Lock()
		delete(roomManager.rooms, r.ID)
		roomManager.mu.Unlock()
		log.Info().Str("room", r.ID).Msg("Room removed (empty)")
	}
}

func (r *Room) broadcast(excludePeer string, message []byte) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for id, peer := range r.Peers {
		if id == excludePeer {
			continue
		}
		if err := peer.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
			log.Error().Err(err).Str("peer", id).Msg("Failed to send message")
		}
	}
}

func (r *Room) broadcastSystem(eventType string, peerID string) {
	msg, _ := json.Marshal(map[string]interface{}{
		"type":    eventType,
		"peer_id": peerID,
	})

	r.mu.RLock()
	defer r.mu.RUnlock()

	for id, peer := range r.Peers {
		if id == peerID {
			continue
		}
		if err := peer.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			log.Error().Err(err).Str("peer", id).Msg("Failed to send system message")
		}
	}
}
