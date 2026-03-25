package handlers

import (
	"context"
	"github.com/gofiber/fiber/v2"
	"stepbit-app/internal/skill/models"
	"stepbit-app/internal/skill/services"
)

type SkillHandler struct {
	skillService *services.SkillService
}

func NewSkillHandler(skillService *services.SkillService) *SkillHandler {
	return &SkillHandler{skillService: skillService}
}

func (h *SkillHandler) ListSkills(c *fiber.Ctx) error {
	limit := c.QueryInt("limit", 100)
	offset := c.QueryInt("offset", 0)

	skills, err := h.skillService.ListSkills(limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(skills)
}

func (h *SkillHandler) CreateSkill(c *fiber.Ctx) error {
	var req models.CreateSkillRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	skill := &models.Skill{
		Name:      req.Name,
		Content:   req.Content,
		Tags:      req.Tags,
		SourceURL: req.SourceURL,
	}

	id, err := h.skillService.InsertSkill(skill)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	newSkill, _ := h.skillService.GetSkill(id)
	return c.Status(fiber.StatusCreated).JSON(newSkill)
}

func (h *SkillHandler) GetSkill(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	skill, err := h.skillService.GetSkill(int64(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Skill not found"})
	}
	return c.JSON(skill)
}

func (h *SkillHandler) UpdateSkill(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	var req models.UpdateSkillRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if err := h.skillService.UpdateSkill(int64(id), req.Name, req.Content, req.Tags, req.SourceURL); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	newSkill, _ := h.skillService.GetSkill(int64(id))
	return c.JSON(newSkill)
}

func (h *SkillHandler) DeleteSkill(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	if err := h.skillService.DeleteSkill(int64(id)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *SkillHandler) FetchURL(c *fiber.Ctx) error {
	var req models.FetchURLRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	skill, err := h.skillService.FetchSkillFromURL(context.Background(), req)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(skill)
}
