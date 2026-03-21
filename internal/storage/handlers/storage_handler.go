package handlers

import (
	"stepbit-app/internal/models"
	"stepbit-app/internal/storage/services"
	"github.com/gofiber/fiber/v2"
)

type StorageHandler struct {
	storageService *services.StorageService
}

func NewStorageHandler(storageService *services.StorageService) *StorageHandler {
	return &StorageHandler{storageService: storageService}
}

func (h *StorageHandler) QuerySQL(c *fiber.Ctx) error {
	var req models.SqlQueryRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	rows, err := h.storageService.QueryRaw(req.SQL)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	cols, _ := rows.Columns()
	var results []map[string]interface{}

	for rows.Next() {
		columns := make([]interface{}, len(cols))
		columnPointers := make([]interface{}, len(cols))
		for i := range columns {
			columnPointers[i] = &columns[i]
		}

		if err := rows.Scan(columnPointers...); err != nil {
			return err
		}

		m := make(map[string]interface{})
		for i, colName := range cols {
			val := columns[i]
			m[colName] = val
		}
		results = append(results, m)
	}

	return c.JSON(models.SqlQueryResponse{
		Columns: cols,
		Rows:    results,
	})
}

func (h *StorageHandler) CreateSnapshot(c *fiber.Ctx) error {
	var req struct {
		Path string `json:"path"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if req.Path == "" {
		req.Path = "/tmp/stepbit_chat_snapshot.db"
	}

	if err := h.storageService.CreateSnapshot(req.Path); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"status": "success", "path": req.Path})
}
