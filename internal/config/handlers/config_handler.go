package handlers

import (
	"stepbit-app/internal/config/services"
	"github.com/gofiber/fiber/v2"
)

type ConfigHandler struct {
	configService *services.ConfigService
}

func NewConfigHandler(configService *services.ConfigService) *ConfigHandler {
	return &ConfigHandler{configService: configService}
}

func (h *ConfigHandler) ListProviders(c *fiber.Ctx) error {
	return c.JSON(h.configService.ListProviders())
}

func (h *ConfigHandler) SetActiveProvider(c *fiber.Ctx) error {
	var req struct {
		ProviderID string `json:"provider_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	h.configService.SetActiveProvider(req.ProviderID)
	return c.JSON(fiber.Map{"status": "ok", "active_provider": req.ProviderID})
}

func (h *ConfigHandler) GetActiveProvider(c *fiber.Ctx) error {
	data, err := h.configService.GetActiveProvider(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(data)
}

func (h *ConfigHandler) VerifyProvider(c *fiber.Ctx) error {
	online, errMsg := h.configService.VerifyActiveProvider(c.Context())
	if online {
		return c.JSON(fiber.Map{"status": "online"})
	}
	return c.JSON(fiber.Map{"status": "offline", "error": errMsg})
}

func (h *ConfigHandler) GetActiveModel(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"model_id": h.configService.GetActiveModel()})
}

func (h *ConfigHandler) SetActiveModel(c *fiber.Ctx) error {
	var req struct {
		ModelID string `json:"model_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	h.configService.SetActiveModel(req.ModelID)
	return c.JSON(fiber.Map{"status": "ok", "model_id": req.ModelID})
}
