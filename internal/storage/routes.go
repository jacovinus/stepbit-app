package storage

import (
	"database/sql"
	"stepbit-app/internal/storage/handlers"
	"stepbit-app/internal/storage/services"
	"github.com/gofiber/fiber/v2"
)

type StorageModule struct {
	StorageHandler *handlers.StorageHandler
	StorageService *services.StorageService
}

func NewStorageModule(db *sql.DB) *StorageModule {
	storageService := services.NewStorageService(db)
	storageHandler := handlers.NewStorageHandler(storageService)

	return &StorageModule{
		StorageHandler: storageHandler,
		StorageService: storageService,
	}
}

func (m *StorageModule) RegisterRoutes(app *fiber.App) {
	// Utils/Storage Routes
	app.Post("/api/query", m.StorageHandler.QuerySQL)
	app.Post("/api/snapshot", m.StorageHandler.CreateSnapshot)
}
